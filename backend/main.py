from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse, FileResponse
import asyncio
import time
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_, text, desc, and_, func, case
from typing import List, Optional, Dict, Any
from datetime import timedelta
import os
import json
import requests
from bs4 import BeautifulSoup

import models, schemas, database, auth, ai_service, rss_parser, mqtt_service
from pydantic import BaseModel
import logging
import builtins
from datetime import datetime

_original_print = builtins.print
def _timestamped_print(*args, **kwargs):
    _original_print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]", *args, **kwargs)
builtins.print = _timestamped_print

class WsLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("WebSocket /ws") == -1

logging.getLogger("uvicorn.access").addFilter(WsLogFilter())
logging.getLogger("uvicorn.error").addFilter(WsLogFilter())

def extract_clean_article_text(url: str, timeout: int = 8) -> Optional[str]:
    """Hämtar och extraherar ren brödtext från en webbartikel."""
    if not url or not url.startswith("http"):
        return None
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "sv,en;q=0.9"
        }
        res = requests.get(url, headers=headers, timeout=timeout)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.text, "html.parser")
        for unwanted in soup(["script", "style", "nav", "footer", "aside", "header", "noscript", "svg"]):
            unwanted.decompose()
            
        article_body = soup.find("article") or soup.find("main") or soup.find("body")
        if article_body:
            paragraphs = article_body.find_all("p")
        else:
            paragraphs = soup.find_all("p")
            
        texts = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20]
        text_content = "\n\n".join(texts)
        if len(text_content.strip()) > 40:
            return text_content.strip()
        return None
    except Exception as e:
        print(f"[SCRAPER] Kunde inte hämta artikeltext ({url}): {e}", flush=True)
        return None

models.Base.metadata.create_all(bind=database.engine)

def ensure_db_migrations():
    with database.engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(user_ai_settings)"))
            cols = [row[1] for row in res.fetchall()]
            if cols:
                if "prio_enabled" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN prio_enabled INTEGER DEFAULT 0"))
                    conn.commit()
                    print("[DB] Added prio_enabled column to user_ai_settings", flush=True)
                if "prio_notify_only" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN prio_notify_only INTEGER DEFAULT 0"))
                    conn.commit()
                    print("[DB] Added prio_notify_only column to user_ai_settings", flush=True)
                if "push_include_title" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN push_include_title INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added push_include_title column to user_ai_settings", flush=True)
                if "push_include_image" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN push_include_image INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added push_include_image column to user_ai_settings", flush=True)
                if "push_include_summary" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN push_include_summary INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added push_include_summary column to user_ai_settings", flush=True)
                if "auto_purge_enabled" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN auto_purge_enabled INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added auto_purge_enabled column to user_ai_settings", flush=True)
                if "auto_purge_days" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN auto_purge_days INTEGER DEFAULT 30"))
                    conn.commit()
                    print("[DB] Added auto_purge_days column to user_ai_settings", flush=True)
                if "auto_scrape_article_text" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN auto_scrape_article_text INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added auto_scrape_article_text column to user_ai_settings", flush=True)
                if "max_article_age_hours" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN max_article_age_hours INTEGER DEFAULT 24"))
                    conn.commit()
                    print("[DB] Added max_article_age_hours column to user_ai_settings", flush=True)
                if "ignored_disliked_tags" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN ignored_disliked_tags TEXT DEFAULT '[]'"))
                    conn.commit()
                    print("[DB] Added ignored_disliked_tags column to user_ai_settings", flush=True)
                conn.execute(text("UPDATE user_ai_settings SET prio_enabled = 0 WHERE prio_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET prio_notify_only = 0 WHERE prio_notify_only IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_title = 1 WHERE push_include_title IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_image = 1 WHERE push_include_image IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_summary = 1 WHERE push_include_summary IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_enabled = 1 WHERE auto_purge_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_days = 30 WHERE auto_purge_days IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_scrape_article_text = 1 WHERE auto_scrape_article_text IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET max_article_age_hours = 24 WHERE max_article_age_hours IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET ignored_disliked_tags = '[]' WHERE ignored_disliked_tags IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET custom_system_prompt = NULL WHERE custom_system_prompt IS NOT NULL AND custom_system_prompt NOT LIKE '%SAKLIGA NYHETER%'"))
                conn.execute(text("UPDATE user_ai_settings SET custom_system_prompt = REPLACE(custom_system_prompt, 'Max två korta', 'Max tre korta') WHERE custom_system_prompt LIKE '%Max två korta%'"))
                conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for user_ai_settings: {e}", flush=True)

        try:
            res_art = conn.execute(text("PRAGMA table_info(articles)"))
            art_cols = [row[1] for row in res_art.fetchall()]
            if art_cols:
                if "allow_push" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN allow_push INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added allow_push column to articles", flush=True)
                if "cluster_id" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN cluster_id INTEGER DEFAULT NULL"))
                    conn.commit()
                    try:
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_articles_cluster_id ON articles(cluster_id)"))
                        conn.commit()
                    except Exception:
                        pass
                    print("[DB] Added cluster_id column to articles", flush=True)
                if "content" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN content TEXT"))
                    conn.commit()
                    print("[DB] Added content column to articles", flush=True)
                if "user_vote" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN user_vote INTEGER DEFAULT 0"))
                    conn.commit()
                    try:
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_articles_user_vote ON articles(user_vote)"))
                        conn.commit()
                    except Exception:
                        pass
                    print("[DB] Added user_vote column to articles", flush=True)
                if "ai_duration_s" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN ai_duration_s REAL DEFAULT 0.0"))
                    conn.commit()
                    print("[DB] Added ai_duration_s column to articles", flush=True)
                if "urgency_score" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN urgency_score INTEGER DEFAULT 5"))
                    conn.commit()
                    print("[DB] Added urgency_score column to articles", flush=True)
                if "substance_score" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN substance_score INTEGER DEFAULT 5"))
                    conn.commit()
                    print("[DB] Added substance_score column to articles", flush=True)
                if "ai_model" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN ai_model TEXT DEFAULT ''"))
                    conn.commit()
                    print("[DB] Added ai_model column to articles", flush=True)
                if "ai_short_summary" not in art_cols:
                    conn.execute(text("ALTER TABLE articles ADD COLUMN ai_short_summary TEXT DEFAULT ''"))
                    conn.commit()
                    print("[DB] Added ai_short_summary column to articles", flush=True)
                conn.execute(text("UPDATE articles SET allow_push = 1 WHERE allow_push IS NULL"))
                conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for articles: {e}", flush=True)

        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS daily_digests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    title TEXT DEFAULT '',
                    content TEXT DEFAULT '',
                    digest_type TEXT DEFAULT 'morning',
                    article_ids TEXT DEFAULT '[]',
                    created_at INTEGER DEFAULT 0,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
            """))
            conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for daily_digests: {e}", flush=True)

        try:
            res_feeds = conn.execute(text("PRAGMA table_info(feeds)"))
            f_cols = [row[1] for row in res_feeds.fetchall()]
            if f_cols:
                if "notify_enabled" not in f_cols:
                    conn.execute(text("ALTER TABLE feeds ADD COLUMN notify_enabled INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added notify_enabled column to feeds", flush=True)
                if "icon_url" not in f_cols:
                    conn.execute(text("ALTER TABLE feeds ADD COLUMN icon_url TEXT DEFAULT ''"))
                    conn.commit()
                    print("[DB] Added icon_url column to feeds", flush=True)
                conn.execute(text("UPDATE feeds SET notify_enabled = 1 WHERE notify_enabled IS NULL"))
                conn.commit()

            first_user = conn.execute(text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).fetchone()
            if first_user:
                conn.execute(text(f"UPDATE feeds SET user_id = {first_user[0]} WHERE user_id IS NULL"))
                conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for feeds: {e}", flush=True)

        try:
            res_subs = conn.execute(text("PRAGMA table_info(push_subscriptions)"))
            s_cols = [row[1] for row in res_subs.fetchall()]
            if s_cols:
                if "user_agent" not in s_cols:
                    conn.execute(text("ALTER TABLE push_subscriptions ADD COLUMN user_agent TEXT DEFAULT ''"))
                    conn.commit()
                    print("[DB] Added user_agent column to push_subscriptions", flush=True)
                if "device_id" not in s_cols:
                    conn.execute(text("ALTER TABLE push_subscriptions ADD COLUMN device_id TEXT DEFAULT ''"))
                    conn.commit()
                    print("[DB] Added device_id column to push_subscriptions", flush=True)
                if "created_at" not in s_cols:
                    conn.execute(text("ALTER TABLE push_subscriptions ADD COLUMN created_at INTEGER DEFAULT 0"))
                    conn.commit()
                    print("[DB] Added created_at column to push_subscriptions", flush=True)
                if "updated_at" not in s_cols:
                    conn.execute(text("ALTER TABLE push_subscriptions ADD COLUMN updated_at INTEGER DEFAULT 0"))
                    conn.commit()
                    print("[DB] Added updated_at column to push_subscriptions", flush=True)
        except Exception as e:
            print(f"[DB] Migration notice for push_subscriptions: {e}", flush=True)

        try:
            res_ai_set = conn.execute(text("PRAGMA table_info(user_ai_settings)"))
            ai_cols = [row[1] for row in res_ai_set.fetchall()]
            if ai_cols:
                if "notify_ai_offline" not in ai_cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN notify_ai_offline INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added notify_ai_offline column to user_ai_settings", flush=True)
                if "push_summary_type" not in ai_cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN push_summary_type TEXT DEFAULT 'short'"))
                    conn.commit()
                    print("[DB] Added push_summary_type column to user_ai_settings", flush=True)
                if "short_summary_max_words" not in ai_cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN short_summary_max_words INTEGER DEFAULT 20"))
                    conn.commit()
                    print("[DB] Added short_summary_max_words column to user_ai_settings", flush=True)
                if "short_summary_max_sentences" not in ai_cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN short_summary_max_sentences INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added short_summary_max_sentences column to user_ai_settings", flush=True)
        except Exception as e:
            print(f"[DB] Migration notice for user_ai_settings: {e}", flush=True)

ensure_db_migrations()

app = FastAPI(title="RSS Bevakaren API")

BANNER = """
██████  ███████ ███████                                                    
██   ██ ██      ██                                                         
██████  ███████ ███████                                                    
██   ██      ██      ██                                                    
██   ██ ███████ ███████                                                    
                                                                           
                                                                           
██████  ███████ ██    ██  █████  ██   ██  █████  ██████  ███████ ███    ██ 
██   ██ ██      ██    ██ ██   ██ ██  ██  ██   ██ ██   ██ ██      ████   ██ 
██████  █████   ██    ██ ███████ █████   ███████ ██████  █████   ██ ██  ██ 
██   ██ ██       ██  ██  ██   ██ ██  ██  ██   ██ ██   ██ ██      ██  ██ ██ 
██████  ███████   ████   ██   ██ ██   ██ ██   ██ ██   ██ ███████ ██   ████ 
"""
def get_version():
    env_version = os.getenv("APP_VERSION")
    if env_version and env_version != "unknown":
        return env_version
    
    # Try reading package.json locally (for local dev)
    try:
        pkg_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "package.json")
        with open(pkg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("version", "unknown")
    except Exception:
        return "unknown"

VERSION = get_version()
LAST_UPDATE = "2026-09-18"

def normalize_user_categories(cats_raw: Any) -> List[Dict[str, Any]]:
    """Säkerställer att kategorier returneras som en lista av dicts: [{'name': '...', 'weight': X}, ...]."""
    if cats_raw is None:
        return list(ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS)
    
    parsed = cats_raw
    if isinstance(cats_raw, str):
        if not cats_raw.strip():
            return list(ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS)
        try:
            parsed = json.loads(cats_raw)
        except Exception:
            parsed = []
            
    if not parsed and parsed != []:
        return list(ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS)
        
    result = []
    default_map = {c["name"].lower(): c["weight"] for c in ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS}
    
    if isinstance(parsed, list):
        for item in parsed:
            # Extrahera ordbok från Pydantic-modeller eller använd direkt
            item_dict = None
            if hasattr(item, "model_dump") and callable(getattr(item, "model_dump")):
                try:
                    item_dict = item.model_dump()
                except Exception:
                    pass
            elif hasattr(item, "dict") and callable(getattr(item, "dict")):
                try:
                    item_dict = item.dict()
                except Exception:
                    pass
            elif isinstance(item, dict):
                item_dict = item

            if item_dict is not None and "name" in item_dict:
                name = str(item_dict["name"]).strip()
                try:
                    w = int(item_dict.get("weight", default_map.get(name.lower(), 5)))
                except Exception:
                    w = 5
                result.append({"name": name, "weight": max(0, min(10, w))})
            elif hasattr(item, "name"):
                name = str(getattr(item, "name")).strip()
                try:
                    w = int(getattr(item, "weight", default_map.get(name.lower(), 5)))
                except Exception:
                    w = 5
                result.append({"name": name, "weight": max(0, min(10, w))})
            elif isinstance(item, str) and item.strip():
                name = item.strip()
                w = default_map.get(name.lower(), 5)
                result.append({"name": name, "weight": w})
    elif isinstance(parsed, dict):
        for k, v in parsed.items():
            name = str(k).strip()
            try:
                w = int(v)
            except Exception:
                w = 5
            result.append({"name": name, "weight": max(0, min(10, w))})
            
    return result if result else list(ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS)

def run_db_migrations(db_path: str):
    if not os.path.exists(db_path):
        return
    import sqlite3
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Migration 1: Add scrape_enabled
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN scrape_enabled INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass
            
        # Migration 2: Add last_polled
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN last_polled INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass
            
        # Migration 3: Create articles table
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS articles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    feed_id INTEGER,
                    guid VARCHAR,
                    title VARCHAR,
                    link VARCHAR,
                    published VARCHAR,
                    published_ts INTEGER,
                    summary VARCHAR,
                    image_url VARCHAR,
                    categories VARCHAR,
                    received_ts INTEGER,
                    FOREIGN KEY(feed_id) REFERENCES feeds(id)
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS ix_articles_guid ON articles (guid);")
        except Exception as e:
            print(f"Migration error: {e}")
            
        # Migration 4: Add received_ts to existing articles
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN received_ts INTEGER;")
        except sqlite3.OperationalError:
            pass
            
        try:
            cur.execute("UPDATE articles SET received_ts = published_ts WHERE received_ts IS NULL;")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_articles_received_ts ON articles (received_ts);")
        except Exception as e:
            pass
            
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN last_viewed_ts INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass
            
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN include_in_dashboard INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass

        # Migration 6: Add notify_enabled
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN notify_enabled INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass

        # Migration 7: Add is_read to articles
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN is_read INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass

        # Migration 8: Add is_locked to articles
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN is_locked INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass

        # Migration 9: AI Enrichment fields
        for col_def in [
            ("ai_processed", "INTEGER DEFAULT 0"),
            ("category", "VARCHAR DEFAULT 'Övrigt'"),
            ("priority", "VARCHAR DEFAULT 'low'"),
            ("prio_score", "INTEGER DEFAULT 0"),
            ("prio_reason", "VARCHAR DEFAULT ''"),
            ("ai_summary", "TEXT"),
            ("tags", "TEXT DEFAULT '[]'")
        ]:
            try:
                cur.execute(f"ALTER TABLE articles ADD COLUMN {col_def[0]} {col_def[1]};")
            except sqlite3.OperationalError:
                pass
                
        # Migration 10: Create user_ai_settings table
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_ai_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE,
                    prio_rules TEXT DEFAULT '',
                    exclude_rules TEXT DEFAULT '',
                    categories TEXT DEFAULT '["Teknik", "Politik", "Blåljus", "Lokalt", "Ekonomi", "Nöje", "Övrigt"]',
                    prio_threshold INTEGER DEFAULT 75,
                    custom_system_prompt TEXT DEFAULT '',
                    onboarding_completed INTEGER DEFAULT 0,
                    prio_enabled INTEGER DEFAULT 0,
                    selected_model TEXT DEFAULT '',
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS ix_user_ai_settings_user_id ON user_ai_settings (user_id);")
        except Exception as e:
            print(f"Migration 10 error: {e}")
            
        # Migration 11: Add selected_model to user_ai_settings
        try:
            cur.execute("ALTER TABLE user_ai_settings ADD COLUMN selected_model TEXT DEFAULT '';")
        except sqlite3.OperationalError:
            pass

        # Migration 12: Upgrade categories in user_ai_settings to weighted format
        try:
            cur.execute("SELECT id, categories FROM user_ai_settings WHERE categories IS NOT NULL AND categories != '';")
            rows = cur.fetchall()
            for r_id, r_cats in rows:
                norm = normalize_user_categories(r_cats)
                cur.execute("UPDATE user_ai_settings SET categories = ? WHERE id = ?;", (json.dumps(norm, ensure_ascii=False), r_id))
        except Exception as e:
            print(f"Migration 12 error: {e}")

        # Migration 13: Add clickbait columns to articles
        for col_def in [
            ("is_clickbait", "INTEGER DEFAULT 0"),
            ("clickbait_reason", "TEXT DEFAULT ''")
        ]:
            try:
                cur.execute(f"ALTER TABLE articles ADD COLUMN {col_def[0]} {col_def[1]};")
            except sqlite3.OperationalError:
                pass

        # Migration 14: Add user_agent, device_id, created_at, updated_at to push_subscriptions
        for col_def in [
            ("user_agent", "TEXT DEFAULT ''"),
            ("device_id", "TEXT DEFAULT ''"),
            ("created_at", "INTEGER DEFAULT 0"),
            ("updated_at", "INTEGER DEFAULT 0")
        ]:
            try:
                cur.execute(f"ALTER TABLE push_subscriptions ADD COLUMN {col_def[0]} {col_def[1]};")
            except sqlite3.OperationalError:
                pass

        # Migration 15: Upgrade custom_system_prompt from Max två korta to Max tre korta
        try:
            cur.execute("UPDATE user_ai_settings SET custom_system_prompt = REPLACE(custom_system_prompt, 'Max två korta', 'Max tre korta') WHERE custom_system_prompt LIKE '%Max två korta%';")
        except Exception:
            pass

        # Migration 16: Clean prio_reason to only retain category information (strip duplicated clickbait reason)
        try:
            cur.execute("""
                UPDATE articles 
                SET prio_reason = RTRIM(SUBSTR(prio_reason, 1, INSTR(prio_reason, ' (Klickbete') - 1))
                WHERE prio_reason LIKE '% (Klickbete%';
            """)
            cur.execute("""
                UPDATE articles
                SET prio_reason = CASE 
                    WHEN category IS NOT NULL AND category != '' THEN 'Kategori: ' || category 
                    ELSE '' 
                END
                WHERE prio_reason LIKE 'Klickbete:%' OR prio_reason = 'Klickbete';
            """)
        except Exception as e:
            print(f"Migration 16 error: {e}")

        # Migration 17: Add content to articles and auto_scrape_article_text to user_ai_settings
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN content TEXT;")
        except sqlite3.OperationalError:
            pass
        try:
            cur.execute("ALTER TABLE user_ai_settings ADD COLUMN auto_scrape_article_text INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass

        # Migration 18: Add icon_url to feeds
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN icon_url TEXT DEFAULT '';")
        except sqlite3.OperationalError:
            pass

        # Migration 19: Add max_article_age_hours to user_ai_settings
        try:
            cur.execute("ALTER TABLE user_ai_settings ADD COLUMN max_article_age_hours INTEGER DEFAULT 24;")
        except sqlite3.OperationalError:
            pass

        # Migration 20: Add urgency_score and substance_score to articles for scoring matrix
        for col_def in [
            ("urgency_score", "INTEGER DEFAULT 5"),
            ("substance_score", "INTEGER DEFAULT 5")
        ]:
            try:
                cur.execute(f"ALTER TABLE articles ADD COLUMN {col_def[0]} {col_def[1]};")
            except sqlite3.OperationalError:
                pass

        # Migration 21: Add user_vote to articles (-1 = Ogilla, 0 = Neutral, 1 = Gilla)
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN user_vote INTEGER DEFAULT 0;")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_articles_user_vote ON articles(user_vote);")
        except sqlite3.OperationalError:
            pass

        # Migration 22: Add ai_duration_s to articles (float)
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN ai_duration_s REAL DEFAULT 0.0;")
        except sqlite3.OperationalError:
            pass

        # Migration 23: Add notify_ai_offline to user_ai_settings
        try:
            cur.execute("ALTER TABLE user_ai_settings ADD COLUMN notify_ai_offline INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass

        # Migration 24: Add ai_short_summary to articles
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN ai_short_summary TEXT;")
        except sqlite3.OperationalError:
            pass

        # Migration 25: Add push_summary_type to user_ai_settings
        try:
            cur.execute("ALTER TABLE user_ai_settings ADD COLUMN push_summary_type VARCHAR DEFAULT 'short';")
        except sqlite3.OperationalError:
            pass

        conn.commit()
        conn.close()
        size_kb = os.path.getsize(db_path) / 1024
        print(f"Database ({db_path}) size: {size_kb:.2f} KB (Migrations applied)", flush=True)
    except Exception as err:
        print(f"Migration error for {db_path}: {err}", flush=True)

# Setup default users on startup from environment variables
@app.on_event("startup")
async def startup_event():
    print(BANNER, flush=True)
    print(f"Version: {VERSION}", flush=True)
    print(f"Last update: {LAST_UPDATE}", flush=True)
    
    # Run migrations for all possible db locations
    for possible_path in ["/data/rss.db", "rss.db", "./rss.db"]:
        if os.path.exists(possible_path):
            run_db_migrations(possible_path)
            
    print("-" * 50, flush=True)

    db = database.SessionLocal()
    
    usernames_env = os.environ.get("APP_USERNAME", "")
    passwords_env = os.environ.get("APP_PASSWORD", "")
    
    if usernames_env and passwords_env:
        usernames = [u.strip() for u in usernames_env.split(",") if u.strip()]
        passwords = [p.strip() for p in passwords_env.split(",")]
        
        for i, username in enumerate(usernames):
            password = passwords[i] if i < len(passwords) else "changeme"
            
            user = db.query(models.User).filter(models.User.username == username).first()
            if not user:
                hashed_password = auth.get_password_hash(password)
                new_user = models.User(username=username, password_hash=hashed_password)
                db.add(new_user)
            else:
                if not auth.verify_password(password, user.password_hash):
                    user.password_hash = auth.get_password_hash(password)
    else:
        if db.query(models.User).count() == 0:
            hashed_password = auth.get_password_hash("admin")
            default_user = models.User(username="admin", password_hash=hashed_password)
            db.add(default_user)
            
    db.commit()
    db.close()
    
    # Start background polling, AI enrichment, scheduled nightly purge and scheduled daily digests
    asyncio.create_task(polling_loop())
    asyncio.create_task(ai_processing_loop())
    asyncio.create_task(scheduled_purge_loop())
    asyncio.create_task(scheduled_digest_loop())
    asyncio.create_task(asyncio.to_thread(ensure_all_feed_icons_cached))

    # Starta MQTT-tjänsten om den är aktiverad via miljövariabler
    mqtt_service.start_mqtt()

@app.on_event("shutdown")
async def shutdown_event():
    mqtt_service.stop_mqtt()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    print(f"Error sending ws message: {e}")

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        token = await websocket.receive_text()
        
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        db = database.SessionLocal()
        user = db.query(models.User).filter(models.User.username == username).first()
        db.close()
        
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        if user.id not in manager.active_connections:
            manager.active_connections[user.id] = []
        manager.active_connections[user.id].append(websocket)
        
        try:
            while True:
                data = await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(websocket, user.id)
            
    except WebSocketDisconnect:
        # Client disconnected before or during auth
        pass
    except Exception as e:
        try:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        except RuntimeError:
            pass

from pywebpush import webpush, WebPushException
import base64
from cryptography.hazmat.primitives.asymmetric import ec

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def get_or_create_vapid_keys():
    keys_path = "/data/vapid_keys.json"
    if not os.path.exists("/data"):
        keys_path = "vapid_keys.json"
        
    if os.path.exists(keys_path):
        with open(keys_path, "r") as f:
            return json.load(f)
            
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_numbers = private_key.private_numbers()
    private_bytes = private_numbers.private_value.to_bytes(32, byteorder='big')
    
    public_key = private_key.public_key()
    public_numbers = public_key.public_numbers()
    x = public_numbers.x.to_bytes(32, byteorder='big')
    y = public_numbers.y.to_bytes(32, byteorder='big')
    public_bytes = b'\x04' + x + y
    
    keys = {
        "private_key": base64url_encode(private_bytes),
        "public_key": base64url_encode(public_bytes),
        "sub": "mailto:admin@example.com"
    }
    
    with open(keys_path, "w") as f:
        json.dump(keys, f)
        
    return keys

VAPID_KEYS = get_or_create_vapid_keys()

def parse_device_name(ua: Optional[str]) -> str:
    if not ua:
        return "Okänd enhet"
    ua_lower = ua.lower()
    
    os_name = "Enhet"
    if "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower:
        os_name = "iPhone"
    elif "ipad" in ua_lower:
        os_name = "iPad"
    elif "windows" in ua_lower:
        os_name = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        os_name = "macOS"
    elif "cros" in ua_lower:
        os_name = "ChromeOS"
    elif "linux" in ua_lower:
        os_name = "Linux"

    browser_name = "Webbläsare"
    if "edg/" in ua_lower or "edge/" in ua_lower:
        browser_name = "Edge"
    elif "samsungbrowser" in ua_lower:
        browser_name = "Samsung Internet"
    elif "chrome" in ua_lower and "chromium" not in ua_lower:
        browser_name = "Chrome"
    elif "firefox" in ua_lower:
        browser_name = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser_name = "Safari"
    elif "opera" in ua_lower or "opr/" in ua_lower:
        browser_name = "Opera"

    return f"{os_name} ({browser_name})"

def get_icons_dir() -> str:
    """Returnerar och säkerställer katalogen för lokala flödesikoner."""
    base = "/data/icons" if os.path.exists("/data") else os.path.join(os.getcwd(), "data", "icons")
    os.makedirs(base, exist_ok=True)
    return base

def delete_local_feed_icon(feed_id: int):
    """Raderar den lokala ikonfilen när ett flöde tas bort."""
    try:
        icon_path = os.path.join(get_icons_dir(), f"feed_{feed_id}.png")
        if os.path.exists(icon_path):
            os.remove(icon_path)
            print(f"[ICONS] Raderade lokal ikon för flöde #{feed_id}: {icon_path}", flush=True)
    except Exception as e:
        print(f"[ICONS] Kunde inte radera lokal ikon för #{feed_id}: {e}", flush=True)

def download_and_save_feed_icon_sync(feed: Optional[models.Feed], link: Optional[str] = None) -> Optional[str]:
    """
    Laddar ner flödets ikon från nätet (favicon/RSS-bild), konverterar den till PNG och sparar lokalt.
    Returnerar den lokala sökvägen till PNG-filen.
    """
    if not feed or not getattr(feed, "id", None):
        return None
    icons_dir = get_icons_dir()
    target_path = os.path.join(icons_dir, f"feed_{feed.id}.png")

    if os.path.exists(target_path) and os.path.getsize(target_path) > 100:
        return target_path

    target_url = (feed.url if feed and feed.url else "") or (link or "")
    from urllib.parse import urlparse
    domain = ""
    if target_url:
        try:
            domain = urlparse(target_url).netloc
        except Exception:
            pass

    candidates = []
    # 1. Befintlig sparad extern icon_url om den är giltig http/https
    if getattr(feed, "icon_url", None) and feed.icon_url.strip().startswith(("http://", "https://")):
        candidates.append(feed.icon_url.strip())
    
    # 2. Google Favicon Service (128x128 PNG)
    if domain:
        candidates.append(f"https://www.google.com/s2/favicons?domain={domain}&sz=128")
        candidates.append(f"https://icons.duckduckgo.com/ip3/{domain}.ico")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for cand_url in candidates:
        try:
            resp = requests.get(cand_url, headers=headers, timeout=6)
            if resp.status_code == 200 and resp.content and len(resp.content) > 100:
                try:
                    from PIL import Image
                    import io
                    img = Image.open(io.BytesIO(resp.content))
                    img = img.convert("RGBA")
                    if img.width > 192 or img.height > 192:
                        img.thumbnail((192, 192), Image.Resampling.LANCZOS)
                    img.save(target_path, format="PNG")
                    print(f"[ICONS] Sparade och konverterade lokal ikon för #{feed.id} ({feed.title or domain}) -> {target_path}", flush=True)
                    return target_path
                except Exception:
                    with open(target_path, "wb") as f:
                        f.write(resp.content)
                    print(f"[ICONS] Sparade rå ikon för #{feed.id} ({feed.title or domain}) -> {target_path}", flush=True)
                    return target_path
        except Exception:
            continue
    return None

def get_default_icon_path() -> Optional[str]:
    possible = [
        os.path.join(os.path.dirname(__file__), "static", "default-feed-icon.png"),
        os.path.join(os.getcwd(), "backend", "static", "default-feed-icon.png"),
        os.path.join(os.getcwd(), "frontend", "public", "default-feed-icon.png")
    ]
    for p in possible:
        if os.path.exists(p):
            return p
    return None

def ensure_all_feed_icons_cached():
    """Går igenom alla flöden och säkerställer att deras ikoner laddas ner och sparas lokalt."""
    db = database.SessionLocal()
    try:
        feeds = db.query(models.Feed).all()
        for f in feeds:
            try:
                download_and_save_feed_icon_sync(f)
            except Exception as e:
                print(f"[ICONS] Fel vid cachning av ikon för flöde #{f.id}: {e}", flush=True)
    except Exception as ex:
        print(f"[ICONS] Fel i ensure_all_feed_icons_cached: {ex}", flush=True)
    finally:
        db.close()

def get_feed_icon_url(feed: Optional[models.Feed], link: Optional[str] = None) -> str:
    """Returnerar den lokala URL:en för flödets ikon (/api/feed-icons/{id}.png), eller default."""
    if feed and getattr(feed, "id", None):
        return f"/api/feed-icons/{feed.id}.png"
    return "/default-feed-icon.png"

@app.get("/feed-icons/{feed_id}.png")
@app.get("/api/feed-icons/{feed_id}.png")
def serve_feed_icon(feed_id: int, db: Session = Depends(database.get_db)):
    """Serverar den lokala PNG-ikonen för ett flöde, med automatisk nedladdning vid behov."""
    icons_dir = get_icons_dir()
    target_path = os.path.join(icons_dir, f"feed_{feed_id}.png")

    if os.path.exists(target_path) and os.path.getsize(target_path) > 100:
        return FileResponse(target_path, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})

    feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if feed:
        saved_path = download_and_save_feed_icon_sync(feed)
        if saved_path and os.path.exists(saved_path) and os.path.getsize(saved_path) > 100:
            return FileResponse(saved_path, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})

    def_path = get_default_icon_path()
    if def_path and os.path.exists(def_path):
        return FileResponse(def_path, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})

    raise HTTPException(status_code=404, detail="Icon not found")

def send_push_notification_to_user(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    url: str = "/",
    article_id: Optional[int] = None,
    image_url: Optional[str] = None,
    context: str = "Push",
    silent: bool = False,
    icon_url: Optional[str] = None
) -> dict:
    """
    Skickar web-push till samtliga registrerade enheter för en användare med hög prioritet (Urgency: high) och TTL.
    Hanterar fel, tar bort inaktuella enheter (HTTP 404/410) och returnerar sammanställning över leveransen.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    u_display = user.username if user else f"user_{user_id}"

    subs = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == user_id).all()
    if not subs:
        if not silent:
            print(f"[{context}] Notis triggad ('{title}': '{body[:35]}...') men användare '{u_display}' har inga aktiva enheter i databasen.", flush=True)
        return {"delivered": 0, "total": 0, "status_code": None, "has_image": bool(image_url), "errors": []}

    img_info = " med bild" if image_url else ""
    if not silent:
        print(f"[{context}] Skickar notis ('{title}'){img_info} till '{u_display}' ({len(subs)} registrerad(e) enhet(er))...", flush=True)

    delivered_count = 0
    last_status_code = None
    errors = []

    default_icon = "/default-feed-icon.png?v=2026.09.18.10"
    if not icon_url or not icon_url.strip() or icon_url.strip().endswith(".svg") or "/default-feed-icon" in icon_url:
        resolved_icon = default_icon
    else:
        resolved_icon = icon_url.strip()

    for idx, sub in enumerate(subs, 1):
        dev_desc = parse_device_name(sub.user_agent)
        endpoint_snippet = sub.endpoint[-28:] if sub.endpoint else "okänd"
        
        try:
            payload = {
                "title": title,
                "body": body,
                "url": url or "/",
                "article_id": article_id,
                "icon": resolved_icon,
                "badge": "/badge.png?v=2026.09.16.04"
            }
            if image_url:
                payload["image"] = image_url
            if article_id:
                payload["actions"] = [
                    {"action": "mark_read", "title": "Markera som läst"},
                    {"action": "open_event", "title": "Öppna"}
                ]

            resp = webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                },
                data=json.dumps(payload),
                vapid_private_key=VAPID_KEYS["private_key"],
                vapid_claims={"sub": VAPID_KEYS["sub"]},
                ttl=86400,
                headers={"Urgency": "high"}
            )
            delivered_count += 1
            status_code = resp.status_code if resp else 200
            last_status_code = status_code
            if not silent:
                print(f"[{context}] [Enhet {idx}/{len(subs)}: {dev_desc}] Levererad till '{u_display}' (...{endpoint_snippet}) -> HTTP {status_code}", flush=True)
        except WebPushException as ex:
            resp_code = getattr(ex.response, "status_code", None) if getattr(ex, "response", None) is not None else None
            resp_text = getattr(ex.response, "text", "") if getattr(ex, "response", None) is not None else str(ex)
            last_status_code = resp_code
            errors.append(f"HTTP {resp_code}: {resp_text[:80]}")
            if resp_code in [404, 410]:
                print(f"[{context}] [Enhet {idx}/{len(subs)}: {dev_desc}] Prenumerationen har löpt ut eller ogiltigförklarats (HTTP {resp_code}). Enheten raderas ur databasen för '{u_display}'.", flush=True)
                try:
                    db.delete(sub)
                    db.commit()
                except Exception:
                    db.rollback()
            else:
                print(f"[{context}] [Enhet {idx}/{len(subs)}: {dev_desc}] Fel vid push till '{u_display}' (HTTP {resp_code}): {resp_text[:140]}", flush=True)
        except Exception as e:
            errors.append(str(e))
            print(f"[{context}] [Enhet {idx}/{len(subs)}: {dev_desc}] Oväntat fel vid push till '{u_display}': {e}", flush=True)

    return {
        "delivered": delivered_count,
        "total": len(subs),
        "status_code": last_status_code or (201 if delivered_count > 0 else 500),
        "has_image": bool(image_url),
        "errors": errors
    }

async def scheduled_purge_loop():
    print("[PURGE] Schemalagd nattlig rensningsloop startad (körs kl 03:00 varje natt)", flush=True)
    while True:
        try:
            now = datetime.now()
            # Beräkna väntetid till kl 03:00 nästa natt
            target = now.replace(hour=3, minute=0, second=0, microsecond=0)
            if now >= target:
                target += timedelta(days=1)
            wait_seconds = (target - now).total_seconds()
            
            # Sov fram till kl 03:00
            await asyncio.sleep(wait_seconds)
            
            print(f"[PURGE] Startar nattlig schemalagd rensning ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})...", flush=True)
            db = database.SessionLocal()
            try:
                all_settings = db.query(models.UserAISettings).filter(
                    models.UserAISettings.auto_purge_enabled == 1
                ).all()
                total_deleted = 0
                for setting in all_settings:
                    days = setting.auto_purge_days or 30
                    cutoff_ts = int(time.time()) - (days * 24 * 60 * 60)
                    query = db.query(models.Article).join(models.Feed).filter(
                        models.Feed.user_id == setting.user_id,
                        models.Article.received_ts < cutoff_ts,
                        or_(models.Article.is_locked == 0, models.Article.is_locked == None)
                    )
                    count = query.count()
                    if count > 0:
                        article_ids = [a.id for a in query.all()]
                        db.query(models.Article).filter(models.Article.id.in_(article_ids)).delete(synchronize_session=False)
                        db.commit()
                        total_deleted += count
                print(f"[PURGE] Nattlig schemalagd rensning slutförd. Raderade {total_deleted} gamla olåsta artiklar.", flush=True)
            finally:
                db.close()
                
            # Sov 60 sekunder så vi inte körs igen under samma minut
            await asyncio.sleep(60)
        except Exception as e:
            print(f"[PURGE] Fel i schemalagd rensningsloop: {e}", flush=True)
            await asyncio.sleep(3600)

async def scheduled_digest_loop():
    print("[DIGEST] Schemalagd briefing-loop startad (körs kl 07:00 och 18:00 varje dag)", flush=True)
    while True:
        try:
            now = datetime.now()
            target_07 = now.replace(hour=7, minute=0, second=0, microsecond=0)
            target_18 = now.replace(hour=18, minute=0, second=0, microsecond=0)
            
            candidates = []
            if target_07 > now:
                candidates.append(target_07)
            if target_18 > now:
                candidates.append(target_18)
            if not candidates:
                candidates.append(target_07 + timedelta(days=1))
                
            next_target = min(candidates)
            wait_seconds = (next_target - now).total_seconds()
            print(f"[DIGEST] Nästa schemalagda briefing körs kl {next_target.strftime('%Y-%m-%d %H:%M:%S')} (om {int(wait_seconds)} sekunder)", flush=True)
            
            await asyncio.sleep(wait_seconds)
            
            print(f"[DIGEST] Startar schemalagd briefing-generering ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})...", flush=True)
            db = database.SessionLocal()
            try:
                users = db.query(models.User).all()
                for u in users:
                    try:
                        user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == u.id).first()
                        target_model = user_ai.selected_model if (user_ai and user_ai.selected_model) else None
                        await asyncio.to_thread(
                            ai_service.generate_daily_digest,
                            db=db,
                            user_id=u.id,
                            model=target_model,
                            force_rule_based=False
                        )
                        print(f"[DIGEST] Genererade schemalagd briefing för användare '{u.username}' (id={u.id})", flush=True)
                        await manager.send_personal_message("DIGEST_UPDATED", u.id)
                    except Exception as u_err:
                        print(f"[DIGEST] Fel vid briefing för användare {u.id}: {u_err}", flush=True)
            finally:
                db.close()
                
            # Sov 60 sekunder så vi inte triggas igen under samma minut
            await asyncio.sleep(60)
        except Exception as e:
            print(f"[DIGEST] Fel i schemalagd briefing-loop: {e}", flush=True)
            await asyncio.sleep(60)

async def polling_loop():
    print("Background polling loop started", flush=True)
    while True:
        db = database.SessionLocal()
        try:
            feeds = db.query(models.Feed).all()
            current_time = int(time.time())
            
            for feed in feeds:
                # polling_interval is in minutes
                interval_sec = feed.polling_interval * 60
                
                # Check if it's time to poll
                if current_time - feed.last_polled >= interval_sec:
                    await manager.send_personal_message(f"POLLING_START:{feed.id}", feed.user_id)
                    try:
                        # Kör nätverksanropet i en egen tråd för att inte blockera event-loopen
                        items = await asyncio.to_thread(rss_parser.fetch_feed_items, feed.url, feed.title)
                    except Exception as e:
                        print(f"Failed to fetch feed {feed.id}: {e}", flush=True)
                        items = []
                    
                    is_initial_poll = (feed.last_polled == 0 or feed.last_polled is None)
                    new_articles = []
                    
                    if items and (not feed.icon_url or not feed.icon_url.strip()):
                        first_icon = items[0].get("feed_icon")
                        if first_icon:
                            feed.icon_url = first_icon
                            db.commit()
                    
                    # Hämta användarens maxålder för artiklar (t.ex. 48h från AI_MAX_ARTICLE_AGE_HOURS)
                    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == feed.user_id).first()
                    max_age_hours = int(user_ai.max_article_age_hours if (user_ai and user_ai.max_article_age_hours) else os.environ.get("AI_MAX_ARTICLE_AGE_HOURS", "48"))
                    cutoff_pub_ts = current_time - (max_age_hours * 3600)

                    # Om flödet saknar tidsstämplar begränsar vi initial import till max 25 nyaste
                    parsed_items = items
                    if is_initial_poll and parsed_items and all((it.get("published_ts") or 0) == 0 for it in parsed_items[:5]):
                        parsed_items = parsed_items[:25]

                    for item in parsed_items:
                        pub_ts = item.get("published_ts") or 0

                        # Sanitetskontroll mot källor med framtida datum
                        if pub_ts > current_time + 300:
                            pub_ts = current_time

                        # Strikt kontroll av verklig publiceringstid:
                        # Ignorera historiska artiklar som är äldre än max_age_hours (t.ex. 48h)
                        if pub_ts > 0 and pub_ts < cutoff_pub_ts:
                            continue

                        # Use link or title as GUID if GUID is missing
                        guid = item.get("link") or item.get("title")
                        
                        # Check if article exists
                        existing = db.query(models.Article).filter(
                            models.Article.feed_id == feed.id,
                            models.Article.guid == guid
                        ).first()
                        
                        if not existing:
                            cat_str = ",".join(item.get("categories", []))
                            
                            # Tyst initial inläsning och spärr mot historiska artiklar (> 24 timmar)
                            art_allow_push = 1
                            if is_initial_poll:
                                art_allow_push = 0
                            elif pub_ts > 0 and (current_time - pub_ts > 86400):
                                art_allow_push = 0
                                
                            new_article = models.Article(
                                feed_id=feed.id,
                                guid=guid,
                                title=item.get("title"),
                                link=item.get("link"),
                                published=item.get("published"),
                                published_ts=pub_ts,
                                summary=item.get("summary"),
                                image_url=item.get("image_url"),
                                categories=cat_str,
                                received_ts=current_time,
                                allow_push=art_allow_push
                            )
                            db.add(new_article)
                            new_articles.append(new_article)
                    
                    feed_title = feed.title or "RSS"
                    feed_user = db.query(models.User).filter(models.User.id == feed.user_id).first()
                    feed_username = feed_user.username if feed_user else f"user_{feed.user_id}"

                    if new_articles:
                        db.commit()
                        first_id = new_articles[0].id
                        last_id = new_articles[-1].id
                        id_range = f"#{first_id}" if first_id == last_id else f"#{first_id}-#{last_id}"
                        art_count_str = "1 ny artikel sparad" if len(new_articles) == 1 else f"{len(new_articles)} nya artiklar sparade"

                        # Burst-skydd: Om fler än 6 artiklar i en och samma poll kvalificerar sig för push, begränsa till max 6 nyaste
                        if not is_initial_poll:
                            push_eligible = [a for a in new_articles if a.allow_push == 1]
                            if len(push_eligible) > 6:
                                for a in push_eligible[:-6]:
                                    a.allow_push = 0
                                db.commit()
                                print(f"[ANTI-BURST: {feed_username}] '{feed_title}': {len(push_eligible)} artiklar. Begränsar push till de 6 nyaste.", flush=True)

                        print(f"[POLL: {feed_username}] {feed_title}: {art_count_str} ({id_range})", flush=True)
                        ai_wake_event.set()
                        
                        if is_initial_poll:
                            print(f"[POLL: {feed_username}] {feed_title}: Initial inläsning slutförd, artiklar sparade tyst utan push-notiser.", flush=True)
                            await manager.send_personal_message(f"INITIAL_ARTICLES:{feed.id}:{len(new_articles)}", feed.user_id)
                        else:
                            await manager.send_personal_message(f"NEW_ARTICLES:{feed.id}:{len(new_articles)}", feed.user_id)
                        
                        # Check keywords and feed notify settings
                        user_keywords = db.query(models.Keyword).filter(models.Keyword.user_id == feed.user_id).all()
                        kw_texts = [kw.keyword.lower() for kw in user_keywords] if user_keywords else []

                        # 1. Publicera inkommande artiklar direkt till användarens MQTT-flöde
                        if not is_initial_poll and mqtt_service.MQTT_ENABLED:
                            for art in new_articles:
                                try:
                                    art_matched_kws = []
                                    if kw_texts:
                                        search_text = f"{art.title or ''} {art.summary or ''}".lower()
                                        art_matched_kws = [k for k in kw_texts if k in search_text]
                                    raw_is_prio = bool(art_matched_kws)
                                    mqtt_service.publish_article(
                                        article=art,
                                        feed=feed,
                                        username=feed_username,
                                        user_id=feed.user_id,
                                        is_prio=raw_is_prio,
                                        matched_keywords=art_matched_kws
                                    )
                                except Exception as mqtt_err:
                                    print(f"[MQTT] Fel vid publicering av artikel {art.id} för {feed_username}: {mqtt_err}", flush=True)

                        # 2. Rå-pushnotiser (endast om användaren inte har AI aktiverat)
                        if not is_initial_poll:
                            user_ai_pref = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == feed.user_id).first()
                            ai_enabled_for_user = bool(user_ai_pref and user_ai_pref.prio_enabled)

                            if not ai_enabled_for_user:
                                for art in new_articles:
                                    if art.allow_push != 1:
                                        continue
                                        
                                    should_notify = False
                                    notify_title = ""
                                    notify_body = ""
                                    
                                    is_feed_notify = feed.notify_enabled if feed.notify_enabled is not None else 1
                                    prio_notify_only = bool(user_ai_pref.prio_notify_only) if user_ai_pref else False
                                    if not prio_notify_only and is_feed_notify == 1:
                                        should_notify = True
                                        notify_title = f"{feed.title or 'RSS'}: {art.title}"
                                        notify_body = art.summary or art.title
                                        
                                    matched_kws = []
                                    if kw_texts:
                                        search_text = f"{art.title or ''} {art.summary or ''}".lower()
                                        matched_kws = [k for k in kw_texts if k in search_text]
                                        if matched_kws:
                                            should_notify = True
                                            notify_title = f"Bevakningsord ({matched_kws[0]}): {art.title}"
                                            notify_body = art.summary or art.title
                                            
                                    if should_notify:
                                        feed_icon = get_feed_icon_url(feed, art.link)
                                        send_push_notification_to_user(
                                            db=db,
                                            user_id=feed.user_id,
                                            title=notify_title,
                                            body=notify_body or "Ny artikel",
                                            url=art.link or "/",
                                            article_id=art.id,
                                            image_url=art.image_url,
                                            context="Rå-Push",
                                            icon_url=feed_icon
                                        )
                    else:
                        print(f"[POLL: {feed_username}] {feed_title}: 0 nya artiklar", flush=True)
                    
                    # Update last polled time
                    feed.last_polled = int(time.time())
                    db.commit()
                    
                    await manager.send_personal_message(f"POLLING_END:{feed.id}", feed.user_id)
                    
                    # Spread out the polling to avoid bursts of notifications
                    import random
                    await asyncio.sleep(random.uniform(5.0, 15.0))
        except Exception as e:
            print(f"Polling error: {e}", flush=True)
        finally:
            db.close()
        
        await asyncio.sleep(30) # Check every 30 seconds

def safe_bg_save_embedding(art_id: int, title: str, summary: str):
    """Säker bakgrundssparning av embedding samt topic-klustring med garanterad sessionsstängning."""
    sess = database.SessionLocal()
    try:
        ai_service.save_article_embedding(art_id, title, summary, sess)
        ai_service.find_or_create_article_cluster(art_id, sess)
    except Exception as e:
        print(f"[Topic Clustering] Bakgrundsfel för artikel {art_id}: {e}", flush=True)
    finally:
        sess.close()

def get_user_interest_profile(db: Session, user_id: int):
    """
    Hämtar unika ämnestaggar från användarens gillade och ogillade artiklar
    för att skapa en adaptiv intresseprofil för AI-prioritering.
    OBS: Huvudkategorier inkluderas INTE här då de styrs explicit av användarens
    kategorireglage i Inställningar.
    """
    from collections import Counter

    liked_rows = db.query(models.Article.tags).join(models.Feed).filter(
        models.Feed.user_id == user_id,
        models.Article.user_vote == 1
    ).order_by(models.Article.id.desc()).limit(100).all()

    disliked_rows = db.query(models.Article.tags).join(models.Feed).filter(
        models.Feed.user_id == user_id,
        models.Article.user_vote == -1
    ).order_by(models.Article.id.desc()).limit(100).all()

    ignored_tags = set()
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == user_id).first()
    if user_ai and user_ai.ignored_disliked_tags:
        try:
            parsed_ignored = json.loads(user_ai.ignored_disliked_tags) if isinstance(user_ai.ignored_disliked_tags, str) else user_ai.ignored_disliked_tags
            if isinstance(parsed_ignored, list):
                ignored_tags = {str(t).strip().lower() for t in parsed_ignored if t and str(t).strip()}
        except Exception:
            pass

    liked_counter = Counter()
    disliked_counter = Counter()

    def _count_tags(rows, counter):
        for (r_tags,) in rows:
            if r_tags:
                try:
                    parsed = json.loads(r_tags) if isinstance(r_tags, str) else r_tags
                    if isinstance(parsed, list):
                        seen_in_art = set()
                        for t in parsed:
                            clean_t = str(t).strip().lower()
                            if clean_t and len(clean_t) >= 2 and clean_t not in seen_in_art:
                                seen_in_art.add(clean_t)
                                counter[clean_t] += 1
                except Exception:
                    pass

    _count_tags(liked_rows, liked_counter)
    _count_tags(disliked_rows, disliked_counter)

    liked_set = set(liked_counter.keys())

    # TRÖSKELREGEL: Ett ämne måste ha ogillats i minst 2 artiklar för att aktivera -15p straffavdrag!
    disliked_set = {tag for tag, count in disliked_counter.items() if count >= 2}

    # 1. Gillade ämnen har alltid företräde; ett ämne man gillat kan aldrig ge ett ogillat-avdrag
    disliked_set = disliked_set - liked_set

    # 2. Ignorerade / vitlistade ämnen straffas aldrig
    disliked_set = disliked_set - ignored_tags

    return list(liked_set), list(disliked_set)

ai_wake_event = asyncio.Event()
ai_failed_attempts: dict[int, int] = {}
ai_retry_after: dict[int, float] = {}

def get_admin_user(db: Session) -> Optional[models.User]:
    """Hämtar administratörskontot (antingen användarnamn 'admin' eller användare id 1)."""
    admin = db.query(models.User).filter(func.lower(models.User.username) == "admin").first()
    if admin:
        return admin
    return db.query(models.User).order_by(models.User.id.asc()).first()

ai_lm_offline_since: Optional[float] = None
ai_lm_offline_notified: bool = False

async def ai_processing_loop():
    global ai_lm_offline_since, ai_lm_offline_notified
    print("Background AI enrichment loop started", flush=True)
    # Vänta lite i början så appen och LM Studio hinner initialiseras
    await asyncio.sleep(5)
    
    while True:
        try:
            # Kontrollera om LM Studio är nåbart innan vi hämtar artiklar (TTL-cachad, snabb)
            is_healthy = await asyncio.to_thread(ai_service.check_lm_studio_health)
            if not is_healthy:
                now = time.time()
                if ai_lm_offline_since is None:
                    ai_lm_offline_since = now

                # Om LM Studio har varit onåbart i minst 45 sekunder och vi inte redan larmat:
                if (now - ai_lm_offline_since >= 45) and not ai_lm_offline_notified:
                    db_alert = database.SessionLocal()
                    try:
                        admin_user = get_admin_user(db_alert)
                        if admin_user:
                            admin_ai = db_alert.query(models.UserAISettings).filter(models.UserAISettings.user_id == admin_user.id).first()
                            wants_alert = bool(admin_ai.notify_ai_offline if admin_ai and admin_ai.notify_ai_offline is not None else 1)
                            if wants_alert:
                                print(f"[AI Driftlarm] LM Studio har varit onåbart i 45 sekunder. Skickar driftnotis till admin '{admin_user.username}'.", flush=True)
                                send_push_notification_to_user(
                                    db=db_alert,
                                    user_id=admin_user.id,
                                    title="AI-motorn är offline",
                                    body="LM Studio svarar inte. Kontrollera att servern och modellen är igång.",
                                    url="/settings?tab=ai",
                                    context="AI Offline Alert"
                                )
                                asyncio.create_task(manager.send_personal_message("AI_OFFLINE_ALERT", admin_user.id))
                                ai_lm_offline_notified = True
                    except Exception as ex_alert:
                        print(f"[AI Driftlarm] Fel vid sändning av offline-notis: {ex_alert}", flush=True)
                    finally:
                        db_alert.close()

                # Sov 15 sekunder om LM Studio är offline för att inte spamma loggar
                await asyncio.sleep(15)
                continue
            else:
                # LM Studio är online! Om vi tidigare larmat om offline skickas en återställningsnotis
                if ai_lm_offline_notified:
                    db_alert = database.SessionLocal()
                    try:
                        admin_user = get_admin_user(db_alert)
                        if admin_user:
                            admin_ai = db_alert.query(models.UserAISettings).filter(models.UserAISettings.user_id == admin_user.id).first()
                            wants_alert = bool(admin_ai.notify_ai_offline if admin_ai and admin_ai.notify_ai_offline is not None else 1)
                            if wants_alert:
                                print(f"[AI Driftlarm] LM Studio är online igen! Skickar återställningsnotis till admin '{admin_user.username}'.", flush=True)
                                send_push_notification_to_user(
                                    db=db_alert,
                                    user_id=admin_user.id,
                                    title="AI-motorn är online igen",
                                    body="Anslutningen till LM Studio är återställd. Analys av köade artiklar återupptas.",
                                    url="/settings?tab=ai",
                                    context="AI Online Alert"
                                )
                                asyncio.create_task(manager.send_personal_message("AI_ONLINE_ALERT", admin_user.id))
                    except Exception as ex_alert:
                        print(f"[AI Driftlarm] Fel vid sändning av återställningsnotis: {ex_alert}", flush=True)
                    finally:
                        db_alert.close()

                ai_lm_offline_since = None
                ai_lm_offline_notified = False
                
            # 1. Hämta inställningar och utför underhåll i en kort, omedelbart stängd DB-session
            cutoff_ts = int(time.time()) - (24 * 3600)
            candidate_ids = []
            db_init = database.SessionLocal()
            try:
                user_ai_first = db_init.query(models.UserAISettings).order_by(models.UserAISettings.id.asc()).first()
                max_age_hours = int(user_ai_first.max_article_age_hours if (user_ai_first and user_ai_first.max_article_age_hours) else os.environ.get("AI_MAX_ARTICLE_AGE_HOURS", "24"))
                now = int(time.time())
                cutoff_ts = now - (max_age_hours * 3600)

                # 0. Återställ automatiskt tidigare artiklar med tillfälligt analysfel så att de får en ny chans
                try:
                    resets = db_init.query(models.Article).filter(
                        models.Article.prio_reason.like("%Standardprioritering (AI-analys kunde inte slutföras)%"),
                        models.Article.received_ts >= cutoff_ts,
                        or_(models.Article.is_read == 0, models.Article.is_read == None)
                    ).update({
                        models.Article.ai_processed: 0,
                        models.Article.prio_reason: "",
                        models.Article.ai_summary: None
                    }, synchronize_session=False)
                    if resets > 0:
                        db_init.commit()
                        print(f"[AI] Återställde {resets} tidigare misslyckade artiklar för ny AI-analys.", flush=True)
                except Exception:
                    pass

                # 1. Arkivera/hoppa automatiskt över gamla artiklar (> max_age_hours baserat på published_ts eller received_ts) och artiklar som redan är lästa
                db_init.query(models.Article).filter(
                    or_(models.Article.ai_processed == 0, models.Article.ai_processed == None),
                    or_(
                        and_(models.Article.published_ts > 0, models.Article.published_ts < cutoff_ts),
                        and_(or_(models.Article.published_ts == 0, models.Article.published_ts == None), models.Article.received_ts < cutoff_ts),
                        models.Article.is_read == 1
                    )
                ).update({models.Article.ai_processed: 2}, synchronize_session=False)
                db_init.commit()

                # 2. Hämta färska, olästa artiklar från aktiva flöden som inkommit inom tidsfönstret
                cur_time = time.time()
                raw_articles = db_init.query(models.Article.id).join(models.Feed).filter(
                    or_(models.Article.ai_processed == 0, models.Article.ai_processed == None),
                    models.Article.received_ts >= cutoff_ts,
                    or_(models.Article.is_read == 0, models.Article.is_read == None),
                    models.Feed.include_in_dashboard == 1
                ).order_by(models.Article.received_ts.desc()).limit(12).all()
                
                # Filtrera bort artiklar som har en aktiv retry-fördröjning
                candidate_ids = [row[0] for row in raw_articles if ai_retry_after.get(row[0], 0) <= cur_time][:3]
            finally:
                db_init.close()
            
            if not candidate_ids:
                try:
                    await asyncio.wait_for(ai_wake_event.wait(), timeout=10.0)
                except asyncio.TimeoutError:
                    pass
                finally:
                    ai_wake_event.clear()
                continue

            for art_id in candidate_ids:
                # 2a. Hämta artikeldata och användarinställningar i en snabb session (stängs direkt)
                item = None
                db_item = database.SessionLocal()
                try:
                    art = db_item.query(models.Article).filter(models.Article.id == art_id).first()
                    if not art or art.ai_processed in (1, 2):
                        continue

                    feed_id = art.feed_id
                    feed_obj = db_item.query(models.Feed).filter(models.Feed.id == feed_id).first() if feed_id else None
                    source = feed_obj.title if (feed_obj and feed_obj.title) else ""
                    user_id = feed_obj.user_id if feed_obj else None

                    user_prompt = None
                    user_cats = None
                    user_ai = None
                    user_model = None
                    auto_scrape_active = True
                    feed_allows_scrape = True
                    threshold = 75
                    prio_enabled = False
                    prio_notify_only = False
                    feed_notifs_on = True
                    inc_title = True
                    inc_image = True
                    inc_summary = True
                    matched_kw_candidates = []

                    if feed_obj:
                        if feed_obj.notify_enabled is not None:
                            feed_notifs_on = (feed_obj.notify_enabled == 1)
                        if feed_obj.scrape_enabled is not None:
                            feed_allows_scrape = (feed_obj.scrape_enabled != 0)

                    if user_id:
                        user_ai = db_item.query(models.UserAISettings).filter(models.UserAISettings.user_id == user_id).first()
                        if not user_ai or not user_ai.prio_enabled:
                            art.ai_processed = 1
                            db_item.commit()
                            continue

                        threshold = user_ai.prio_threshold if user_ai.prio_threshold else 75
                        prio_enabled = bool(user_ai.prio_enabled)
                        prio_notify_only = bool(user_ai.prio_notify_only)
                        inc_title = bool(user_ai.push_include_title if user_ai.push_include_title is not None else 1)
                        inc_image = bool(user_ai.push_include_image if user_ai.push_include_image is not None else 1)
                        inc_summary = bool(user_ai.push_include_summary if user_ai.push_include_summary is not None else 1)
                        push_summary_type = getattr(user_ai, "push_summary_type", "short") or "short"
                        short_summary_max_words = getattr(user_ai, "short_summary_max_words", 20) or 20
                        short_summary_max_sentences = getattr(user_ai, "short_summary_max_sentences", 1) or 1

                        user_cats = normalize_user_categories(user_ai.categories)
                        user_prompt = ai_service.ensure_clickbait_in_prompt(
                            user_ai.custom_system_prompt,
                            categories=user_cats,
                            short_summary_max_words=short_summary_max_words,
                            short_summary_max_sentences=short_summary_max_sentences
                        )
                        user_model = user_ai.selected_model if user_ai.selected_model else None
                        if user_ai.auto_scrape_article_text is not None:
                            auto_scrape_active = (user_ai.auto_scrape_article_text != 0)

                        kws = db_item.query(models.Keyword).filter(models.Keyword.user_id == user_id).all()
                        matched_kw_candidates = [k.keyword for k in kws if k.keyword]
                        liked_tags, disliked_tags = get_user_interest_profile(db_item, user_id)
                    else:
                        liked_tags, disliked_tags = [], []
                        push_summary_type = "short"

                    u_rec = db_item.query(models.User).filter(models.User.id == user_id).first() if user_id else None
                    u_display = u_rec.username if u_rec else f"user_{user_id}"

                    feed_icon_url = get_feed_icon_url(feed_obj, art.link)

                    item = {
                        "id": art.id,
                        "title": art.title or "",
                        "summary": art.summary or "",
                        "content": art.content or "",
                        "link": art.link or "",
                        "image_url": art.image_url,
                        "published_ts": art.published_ts,
                        "allow_push": getattr(art, 'allow_push', 1),
                        "categories": art.categories.split(",") if art.categories else [],
                        "feed_id": feed_id,
                        "source": source,
                        "user_id": user_id,
                        "u_display": u_display,
                        "feed_icon_url": feed_icon_url,
                        "user_prompt": user_prompt,
                        "user_cats": user_cats,
                        "user_model": user_model,
                        "auto_scrape_active": auto_scrape_active,
                        "feed_allows_scrape": feed_allows_scrape,
                        "matched_kw_candidates": matched_kw_candidates,
                        "liked_tags": liked_tags,
                        "disliked_tags": disliked_tags,
                        "threshold": threshold,
                        "prio_enabled": prio_enabled,
                        "prio_notify_only": prio_notify_only,
                        "feed_notifs_on": feed_notifs_on,
                        "inc_title": inc_title,
                        "inc_image": inc_image,
                        "inc_summary": inc_summary,
                        "push_summary_type": push_summary_type,
                        "short_summary_max_words": short_summary_max_words,
                        "short_summary_max_sentences": short_summary_max_sentences
                    }
                finally:
                    db_item.close()

                if not item:
                    continue

                user_id = item["user_id"]
                u_display = item["u_display"]

                loop = asyncio.get_running_loop()
                last_reported_pct = -1

                def on_progress_sync(pct: int):
                    nonlocal last_reported_pct
                    if pct != last_reported_pct:
                        last_reported_pct = pct
                        if user_id:
                            asyncio.run_coroutine_threadsafe(
                                manager.send_personal_message(f"AI_PROGRESS:{item['id']}:{pct}", user_id),
                                loop
                            )

                # Skicka start-progress (0%) direkt så UI visar aktiv progress
                if user_id:
                    await manager.send_personal_message(f"AI_PROGRESS:{item['id']}:0", user_id)

                # Avgör om vi ska hämta och använda skrapad brödtext för djup AI-analys (utan öppen DB-session)
                article_text_for_ai = item["summary"]
                if item["auto_scrape_active"] and item["feed_allows_scrape"] and item["link"]:
                    scraped_text = item["content"]
                    if not scraped_text or len(scraped_text.strip()) < 30:
                        scraped_text = await asyncio.to_thread(extract_clean_article_text, item["link"], 8)
                        if scraped_text and len(scraped_text.strip()) > 30:
                            item["content"] = scraped_text
                            # Spara skrapad text i en snabb databastransaktion
                            db_scrape = database.SessionLocal()
                            try:
                                db_scrape.query(models.Article).filter(models.Article.id == item["id"]).update(
                                    {models.Article.content: scraped_text}, synchronize_session=False
                                )
                                db_scrape.commit()
                            except Exception:
                                pass
                            finally:
                                db_scrape.close()

                    if scraped_text and len(scraped_text.strip()) > 30:
                        article_text_for_ai = scraped_text[:2500]

                # LM STUDIO-ANROP (Helt utan öppen DB-session! Databasen är 100% fri för frontend)
                analysis = await asyncio.to_thread(
                    ai_service.analyze_article,
                    title=item["title"],
                    summary=article_text_for_ai,
                    source_title=item["source"],
                    categories=item["categories"],
                    custom_prompt=item["user_prompt"],
                    user_categories=item["user_cats"],
                    model_override=item["user_model"],
                    on_progress=on_progress_sync,
                    liked_tags=item.get("liked_tags"),
                    disliked_tags=item.get("disliked_tags"),
                    short_summary_max_words=item.get("short_summary_max_words", 20),
                    short_summary_max_sentences=item.get("short_summary_max_sentences", 1)
                )

                if analysis:
                    category = analysis.get("category", "Övrigt")
                    priority = analysis.get("priority", "low")
                    prio_score = analysis.get("prio_score", 10)
                    prio_reason = analysis.get("prio_reason", "")
                    ai_summary = analysis.get("ai_summary", "")
                    ai_short_summary = analysis.get("ai_short_summary", "")
                    tags_json = json.dumps(analysis.get("tags", []), ensure_ascii=False)
                    is_clickbait = analysis.get("is_clickbait", 0)
                    clickbait_reason = analysis.get("clickbait_reason", "")
                    urgency_score = analysis.get("urgency_score", 5)
                    substance_score = analysis.get("substance_score", 5)
                    dur = analysis.get("duration_s", 0.0)

                    # Bevakningsord-kontroll
                    matched_kw = []
                    text_to_check = f"{item['title']} {item['summary']}".lower()
                    matched_kw = [kw for kw in item["matched_kw_candidates"] if kw and kw.lower() in text_to_check]
                    if matched_kw:
                        priority = "high"
                        prio_score = 100
                        kw_str = ", ".join(matched_kw)
                        prio_reason = f"Träff på bevakningsord: {kw_str}"

                    # Spara i databasen i en snabb, isolerad session
                    db_save = database.SessionLocal()
                    try:
                        save_art = db_save.query(models.Article).filter(models.Article.id == item["id"]).first()
                        feed_obj_save = db_save.query(models.Feed).filter(models.Feed.id == item["feed_id"]).first() if item["feed_id"] else None
                        if save_art:
                            save_art.ai_processed = 1
                            save_art.category = category
                            save_art.priority = priority
                            save_art.prio_score = prio_score
                            save_art.prio_reason = prio_reason
                            save_art.urgency_score = urgency_score
                            save_art.substance_score = substance_score
                            save_art.ai_summary = ai_summary
                            save_art.ai_short_summary = ai_short_summary
                            save_art.tags = tags_json
                            save_art.is_clickbait = is_clickbait
                            save_art.clickbait_reason = clickbait_reason
                            save_art.ai_duration_s = dur
                            save_art.ai_model = analysis.get("ai_model") or item.get("user_model") or ai_service.get_active_model()
                            db_save.commit()

                        # Notishantering
                        is_prio = (priority and str(priority).lower() == "high") or ((prio_score or 0) >= item["threshold"])
                        should_send_push = False
                        push_title = ""
                        context_tag = "Push"
                        push_info = None

                        try:
                            # Spärr mot initial inläsning och historiska artiklar (> 24 timmar)
                            is_too_old_or_initial = (item["allow_push"] == 0)

                            if is_too_old_or_initial:
                                should_send_push = False
                            elif matched_kw:
                                # Bevakningsord skickas alltid direkt
                                should_send_push = True
                                kw_str = ", ".join(matched_kw)
                                push_title = f"Bevakningsord ({kw_str}): {item['title']}" if item["inc_title"] else f"Bevakningsord ({kw_str})"
                                context_tag = "Bevakningsord-Push"
                            elif item["prio_notify_only"]:
                                # Valet för PRIO-notiser är PÅSLAGET: Skicka ENDAST artiklar som uppnår PRIO
                                if is_prio:
                                    should_send_push = True
                                    push_title = f"PRIO ({item['source'] or 'RSS'}): {item['title']}" if item["inc_title"] else f"PRIO ({item['source'] or 'RSS'})"
                                    context_tag = "PRIO-Push"
                                else:
                                    should_send_push = False
                            else:
                                # Valet för PRIO-notiser är AVSLAGET: Skicka notiser för de flöden vi har aktiverat i "Notiser per flöde"
                                if item["feed_notifs_on"]:
                                    should_send_push = True
                                    if is_prio:
                                        push_title = f"PRIO ({item['source'] or 'RSS'}): {item['title']}" if item["inc_title"] else f"PRIO ({item['source'] or 'RSS'})"
                                        context_tag = "PRIO-Push"
                                    else:
                                        push_title = f"{item['source'] or 'RSS'}: {item['title']}" if item["inc_title"] else f"{item['source'] or 'RSS'}"
                                        context_tag = "Flöde-Push"
                                else:
                                    should_send_push = False

                            if should_send_push and user_id:
                                cb_prefix = "⚠ " if is_clickbait else ""
                                if cb_prefix and not push_title.startswith("⚠"):
                                    push_title = f"{cb_prefix}{push_title}"

                                chosen_summary = (ai_short_summary if item.get("push_summary_type") == "short" and ai_short_summary else ai_summary) or ai_short_summary
                                push_body = (chosen_summary or item["summary"] or item["title"] or "Ny artikel") if item["inc_summary"] else (item["summary"] or item["title"] or "Ny artikel")

                                push_img = item["image_url"] if item["inc_image"] else None
                                push_info = send_push_notification_to_user(
                                    db=db_save,
                                    user_id=user_id,
                                    title=push_title,
                                    body=push_body,
                                    url=item["link"] or "/",
                                    article_id=item["id"],
                                    image_url=push_img,
                                    context=context_tag,
                                    silent=True,
                                    icon_url=item["feed_icon_url"]
                                )
                        except Exception as push_err:
                            print(f"[Push: {u_display}] Fel vid hantering av push-notis för artikel {item['id']}: {push_err}", flush=True)

                        # MQTT-publicering
                        if save_art:
                            try:
                                mqtt_service.publish_article(
                                    article=save_art,
                                    feed=feed_obj_save,
                                    username=u_display,
                                    user_id=user_id,
                                    is_prio=is_prio,
                                    matched_keywords=matched_kw,
                                    is_update=True
                                )
                            except Exception as mqtt_err:
                                print(f"[MQTT: {u_display}] Fel vid publicering av berikad artikel {item['id']}: {mqtt_err}", flush=True)
                    finally:
                        db_save.close()

                    # Generera semantisk embedding och utför Topic-klustring säkert i bakgrundstråd
                    cluster_info_str = ""
                    try:
                        summary_text = ai_summary or item["summary"] or ""
                        await asyncio.to_thread(safe_bg_save_embedding, item["id"], item["title"], summary_text)
                    except Exception:
                        pass

                    # Loggning
                    prio_tag = " [PRIO]" if is_prio else ""
                    cb_tag = " [ClickBait]" if is_clickbait else ""
                    if should_send_push:
                        tag_name = "BEVAKNINGSORD" if matched_kw else ("PRIO-NOTIS" if is_prio else "NOTIS")
                        kw_info = f": {', '.join(matched_kw)}" if matched_kw else ""
                        deliv_str = "Kunde inte skicka notis"
                        if push_info:
                            deliv_cnt = push_info.get("delivered", 0)
                            total_devs = push_info.get("total", 0)
                            sc = push_info.get("status_code", 200)
                            img_str = ", med bild" if item["image_url"] else ""
                            if total_devs == 0:
                                deliv_str = "Inga aktiva enheter registrerade"
                            elif deliv_cnt > 0:
                                deliv_str = f"Skickad till {deliv_cnt} enhet(er) (HTTP {sc}{img_str})"
                            else:
                                err_summary = f" ({'; '.join(push_info.get('errors', []))})" if push_info.get("errors") else ""
                                deliv_str = f"Misslyckades skicka till {total_devs} enhet(er){err_summary}"

                        print("====================================================================", flush=True)
                        print(f"[{tag_name}{cb_tag}{kw_info}] Användare: {u_display} | Källa: {item['source'] or 'RSS'} | #{item['id']}", flush=True)
                        print(f"  Titel:    \"{item['title']}\"", flush=True)
                        print(f"  Analys:   {category} | {priority.upper()} ({prio_score}p){cb_tag}{cluster_info_str} | Svarstid: {dur}s", flush=True)
                        print(f"  Leverans: {deliv_str}", flush=True)
                        print("====================================================================", flush=True)
                    else:
                        print(
                            f"[AI: {u_display}] {item['source'] or 'RSS'} #{item['id']} | {category} | {priority.upper()} ({prio_score}p){prio_tag}{cluster_info_str} | {dur}s | \"{item['title']}\"",
                            flush=True
                        )

                    ai_failed_attempts.pop(item["id"], None)
                    ai_retry_after.pop(item["id"], None)

                    if user_id:
                        await manager.send_personal_message(f"AI_UPDATED:{item['id']}", user_id)
                else:
                    # LM Studio svarade inte för denna artikel
                    is_online = await asyncio.to_thread(ai_service.check_lm_studio_health)
                    if not is_online:
                        print(f"[AI] LM Studio svarar inte (offline/pausar). Försöker igen senare för artikel {item['id']}", flush=True)
                        await asyncio.sleep(10)
                        break
                    else:
                        attempts = ai_failed_attempts.get(item["id"], 0) + 1
                        ai_failed_attempts[item["id"]] = attempts

                        if attempts < 3:
                            ai_retry_after[item["id"]] = time.time() + 45
                            print(f"[AI] Artikel #{item['id']} ('{item['title'][:45]}...') misslyckades vid försök {attempts}/3. Schemalägger automatiskt återförsök om 45 sekunder.", flush=True)
                        else:
                            print(f"[AI] Varning: 3 automatiska försök misslyckades för artikel #{item['id']}. Tilldelar standardvärden så kön inte blockeras.", flush=True)
                            db_fallback = database.SessionLocal()
                            try:
                                db_fallback.query(models.Article).filter(models.Article.id == item["id"]).update({
                                    models.Article.ai_processed: 1,
                                    models.Article.category: "Övrigt",
                                    models.Article.priority: "medium",
                                    models.Article.prio_score: 50,
                                    models.Article.prio_reason: "Standardprioritering (AI-analys kunde inte slutföras)",
                                    models.Article.tags: "[]"
                                }, synchronize_session=False)
                                db_fallback.commit()
                            finally:
                                db_fallback.close()
                            ai_failed_attempts.pop(item["id"], None)
                            ai_retry_after.pop(item["id"], None)

            # 3. Bakgrundsvektorisering i isolerad session (begränsad batch så den inte blockerar)
            try:
                db_emb = database.SessionLocal()
                try:
                    missing_embs = db_emb.query(models.Article).outerjoin(models.ArticleEmbedding).filter(
                        models.ArticleEmbedding.article_id == None,
                        models.Article.received_ts >= cutoff_ts
                    ).order_by(desc(models.Article.received_ts)).limit(5).all()
                    if missing_embs:
                        await asyncio.to_thread(ai_service.batch_embed_articles, missing_embs, db_emb)
                finally:
                    db_emb.close()
            except Exception as emb_err:
                print(f"[AI Embeddings] Fel vid bakgrundsvektorisering: {emb_err}", flush=True)

        except Exception as e:
            print(f"[AI] Fel i ai_processing_loop: {e}", flush=True)
            
        await asyncio.sleep(5)


@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
 
@app.post("/auth/refresh", response_model=schemas.Token)
def refresh_access_token(current_user: models.User = Depends(auth.get_current_user)):
    """Förlänger sessionen (sliding session) för en aktiv inloggad användare."""
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": current_user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/feeds", response_model=List[schemas.FeedResponse])
def get_feeds(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
    feed_responses = []
    for feed in feeds:
        unread_count = db.query(models.Article).filter(
            models.Article.feed_id == feed.id,
            (models.Article.is_read == 0) | (models.Article.is_read == None)
        ).count()
        
        feed_dict = {
            "id": feed.id,
            "user_id": feed.user_id,
            "url": feed.url,
            "title": feed.title,
            "polling_interval": feed.polling_interval,
            "scrape_enabled": bool(feed.scrape_enabled),
            "include_in_dashboard": bool(feed.include_in_dashboard),
            "notify_enabled": bool(feed.notify_enabled),
            "icon_url": get_feed_icon_url(feed),
            "unread_count": unread_count
        }
        feed_responses.append(feed_dict)
    return feed_responses

@app.post("/feeds/{feed_id}/view", response_model=dict)
def view_feed(feed_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id, models.Feed.user_id == current_user.id).first()
    if feed:
        feed.last_viewed_ts = int(time.time())
        db.commit()
    return {"status": "ok"}

@app.post("/feeds", response_model=schemas.FeedResponse)
def create_feed(feed: schemas.FeedCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    icon_url = (feed.icon_url or "").strip()
    if not feed.title or not feed.title.strip() or not icon_url:
        import feedparser
        parsed = feedparser.parse(feed.url)
        if not feed.title or not feed.title.strip():
            if parsed.feed and "title" in parsed.feed:
                feed.title = parsed.feed.title
            else:
                feed.title = feed.url
        if not icon_url:
            icon_url = rss_parser.extract_feed_icon(parsed, feed.url)
            
    if not icon_url:
        icon_url = get_feed_icon_url(None, feed.url)

    # Slumpa hämtningsintervall mellan 10 och 30 minuter om 60 minuter eller inget anges, för att sprida ut polling
    polling_interval = feed.polling_interval
    if not polling_interval or polling_interval == 60:
        import random
        polling_interval = random.randint(10, 30)

    db_feed = models.Feed(
        url=feed.url, 
        title=feed.title, 
        polling_interval=polling_interval, 
        scrape_enabled=int(feed.scrape_enabled), 
        include_in_dashboard=int(feed.include_in_dashboard), 
        notify_enabled=int(feed.notify_enabled), 
        icon_url=icon_url,
        user_id=current_user.id
    )
    db.add(db_feed)
    db.commit()
    db.refresh(db_feed)
    try:
        download_and_save_feed_icon_sync(db_feed)
    except Exception as icon_err:
        print(f"[ICONS] Kunde inte ladda ner ikon vid skapande av flöde #{db_feed.id}: {icon_err}", flush=True)

    # Convert integer to boolean for response
    db_feed.scrape_enabled = bool(db_feed.scrape_enabled)
    db_feed.include_in_dashboard = bool(db_feed.include_in_dashboard)
    db_feed.notify_enabled = bool(db_feed.notify_enabled)
    return db_feed

@app.put("/feeds/notifications/toggle-all", response_model=dict)
def toggle_all_feed_notifications(payload: dict, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    enabled = 1 if payload.get("notify_enabled", True) else 0
    if enabled == 1:
        # Om notiser slås på för samtliga: Spärra befintliga artiklar från att skicka retroaktiva notiser
        user_feed_ids = [f.id for f in db.query(models.Feed.id).filter(models.Feed.user_id == current_user.id).all()]
        if user_feed_ids:
            db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids)).update({models.Article.allow_push: 0}, synchronize_session=False)
            print(f"[FEED] Notiser aktiverade för alla flöden (användare #{current_user.id}). Befintliga artiklar spärrades från retroaktiva notiser.", flush=True)

    updated_count = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).update(
        {models.Feed.notify_enabled: enabled}, 
        synchronize_session=False
    )
    db.commit()
    return {"status": "ok", "notify_enabled": bool(enabled), "updated_count": updated_count}

@app.put("/feeds/{feed_id}", response_model=schemas.FeedResponse)
def update_feed(feed_id: int, feed: schemas.FeedCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_feed = db.query(models.Feed).filter(models.Feed.id == feed_id, models.Feed.user_id == current_user.id).first()
    if not db_feed:
        raise HTTPException(status_code=404, detail="Feed not found")
        
    was_disabled = (db_feed.include_in_dashboard == 0 or db_feed.notify_enabled == 0)
    now_enabled = (bool(feed.include_in_dashboard) and bool(feed.notify_enabled))

    # Om flödet eller dess notiser aktiveras: Spärra alla befintliga artiklar från att trigga retroaktiva pushnotiser
    if was_disabled and now_enabled:
        db.query(models.Article).filter(models.Article.feed_id == feed_id).update({models.Article.allow_push: 0}, synchronize_session=False)
        print(f"[FEED] Flöde #{feed_id} aktiverat. Alla befintliga artiklar spärrades från att skicka retroaktiva notiser.", flush=True)

    db_feed.url = feed.url
    db_feed.title = feed.title
    db_feed.polling_interval = feed.polling_interval
    db_feed.scrape_enabled = int(feed.scrape_enabled)
    db_feed.include_in_dashboard = int(feed.include_in_dashboard)
    db_feed.notify_enabled = int(feed.notify_enabled)
    db.commit()
    db.refresh(db_feed)
    db_feed.scrape_enabled = bool(db_feed.scrape_enabled)
    db_feed.include_in_dashboard = bool(db_feed.include_in_dashboard)
    db_feed.notify_enabled = bool(db_feed.notify_enabled)
    return db_feed

@app.delete("/feeds/{feed_id}", response_model=dict)
def delete_feed(feed_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id, models.Feed.user_id == current_user.id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    db.delete(feed)
    db.commit()
    delete_local_feed_icon(feed_id)
    return {"status": "ok"}

@app.get("/keywords", response_model=List[schemas.KeywordResponse])
def get_keywords(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Keyword).filter(models.Keyword.user_id == current_user.id).all()

@app.post("/keywords", response_model=schemas.KeywordResponse)
def create_keyword(keyword: schemas.KeywordCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_kw = models.Keyword(keyword=keyword.keyword, user_id=current_user.id)
    db.add(db_kw)
    db.commit()
    db.refresh(db_kw)
    return db_kw

@app.delete("/keywords/{keyword_id}", response_model=dict)
def delete_keyword(keyword_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    kw = db.query(models.Keyword).filter(models.Keyword.id == keyword_id, models.Keyword.user_id == current_user.id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="Keyword not found")
    db.delete(kw)
    db.commit()
    return {"status": "ok"}

import rss_parser
from typing import Optional
import xml.etree.ElementTree as ET
import os

@app.get("/opml-feeds")
def get_opml_feeds(current_user: models.User = Depends(auth.get_current_user)):
    opml_path = os.path.join(os.path.dirname(__file__), "svenska_rss.opml")
    feeds = []
    try:
        if os.path.exists(opml_path):
            tree = ET.parse(opml_path)
            root = tree.getroot()
            body = root.find("body")
            if body is not None:
                def parse_nodes(parent, current_category="Svensk press"):
                    for elem in parent.findall("outline"):
                        xml_url = elem.get("xmlUrl")
                        if xml_url:
                            cat = elem.get("category") or current_category
                            feeds.append({
                                "title": elem.get("text") or elem.get("title", ""),
                                "url": xml_url,
                                "description": elem.get("description", ""),
                                "category": cat
                            })
                        else:
                            cat_name = elem.get("text") or elem.get("title") or current_category
                            parse_nodes(elem, cat_name)
                parse_nodes(body)
            else:
                for outline in root.iter("outline"):
                    if outline.get("type") == "rss" or outline.get("xmlUrl"):
                        feeds.append({
                            "title": outline.get("text") or outline.get("title", ""),
                            "url": outline.get("xmlUrl", ""),
                            "description": outline.get("description", ""),
                            "category": outline.get("category", "")
                        })
    except Exception as e:
        print(f"Error parsing OPML: {e}")
    return feeds

@app.post("/feeds/batch")
def create_feeds_batch(payload: dict, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feeds_data = payload.get("feeds", [])
    if not feeds_data:
        return {"status": "ok", "added_count": 0}
    
    existing_urls = set(f.url for f in db.query(models.Feed.url).filter(models.Feed.user_id == current_user.id).all())
    added_count = 0
    
    for item in feeds_data:
        feed_url = (item.get("url") or "").strip()
        if not feed_url or feed_url in existing_urls:
            continue
        
        feed_title = (item.get("title") or "").strip() or feed_url
        icon_url = get_feed_icon_url(None, feed_url)
        
        # Slumpa intervall mellan 10 och 30 minuter så att inte alla flöden pollas samtidigt
        import random
        random_interval = random.randint(10, 30)

        db_feed = models.Feed(
            url=feed_url,
            title=feed_title,
            polling_interval=random_interval,
            scrape_enabled=1,
            include_in_dashboard=1,
            notify_enabled=1,
            icon_url=icon_url,
            user_id=current_user.id
        )
        db.add(db_feed)
        existing_urls.add(feed_url)
        added_count += 1
        
    if added_count > 0:
        db.commit()
        asyncio.create_task(asyncio.to_thread(ensure_all_feed_icons_cached))
        
    return {"status": "ok", "added_count": added_count}

@app.get("/preview-feed")
def preview_feed(url: str, current_user: models.User = Depends(auth.get_current_user)):
    import requests
    import feedparser
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=8)
        parsed = feedparser.parse(resp.content)
        
        articles = []
        for entry in parsed.entries[:5]:
            summary_raw = entry.get("summary") or entry.get("description") or ""
            # Enkel rensning av eventuell HTML i sammanfattningen
            import re
            clean_summary = re.sub('<[^<]+?>', '', summary_raw).strip()
            if len(clean_summary) > 220:
                clean_summary = clean_summary[:217] + "..."
                
            articles.append({
                "title": entry.get("title", "Ingen rubrik"),
                "link": entry.get("link", ""),
                "published": entry.get("published") or entry.get("updated") or "",
                "summary": clean_summary
            })
            
        feed_info = parsed.feed if hasattr(parsed, "feed") else {}
        return {
            "title": feed_info.get("title", "") if feed_info else "",
            "description": feed_info.get("description", "") if feed_info else "",
            "articles": articles
        }
    except Exception as e:
        return {"error": f"Kunde inte läsa flödet: {str(e)}", "articles": []}


@app.get("/dashboard-feeds", response_model=List[schemas.ArticleResponse])
def get_dashboard_feeds(
    feed_id: Optional[int] = None, 
    show_read: Optional[bool] = False, 
    search: Optional[str] = None, 
    article_id: Optional[int] = None,
    ai_mode: Optional[bool] = False,
    prio_only: Optional[bool] = False,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    cluster_mode: Optional[bool] = True,
    locked_only: Optional[bool] = False,
    liked_only: Optional[bool] = False,
    disliked_only: Optional[bool] = False,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    include_ai = bool(ai_mode or prio_only)
    query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == current_user.id)
    if article_id:
        query = query.filter(models.Article.id == article_id)
    else:
        if feed_id:
            query = query.filter(models.Article.feed_id == feed_id)
        elif not (locked_only or liked_only or disliked_only):
            query = query.filter(models.Feed.include_in_dashboard == 1)
            
        if locked_only:
            query = query.filter(models.Article.is_locked == 1)
        elif liked_only:
            query = query.filter(models.Article.user_vote == 1)
        elif disliked_only:
            query = query.filter(models.Article.user_vote == -1)
        elif not show_read:
            query = query.filter((models.Article.is_read == 0) | (models.Article.is_read == None))
            
        if prio_only:
            user_threshold = 75
            user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
            if user_ai and user_ai.prio_threshold:
                user_threshold = user_ai.prio_threshold

            query = query.filter(
                models.Article.ai_processed == 1,
                or_(models.Article.priority == 'high', models.Article.prio_score >= user_threshold)
            )

        if category and category.lower() != "alla":
            query = query.filter(models.Article.category == category)

        if tag and tag.strip():
            clean_tag = tag.strip()
            query = query.filter(models.Article.tags.ilike(f"%{clean_tag}%"))
            
        if search:
            if include_ai:
                query = query.filter(or_(
                    models.Article.title.ilike(f"%{search}%"), 
                    models.Article.summary.ilike(f"%{search}%"),
                    models.Article.ai_summary.ilike(f"%{search}%"),
                    models.Article.tags.ilike(f"%{search}%")
                ))
            else:
                query = query.filter(or_(
                    models.Article.title.ilike(f"%{search}%"), 
                    models.Article.summary.ilike(f"%{search}%")
                ))
        
    effective_ts = func.coalesce(func.nullif(models.Article.published_ts, 0), models.Article.received_ts)
    articles = query.order_by(effective_ts.desc(), models.Article.id.desc()).limit(150).all()
    
    # Bygg respons-artiklar
    response_items = []
    for art in articles:
        cats = art.categories.split(",") if art.categories else []
        
        parsed_tags = []
        if include_ai and art.tags:
            try:
                parsed_tags = json.loads(art.tags)
            except Exception:
                parsed_tags = []

        art_dict = {
            "id": art.id,
            "feed_id": art.feed_id,
            "guid": art.guid,
            "title": art.title,
            "link": art.link,
            "published": art.published,
            "published_ts": art.published_ts,
            "summary": art.summary,
            "image_url": art.image_url,
            "categories": cats,
            "source_title": art.feed.title or art.feed.url,
            "feed_icon": get_feed_icon_url(art.feed, art.link),
            "scrape_enabled": bool(art.feed.scrape_enabled),
            "received_ts": art.received_ts,
            "is_read": art.is_read or 0,
            "is_locked": art.is_locked or 0,
            "user_vote": art.user_vote or 0,
            # AI-fält levereras i AI-läget och PRIO-läget - Klassiskt läge förblir 100% rått och snabbt
            "ai_processed": art.ai_processed or 0 if include_ai else 0,
            "category": art.category if include_ai else None,
            "priority": art.priority if include_ai else None,
            "prio_score": art.prio_score or 0 if include_ai else 0,
            "prio_reason": art.prio_reason or "" if include_ai else "",
            "urgency_score": art.urgency_score if (include_ai and art.urgency_score is not None) else 5,
            "substance_score": art.substance_score if (include_ai and art.substance_score is not None) else 5,
            "ai_duration_s": round(art.ai_duration_s, 2) if (include_ai and art.ai_duration_s) else None,
            "ai_model": (getattr(art, "ai_model", "") or "google/gemma-4-12b-qat") if (include_ai and art.ai_processed) else "",
            "ai_summary": art.ai_summary if include_ai else None,
            "ai_short_summary": art.ai_short_summary if include_ai else None,
            "tags": parsed_tags if include_ai else [],
            "is_clickbait": art.is_clickbait or 0 if include_ai else 0,
            "clickbait_reason": art.clickbait_reason or "" if include_ai else "",
            "cluster_id": art.cluster_id,
            "cluster_size": 1,
            "similar_articles": [],
            "content": art.content
        }
        response_items.append(art_dict)
        
    if not cluster_mode:
        return response_items

    # Gruppera artiklar som ingår i samma kluster
    clusters: Dict[int, List[Dict[str, Any]]] = {}
    unclustered: List[Dict[str, Any]] = []

    for item in response_items:
        cid = item.get("cluster_id")
        if cid:
            if cid not in clusters:
                clusters[cid] = []
            clusters[cid].append(item)
        else:
            unclustered.append(item)

    final_items = []
    for cid, c_items in clusters.items():
        # Sortera i klustret: högst prio först, sedan nyast mottagen
        c_items.sort(key=lambda x: (x.get("prio_score", 0), x.get("received_ts", 0)), reverse=True)
        head = c_items[0]
        head_locs = ai_service.extract_article_locations(head.get("title", ""), head.get("ai_summary", ""), head.get("tags"))

        valid_c_items = [head]
        seen_feed_ids = {head.get("feed_id")}
        for other in c_items[1:]:
            other_locs = ai_service.extract_article_locations(other.get("title", ""), other.get("ai_summary", ""), other.get("tags"))
            if other.get("feed_id") in seen_feed_ids:
                # Samma källa har flera artiklar: bryt ut till eget kort så att de inte döljs bakom varandra
                other["cluster_id"] = None
                other["cluster_size"] = 1
                other["similar_articles"] = []
                unclustered.append(other)
            elif ai_service.has_location_conflict(head_locs, other_locs):
                # Geografisk konflikt: Bryt ut artikeln till separat händelse direkt i UI
                other["cluster_id"] = None
                other["cluster_size"] = 1
                other["similar_articles"] = []
                unclustered.append(other)
            else:
                valid_c_items.append(other)
                seen_feed_ids.add(other.get("feed_id"))

        head["cluster_size"] = len(valid_c_items)

        # Flerkällsbekräftelse på klusterhuvudet: om 2+ oberoende källor rapporterar
        if len(valid_c_items) >= 2 and head.get("prio_score", 0) < 100:
            c_bonus = 15 if len(valid_c_items) >= 3 else 10
            cur_reason = str(head.get("prio_reason", "") or "")
            if "flerkällsbekräftelse" not in cur_reason.lower() and "bevakningsord" not in cur_reason.lower():
                old_sc = head.get("prio_score", 0)
                new_sc = min(100, old_sc + c_bonus)
                head["prio_score"] = new_sc
                if new_sc >= 75:
                    head["priority"] = "high"
                sep = " | " if cur_reason else ""
                head["prio_reason"] = f"{cur_reason}{sep}+{c_bonus}p flerkällsbekräftelse ({len(valid_c_items)} källor)"
        similar = []
        for other in valid_c_items[1:]:
            similar.append({
                "id": other["id"],
                "feed_id": other["feed_id"],
                "title": other["title"],
                "source_title": other["source_title"],
                "feed_icon": other.get("feed_icon", ""),
                "link": other["link"],
                "published": other["published"],
                "published_ts": other["published_ts"],
                "is_read": other["is_read"]
            })
        head["similar_articles"] = similar
        final_items.append(head)

    final_items.extend(unclustered)
    final_items.sort(key=lambda x: (x.get("published_ts") or x.get("received_ts") or 0, x.get("id", 0)), reverse=True)
    return final_items

@app.post("/articles/cluster/{cluster_id}/read")
def mark_cluster_read(
    cluster_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Markerar samtliga artiklar som ingår i ett kluster som lästa."""
    arts = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.cluster_id == cluster_id
    ).all()
    
    updated_ids = []
    for a in arts:
        a.is_read = 1
        updated_ids.append(a.id)
    
    db.commit()
    return {"status": "ok", "cluster_id": cluster_id, "updated_count": len(updated_ids), "article_ids": updated_ids}

@app.get("/ai/digest", response_model=Optional[schemas.DailyDigestResponse])
def get_daily_digest(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Hämtar den senaste sparade dagliga briefingen."""
    return ai_service.get_latest_daily_digest(db, current_user.id)

@app.get("/ai/digests", response_model=List[schemas.DailyDigestResponse])
def get_daily_digests_history_endpoint(
    limit: int = 30,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Hämtar historik över tidigare sparade briefings."""
    return ai_service.get_daily_digests_history(db, current_user.id, limit=limit)

@app.post("/ai/digest/generate", response_model=schemas.DailyDigestResponse)
async def generate_daily_digest_endpoint(
    req: Optional[schemas.DigestGenerateRequest] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Genererar en färsk daglig briefing via LM Studio eller regelbaserad sammanställning."""
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    target_model = user_ai.selected_model if (user_ai and user_ai.selected_model) else None
    force_rule_based = bool(req and req.force_rule_based)
    
    digest = await asyncio.to_thread(
        ai_service.generate_daily_digest,
        db=db,
        user_id=current_user.id,
        model=target_model,
        force_rule_based=force_rule_based
    )
    return digest

@app.post("/articles/cluster/run")
async def trigger_batch_clustering(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Kör topic-klustring på oklustrade artiklar från de senaste 36 timmarna."""
    count = await asyncio.to_thread(ai_service.cluster_recent_unclustered_articles, db)
    return {"status": "ok", "clustered_count": count}


@app.post("/articles/{article_id}/analyze")
async def trigger_article_analysis(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    art = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
        
    cats = art.categories.split(",") if art.categories else []
    source = art.feed.title if art.feed else ""

    # Hämta användarens personliga AI-inställningar
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    user_cats = normalize_user_categories(user_ai.categories if user_ai else None)
    short_words = getattr(user_ai, "short_summary_max_words", 20) or 20
    short_sents = getattr(user_ai, "short_summary_max_sentences", 1) or 1
    user_prompt = ai_service.ensure_clickbait_in_prompt(
        user_ai.custom_system_prompt if user_ai else None, 
        categories=user_cats,
        short_summary_max_words=short_words,
        short_summary_max_sentences=short_sents
    )

    user_model = user_ai.selected_model if (user_ai and user_ai.selected_model) else None

    # Skrapa artikelns fulltext om tillgänglig och auto-skrapning är på
    if art.link and (not art.content or len(art.content.strip()) < 30):
        auto_scrape = bool(user_ai.auto_scrape_article_text if user_ai and user_ai.auto_scrape_article_text is not None else 1)
        feed_allows_scrape = bool(art.feed.scrape_enabled if art.feed and art.feed.scrape_enabled is not None else 1)
        if auto_scrape and feed_allows_scrape:
            scraped_text = await asyncio.to_thread(extract_clean_article_text, art.link, 8)
            if scraped_text and len(scraped_text.strip()) > 30:
                art.content = scraped_text
                db.commit()

    last_reported_pct = -1
    loop = asyncio.get_running_loop()

    def on_progress_sync(pct: int):
        nonlocal last_reported_pct
        if pct != last_reported_pct:
            last_reported_pct = pct
            asyncio.run_coroutine_threadsafe(
                manager.send_personal_message(f"AI_PROGRESS:{art.id}:{pct}", current_user.id),
                loop
            )

    await manager.send_personal_message(f"AI_PROGRESS:{art.id}:0", current_user.id)

    liked_tags, disliked_tags = get_user_interest_profile(db, current_user.id)

    analysis = await asyncio.to_thread(
        ai_service.analyze_article,
        title=art.title,
        summary=art.summary,
        source_title=source,
        categories=cats,
        custom_prompt=user_prompt,
        user_categories=user_cats,
        model_override=user_model,
        on_progress=on_progress_sync,
        liked_tags=liked_tags,
        disliked_tags=disliked_tags,
        short_summary_max_words=short_words,
        short_summary_max_sentences=short_sents
    )
    if not analysis:
        raise HTTPException(status_code=502, detail="LM Studio svarade inte eller kunde inte analysera artikeln.")
        
    art.ai_processed = 1
    art.category = analysis.get("category", "Övrigt")
    art.priority = analysis.get("priority", "low")
    art.prio_score = analysis.get("prio_score", 10)
    art.prio_reason = analysis.get("prio_reason", "")
    art.urgency_score = analysis.get("urgency_score", 5)
    art.substance_score = analysis.get("substance_score", 5)
    art.ai_summary = analysis.get("ai_summary", "")
    art.ai_short_summary = analysis.get("ai_short_summary", "")
    art.tags = json.dumps(analysis.get("tags", []), ensure_ascii=False)
    art.is_clickbait = analysis.get("is_clickbait", 0)
    art.clickbait_reason = analysis.get("clickbait_reason", "")
    art.ai_duration_s = analysis.get("duration_s", 0.0)
    art.ai_model = analysis.get("ai_model") or user_model or ai_service.get_active_model()

    # STEG 1: Specifika bevakningsord (trumfar allt -> 100p & HIGH)
    user_keywords = db.query(models.Keyword).filter(models.Keyword.user_id == current_user.id).all()
    text_to_check = f"{art.title or ''} {art.summary or ''}".lower()
    matched_kw = [kw.keyword for kw in user_keywords if kw.keyword and kw.keyword.lower() in text_to_check]
    if matched_kw:
        art.priority = "high"
        art.prio_score = 100
        kw_str = ", ".join(matched_kw)
        art.prio_reason = f"Träff på bevakningsord: {kw_str}"

    db.commit()

    # Uppdatera även semantisk embedding via LM Studio
    try:
        summary_text = art.ai_summary or art.summary or ""
        asyncio.create_task(asyncio.to_thread(
            safe_bg_save_embedding,
            art.id,
            art.title,
            summary_text
        ))
    except Exception:
        pass

    # Bygg komplett artikelobjekt för omedelbar frontend-synkronisering
    parsed_tags = []
    if art.tags:
        try:
            parsed_tags = json.loads(art.tags)
        except Exception:
            parsed_tags = []

    art_dict = {
        "id": art.id,
        "feed_id": art.feed_id,
        "guid": art.guid,
        "title": art.title,
        "link": art.link,
        "published": art.published,
        "published_ts": art.published_ts,
        "summary": art.summary,
        "image_url": art.image_url,
        "categories": cats,
        "source_title": source,
        "feed_icon": get_feed_icon_url(art.feed, art.link) if art.feed else "",
        "scrape_enabled": bool(art.feed.scrape_enabled) if art.feed else False,
        "received_ts": art.received_ts,
        "is_read": art.is_read or 0,
        "is_locked": art.is_locked or 0,
        "user_vote": art.user_vote or 0,
        "ai_processed": 1,
        "category": art.category,
        "priority": art.priority,
        "prio_score": art.prio_score or 0,
        "prio_reason": art.prio_reason or "",
        "urgency_score": art.urgency_score if art.urgency_score is not None else 5,
        "substance_score": art.substance_score if art.substance_score is not None else 5,
        "ai_duration_s": round(art.ai_duration_s, 2) if art.ai_duration_s else None,
        "ai_model": art.ai_model or ai_service.get_active_model(),
        "ai_summary": art.ai_summary,
        "ai_short_summary": art.ai_short_summary,
        "tags": parsed_tags,
        "is_clickbait": art.is_clickbait or 0,
        "clickbait_reason": art.clickbait_reason or "",
        "cluster_id": art.cluster_id,
        "cluster_size": 1,
        "similar_articles": [],
        "content": art.content
    }

    # Skicka WebSocket-uppdateringar till klienten
    await manager.send_personal_message(f"AI_UPDATED:{art.id}", current_user.id)
    await manager.send_personal_message("STATS_UPDATE", current_user.id)

    return {"status": "ok", "article_id": art.id, "article": art_dict, "analysis": analysis}

@app.post("/articles/{article_id}/prioritize")
async def prioritize_article(
    article_id: int,
    req: schemas.ArticlePrioritizeRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    art = db.query(models.Article).join(models.Feed).filter(
        models.Article.id == article_id,
        models.Feed.user_id == current_user.id
    ).first()
    if not art:
        raise HTTPException(status_code=404, detail="Artikeln hittades inte.")

    topic_clean = req.topic.strip() if req.topic else ""

    # Uppdatera artikelprioritering
    art.priority = "high"
    art.prio_score = 100
    art.ai_processed = 1
    if topic_clean:
        art.prio_reason = f"Prioriterad av användaren: {topic_clean}"
    else:
        art.prio_reason = "Manuellt prioriterad av användaren"

    # Om ett ämne angavs, uppdatera användarens AI-inställningar (prio_rules) och anpassat system prompt
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai:
        user_ai = models.UserAISettings(
            user_id=current_user.id,
            prio_rules=f"- {topic_clean}" if topic_clean else "",
            prio_threshold=75,
            prio_enabled=0
        )
        db.add(user_ai)

    if topic_clean:
        existing_rules = user_ai.prio_rules.strip() if user_ai.prio_rules else ""
        if topic_clean.lower() not in existing_rules.lower():
            if existing_rules:
                user_ai.prio_rules = f"{existing_rules}\n- {topic_clean}"
            else:
                user_ai.prio_rules = f"- {topic_clean}"

        parsed_cats = ["Teknik", "Ekonomi", "Politik", "Säkerhet", "Vetenskap", "Kultur", "Sport", "Övrigt"]
        if user_ai.categories:
            try:
                parsed_cats = json.loads(user_ai.categories)
            except Exception:
                pass

        user_ai.custom_system_prompt = ai_service.build_user_prompt(
            categories=parsed_cats,
            prio_rules=user_ai.prio_rules,
            exclude_rules=user_ai.exclude_rules or "",
            prio_threshold=user_ai.prio_threshold or 75
        )

        # Lägg även till som sökbart bevakningsord om valt
        if req.add_as_keyword:
            existing_kw = db.query(models.Keyword).filter(
                models.Keyword.user_id == current_user.id,
                models.Keyword.keyword.ilike(topic_clean)
            ).first()
            if not existing_kw:
                new_kw = models.Keyword(keyword=topic_clean, user_id=current_user.id)
                db.add(new_kw)

    db.commit()

    # Skicka WebSocket-uppdateringar till klienten
    await manager.send_personal_message(f"AI_UPDATED:{art.id}", current_user.id)
    await manager.send_personal_message("STATS_UPDATE", current_user.id)

    return {
        "status": "ok",
        "article_id": art.id,
        "priority": art.priority,
        "prio_score": art.prio_score,
        "prio_reason": art.prio_reason,
        "topic_added": bool(topic_clean)
    }

@app.get("/prio/unread-count")
def get_prio_unread_count(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai or not user_ai.prio_enabled:
        return {"unread_count": 0}

    threshold = user_ai.prio_threshold or 75

    count = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.ai_processed == 1,
        or_(models.Article.priority == 'high', models.Article.prio_score >= threshold),
        (models.Article.is_read == 0) | (models.Article.is_read == None)
    ).count()
    return {"unread_count": count}

@app.get("/ai/config", response_model=schemas.AIConfigResponse)
def get_ai_config(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    
    available_models = ai_service.get_available_models()
    if not user_ai:
        cats = normalize_user_categories(None)
        return schemas.AIConfigResponse(
            prio_rules="",
            exclude_rules="",
            categories=cats,
            prio_threshold=75,
            system_prompt=ai_service.build_user_prompt(categories=cats),
            onboarding_completed=False,
            prio_enabled=False,
            prio_notify_only=False,
            lm_studio_url=ai_service.LM_STUDIO_URL,
            lm_studio_model="",
            available_models=available_models,
            is_healthy=ai_service.check_lm_studio_health(),
            push_include_title=True,
            push_include_image=True,
            push_include_summary=True,
            push_summary_type="short",
            short_summary_max_words=20,
            short_summary_max_sentences=1,
            auto_purge_enabled=True,
            auto_purge_days=30,
            auto_scrape_article_text=True,
            notify_ai_offline=True
        )
        
    cats = normalize_user_categories(user_ai.categories)
    s_words = int(getattr(user_ai, "short_summary_max_words", 20) or 20)
    s_sents = int(getattr(user_ai, "short_summary_max_sentences", 1) or 1)

    prompt = ai_service.ensure_clickbait_in_prompt(
        user_ai.custom_system_prompt, 
        categories=cats,
        short_summary_max_words=s_words,
        short_summary_max_sentences=s_sents
    )
    if user_ai.custom_system_prompt != prompt:
        user_ai.custom_system_prompt = prompt
        db.commit()

    return schemas.AIConfigResponse(
        prio_rules=user_ai.prio_rules or "",
        exclude_rules=user_ai.exclude_rules or "",
        categories=cats,
        prio_threshold=user_ai.prio_threshold or 75,
        system_prompt=prompt,
        onboarding_completed=bool(user_ai.onboarding_completed),
        prio_enabled=bool(user_ai.prio_enabled),
        prio_notify_only=bool(user_ai.prio_notify_only),
        lm_studio_url=ai_service.LM_STUDIO_URL,
        lm_studio_model=user_ai.selected_model or "",
        available_models=available_models,
        is_healthy=ai_service.check_lm_studio_health(),
        push_include_title=bool(user_ai.push_include_title if user_ai.push_include_title is not None else 1),
        push_include_image=bool(user_ai.push_include_image if user_ai.push_include_image is not None else 1),
        push_include_summary=bool(user_ai.push_include_summary if user_ai.push_include_summary is not None else 1),
        push_summary_type=getattr(user_ai, "push_summary_type", "short") or "short",
        short_summary_max_words=s_words,
        short_summary_max_sentences=s_sents,
        auto_purge_enabled=bool(user_ai.auto_purge_enabled if user_ai.auto_purge_enabled is not None else 1),
        auto_purge_days=int(user_ai.auto_purge_days or 30),
        auto_scrape_article_text=bool(user_ai.auto_scrape_article_text if user_ai.auto_scrape_article_text is not None else 1),
        max_article_age_hours=int(user_ai.max_article_age_hours or 24),
        notify_ai_offline=bool(user_ai.notify_ai_offline if user_ai.notify_ai_offline is not None else 1)
    )

@app.get("/ai/models")
def get_ai_models(refresh: bool = False, current_user: models.User = Depends(auth.get_current_user)):
    models_list = ai_service.get_available_models(force_refresh=refresh)
    return {
        "models": models_list,
        "active_model": ai_service.get_active_model(),
        "is_healthy": ai_service.check_lm_studio_health(force_refresh=refresh)
    }

@app.put("/ai/config", response_model=schemas.AIConfigResponse)
def update_ai_config(
    config: schemas.AIConfigUpdate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai:
        user_ai = models.UserAISettings(user_id=current_user.id)
        db.add(user_ai)

    if config.prio_enabled is not None:
        user_ai.prio_enabled = 1 if config.prio_enabled else 0
    if config.prio_notify_only is not None:
        user_ai.prio_notify_only = 1 if config.prio_notify_only else 0
    if config.prio_rules is not None:
        user_ai.prio_rules = config.prio_rules.strip()
    if config.exclude_rules is not None:
        user_ai.exclude_rules = config.exclude_rules.strip()
    if config.categories is not None:
        norm_cats = normalize_user_categories(config.categories)
        user_ai.categories = json.dumps(norm_cats, ensure_ascii=False)
    if config.prio_threshold is not None:
        user_ai.prio_threshold = max(50, min(95, config.prio_threshold))
    if config.onboarding_completed is not None:
        user_ai.onboarding_completed = 1 if config.onboarding_completed else 0
    if config.lm_studio_model is not None:
        user_ai.selected_model = config.lm_studio_model.strip()

    if config.push_include_title is not None:
        user_ai.push_include_title = 1 if config.push_include_title else 0
    if config.push_include_image is not None:
        user_ai.push_include_image = 1 if config.push_include_image else 0
    if config.push_include_summary is not None:
        user_ai.push_include_summary = 1 if config.push_include_summary else 0
    if config.push_summary_type is not None:
        user_ai.push_summary_type = config.push_summary_type if config.push_summary_type in ("short", "full") else "short"
    if config.short_summary_max_words is not None:
        user_ai.short_summary_max_words = max(5, min(100, int(config.short_summary_max_words)))
    if config.short_summary_max_sentences is not None:
        user_ai.short_summary_max_sentences = max(1, min(3, int(config.short_summary_max_sentences)))
    if config.auto_purge_enabled is not None:
        user_ai.auto_purge_enabled = 1 if config.auto_purge_enabled else 0
    if config.auto_purge_days is not None:
        user_ai.auto_purge_days = max(1, min(365, config.auto_purge_days))
    if config.auto_scrape_article_text is not None:
        user_ai.auto_scrape_article_text = 1 if config.auto_scrape_article_text else 0
    if config.max_article_age_hours is not None:
        user_ai.max_article_age_hours = max(1, min(168, config.max_article_age_hours))
    if config.notify_ai_offline is not None:
        user_ai.notify_ai_offline = 1 if config.notify_ai_offline else 0

    cats = normalize_user_categories(user_ai.categories)
    s_words = int(getattr(user_ai, "short_summary_max_words", 20) or 20)
    s_sents = int(getattr(user_ai, "short_summary_max_sentences", 1) or 1)

    if config.system_prompt and config.system_prompt.strip():
        user_ai.custom_system_prompt = config.system_prompt.strip()
    else:
        # Generera prompt från de uppdaterade reglerna och kategorierna
        user_ai.custom_system_prompt = ai_service.build_user_prompt(
            categories=cats,
            prio_rules=user_ai.prio_rules,
            exclude_rules=user_ai.exclude_rules,
            prio_threshold=user_ai.prio_threshold or 75,
            short_summary_max_words=s_words,
            short_summary_max_sentences=s_sents
        )

    db.commit()
    db.refresh(user_ai)

    available_models = ai_service.get_available_models()
    return schemas.AIConfigResponse(
        prio_rules=user_ai.prio_rules or "",
        exclude_rules=user_ai.exclude_rules or "",
        categories=cats,
        prio_threshold=user_ai.prio_threshold or 75,
        system_prompt=user_ai.custom_system_prompt or "",
        onboarding_completed=bool(user_ai.onboarding_completed),
        prio_enabled=bool(user_ai.prio_enabled),
        prio_notify_only=bool(user_ai.prio_notify_only),
        lm_studio_url=ai_service.LM_STUDIO_URL,
        lm_studio_model=user_ai.selected_model or "",
        available_models=available_models,
        is_healthy=ai_service.check_lm_studio_health(),
        push_include_title=bool(user_ai.push_include_title if user_ai.push_include_title is not None else 1),
        push_include_image=bool(user_ai.push_include_image if user_ai.push_include_image is not None else 1),
        push_include_summary=bool(user_ai.push_include_summary if user_ai.push_include_summary is not None else 1),
        push_summary_type=getattr(user_ai, "push_summary_type", "short") or "short",
        short_summary_max_words=s_words,
        short_summary_max_sentences=s_sents,
        auto_purge_enabled=bool(user_ai.auto_purge_enabled if user_ai.auto_purge_enabled is not None else 1),
        auto_purge_days=int(user_ai.auto_purge_days or 30),
        auto_scrape_article_text=bool(user_ai.auto_scrape_article_text if user_ai.auto_scrape_article_text is not None else 1),
        max_article_age_hours=int(user_ai.max_article_age_hours or 24),
        notify_ai_offline=bool(user_ai.notify_ai_offline if user_ai.notify_ai_offline is not None else 1)
    )

@app.get("/scrape")
def scrape_article(
    url: str, 
    feed_name: Optional[str] = None, 
    db: Session = Depends(database.get_db), 
    current_username: str = Depends(auth.get_current_username)
):
    art = db.query(models.Article).filter(models.Article.link == url).first()
    # Om artikeln redan har sparad brödtext i databasen, returnera den direkt utan nätverksanrop
    if art and art.content and len(art.content.strip()) > 30:
        return {"content": art.content}

    display_name = feed_name.strip() if (feed_name and feed_name.strip()) else None
    if not display_name and art and art.feed:
        display_name = art.feed.title or art.feed.url
            
    name_str = display_name if display_name else "Okänt flöde"
    print(f"Scraping started for feed: {name_str}", flush=True)
    
    extracted = extract_clean_article_text(url, timeout=10)
    if extracted:
        if art:
            try:
                art.content = extracted
                db.commit()
            except Exception:
                pass
        return {"content": extracted}

    return {"content": "Could not extract article text from this page."}

from pywebpush import webpush, WebPushException
@app.get("/push/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": VAPID_KEYS["public_key"]}

@app.post("/push/subscribe", response_model=dict)
def subscribe_push(
    sub: schemas.PushSubscriptionCreate, 
    request: Request,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    user_agent = request.headers.get("user-agent", "")
    now_ts = int(time.time())
    dev_name = parse_device_name(user_agent)
    device_id = (sub.device_id or "").strip()
    if not device_id:
        device_id = request.headers.get("x-device-id", "").strip()

    # 1. Sök efter befintlig prenumeration via device_id (för samma användare)
    existing = None
    if device_id:
        existing = db.query(models.PushSubscription).filter(
            models.PushSubscription.user_id == current_user.id,
            models.PushSubscription.device_id == device_id
        ).first()

    # 2. Om inte funnen via device_id, sök via exakt endpoint
    if not existing:
        existing = db.query(models.PushSubscription).filter(
            models.PushSubscription.endpoint == sub.endpoint
        ).first()

    if existing:
        existing.user_id = current_user.id
        existing.endpoint = sub.endpoint
        existing.p256dh = sub.p256dh
        existing.auth = sub.auth
        existing.user_agent = user_agent
        if device_id:
            existing.device_id = device_id
        existing.updated_at = now_ts
        db.commit()
        active_sub_id = existing.id
        print(f"[Push] Uppdaterade prenumeration för enhet ({dev_name}, dev_id={device_id[:8] if device_id else 'n/a'}) för '{current_user.username}'", flush=True)
    else:
        db_sub = models.PushSubscription(
            endpoint=sub.endpoint,
            p256dh=sub.p256dh,
            auth=sub.auth,
            user_id=current_user.id,
            user_agent=user_agent,
            device_id=device_id,
            created_at=now_ts,
            updated_at=now_ts
        )
        db.add(db_sub)
        db.commit()
        active_sub_id = db_sub.id
        print(f"[Push] Registrerade ny prenumerationsenhet ({dev_name}, dev_id={device_id[:8] if device_id else 'n/a'}) för '{current_user.username}'", flush=True)

    # 3. Automatisk städning av dubbletter:
    # A) Om samma enhets-ID har andra rader
    if device_id:
        dup_devs = db.query(models.PushSubscription).filter(
            models.PushSubscription.user_id == current_user.id,
            models.PushSubscription.device_id == device_id,
            models.PushSubscription.id != active_sub_id
        ).all()
        for d in dup_devs:
            db.delete(d)
        if dup_devs:
            db.commit()

    # B) Om samma användare har ackumulerat många äldre registreringar med identisk user_agent
    # (städar automatiskt bort historiska dubbletter från samma webbläsare)
    if user_agent:
        ua_duplicates = db.query(models.PushSubscription).filter(
            models.PushSubscription.user_id == current_user.id,
            models.PushSubscription.user_agent == user_agent,
            models.PushSubscription.id != active_sub_id
        ).all()
        if ua_duplicates:
            for uad in ua_duplicates:
                db.delete(uad)
            db.commit()
            print(f"[Push] Automatisk sanering: rensade {len(ua_duplicates)} äldre dubblettregistreringar för ({dev_name})", flush=True)

    return {"status": "ok"}

@app.post("/push/unsubscribe", response_model=dict)
def unsubscribe_push(
    sub: schemas.PushSubscriptionCreate, 
    request: Request,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    device_id = (sub.device_id or "").strip() or request.headers.get("x-device-id", "").strip()
    existing = None
    if device_id:
        existing = db.query(models.PushSubscription).filter(
            models.PushSubscription.user_id == current_user.id,
            models.PushSubscription.device_id == device_id
        ).first()
    if not existing:
        existing = db.query(models.PushSubscription).filter(
            models.PushSubscription.endpoint == sub.endpoint,
            models.PushSubscription.user_id == current_user.id
        ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        print(f"[Push] Avregistrerade prenumerationsenhet för '{current_user.username}'", flush=True)
        
    return {"status": "ok"}

@app.get("/push/subscriptions", response_model=List[schemas.PushDeviceInfo])
def get_user_push_subscriptions(
    request: Request,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    current_ua = request.headers.get("user-agent", "")
    client_device_id = request.headers.get("x-device-id", "").strip()
    subs = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == current_user.id
    ).order_by(models.PushSubscription.updated_at.desc()).all()
    
    result = []
    for sub in subs:
        endpoint_snip = sub.endpoint[-28:] if sub.endpoint else "okänd"
        dev_title = parse_device_name(sub.user_agent)
        is_cur = False
        if client_device_id and sub.device_id:
            is_cur = bool(client_device_id == sub.device_id)
        elif current_ua and sub.user_agent and current_ua == sub.user_agent:
            is_cur = True

        result.append(schemas.PushDeviceInfo(
            id=sub.id,
            endpoint_snippet=endpoint_snip,
            device_name=dev_title,
            user_agent=sub.user_agent or "",
            device_id=sub.device_id or "",
            created_at=sub.created_at or 0,
            updated_at=sub.updated_at or 0,
            is_current=is_cur
        ))
    return result

@app.delete("/push/subscriptions/all", response_model=dict)
def delete_all_push_subscriptions(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    deleted_count = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == current_user.id).delete()
    db.commit()
    print(f"[Push] Raderade samtliga {deleted_count} push-prenumerationer för '{current_user.username}'", flush=True)
    return {"status": "ok", "deleted": deleted_count}

@app.delete("/push/subscriptions/{sub_id}", response_model=dict)
def delete_push_subscription(
    sub_id: int,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    sub = db.query(models.PushSubscription).filter(
        models.PushSubscription.id == sub_id,
        models.PushSubscription.user_id == current_user.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Prenumerationen hittades inte")
    db.delete(sub)
    db.commit()
    print(f"[Push] Raderade enhet #{sub_id} för '{current_user.username}'", flush=True)
    return {"status": "ok"}

class TestPushRequest(BaseModel):
    endpoint: Optional[str] = None

@app.post("/push/test", response_model=dict)
def test_push(req: Optional[TestPushRequest] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    subs = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == current_user.id).all()
    if not subs:
        raise HTTPException(status_code=400, detail="Ingen aktiv push-prenumeration hittades för denna användare.")
        
    push_res = send_push_notification_to_user(
        db=db,
        user_id=current_user.id,
        title="Testnotis från RSS-Bevakaren",
        body="Webb-pushnotiser fungerar som förväntat på denna enhet.",
        url="/",
        context="TestPush"
    )
    sent_count = push_res.get("delivered", 0) if isinstance(push_res, dict) else push_res
    return {"status": "ok", "sent": sent_count}

@app.get("/system/info")
def get_system_info(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_size = 0
    if os.path.exists("/data/rss.db"):
        db_size = os.path.getsize("/data/rss.db")
    elif os.path.exists("rss.db"):
        db_size = os.path.getsize("rss.db")
        
    total_feeds = db.query(models.Feed).count()
    total_articles = db.query(models.Article).count()
    
    return {
        "version": VERSION,
        "last_update": LAST_UPDATE,
        "database_size_bytes": db_size,
        "total_feeds": total_feeds,
        "total_articles": total_articles
    }

@app.get("/system/database-stats")
def get_database_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    from sqlalchemy import func
    
    try:
        db_size = 0
        db_path = ""
        candidates = ["/data/rss.db", "data/rss.db", "backend/rss.db", "rss.db"]
        db_url = os.environ.get("DATABASE_URL", "")
        if "sqlite" in db_url:
            candidates.insert(0, db_url.replace("sqlite:////", "/").replace("sqlite:///", ""))
        for p in candidates:
            if os.path.exists(p) and os.path.isfile(p):
                db_size = os.path.getsize(p)
                db_path = p
                break

        user_feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
        user_feed_ids = [f.id for f in user_feeds]
        
        if not user_feed_ids:
            return {
                "database_size_bytes": db_size,
                "database_path": db_path,
                "total_articles": 0,
                "read_articles": 0,
                "unread_articles": 0,
                "locked_articles": 0,
                "ai_processed_articles": 0,
                "clickbait_articles": 0,
                "articles_with_image": 0,
                "oldest_article": None,
                "newest_article": None,
                "total_feeds": 0,
                "active_feeds": 0,
                "notify_feeds": 0,
                "top_categories": []
            }

        total_articles = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids)).count()
        read_articles = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids), models.Article.is_read == 1).count()
        unread_articles = total_articles - read_articles
        locked_articles = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids), models.Article.is_locked == 1).count()
        ai_processed_articles = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids), models.Article.ai_processed == 1).count()
        clickbait_articles = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids), models.Article.is_clickbait == 1).count()
        articles_with_image = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids), models.Article.image_url.isnot(None), models.Article.image_url != "").count()
        
        oldest_article = None
        oldest = db.query(models.Article.id, models.Article.title, models.Article.received_ts, models.Article.published_ts)\
            .filter(models.Article.feed_id.in_(user_feed_ids), models.Article.received_ts > 0)\
            .order_by(models.Article.received_ts.asc()).first()
        if oldest:
            oldest_article = {
                "id": oldest.id,
                "title": oldest.title or "Untitled",
                "received_ts": oldest.received_ts,
                "published_ts": oldest.published_ts
            }

        newest_article = None
        newest = db.query(models.Article.id, models.Article.title, models.Article.received_ts, models.Article.published_ts)\
            .filter(models.Article.feed_id.in_(user_feed_ids), models.Article.received_ts > 0)\
            .order_by(models.Article.received_ts.desc()).first()
        if newest:
            newest_article = {
                "id": newest.id,
                "title": newest.title or "Untitled",
                "received_ts": newest.received_ts,
                "published_ts": newest.published_ts
            }

        total_feeds = len(user_feed_ids)
        active_feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id, models.Feed.include_in_dashboard == 1).count()
        notify_feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id, models.Feed.notify_enabled == 1).count()

        cat_counts = db.query(models.Article.category, func.count(models.Article.id))\
            .filter(models.Article.feed_id.in_(user_feed_ids))\
            .group_by(models.Article.category)\
            .order_by(func.count(models.Article.id).desc())\
            .limit(10).all()
            
        top_categories = [{"name": (row[0] or "Övrigt"), "count": row[1]} for row in cat_counts]

        return {
            "database_size_bytes": db_size,
            "database_path": db_path,
            "total_articles": total_articles,
            "read_articles": read_articles,
            "unread_articles": unread_articles,
            "locked_articles": locked_articles,
            "ai_processed_articles": ai_processed_articles,
            "clickbait_articles": clickbait_articles,
            "articles_with_image": articles_with_image,
            "oldest_article": oldest_article,
            "newest_article": newest_article,
            "total_feeds": total_feeds,
            "active_feeds": active_feeds,
            "notify_feeds": notify_feeds,
            "top_categories": top_categories
        }
    except Exception as e:
        print(f"[DB-STATS] Error generating database stats: {e}", flush=True)
        # Fallback till grundläggande data så endpointen inte kraschar med 500
        basic_count = db.query(models.Article).count()
        return {
            "database_size_bytes": 0,
            "database_path": "",
            "total_articles": basic_count,
            "read_articles": 0,
            "unread_articles": basic_count,
            "locked_articles": 0,
            "ai_processed_articles": 0,
            "clickbait_articles": 0,
            "articles_with_image": 0,
            "oldest_article": None,
            "newest_article": None,
            "total_feeds": db.query(models.Feed).filter(models.Feed.user_id == current_user.id).count(),
            "active_feeds": 0,
            "notify_feeds": 0,
            "top_categories": []
        }

@app.get("/analytics/sources")
def get_source_analytics(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Returnerar fördjupad statistik och volymdata per nyhetsflöde för inloggad användare:
    - Volym (totalt antal artiklar, olästa)
    - Senaste aktivitet (tidsstämpel och antal dagar sedan senaste mottagna artikel)
    - Inaktivitetsvarning (is_stale: true om flödet inte har tagit emot artiklar på över 7 dagar)
    - Kvalitetsradar (andel klickbete, andel prio-nyheter, genomsnittlig prio-poäng samt sammanvägt kvalitetsindex)
    """
    try:
        now_ts = int(time.time())
        feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
        if not feeds:
            return {
                "summary": {
                    "total_feeds": 0,
                    "total_articles": 0,
                    "stale_feeds_count": 0,
                    "avg_clickbait_pct": 0.0,
                    "avg_prio_pct": 0.0,
                    "most_active_source": None,
                    "least_active_source": None
                },
                "sources": []
            }

        sources = []
        total_all_articles = 0
        stale_count = 0
        total_clickbait_all = 0
        total_prio_all = 0

        for feed in feeds:
            art_stats = db.query(
                func.count(models.Article.id).label("total"),
                func.max(models.Article.received_ts).label("max_received"),
                func.sum(case((models.Article.is_clickbait == 1, 1), else_=0)).label("clickbait_cnt"),
                func.sum(case((or_(models.Article.priority == 'high', models.Article.prio_score >= 75), 1), else_=0)).label("prio_cnt"),
                func.avg(models.Article.prio_score).label("avg_prio"),
                func.sum(case(((models.Article.is_read == 0) | (models.Article.is_read == None), 1), else_=0)).label("unread_cnt")
            ).filter(models.Article.feed_id == feed.id).first()

            count = art_stats.total or 0
            max_rec = art_stats.max_received or 0
            cb_cnt = art_stats.clickbait_cnt or 0
            prio_cnt = art_stats.prio_cnt or 0
            avg_prio = round(float(art_stats.avg_prio or 0), 1)
            unread_cnt = art_stats.unread_cnt or 0

            days_since_last = None
            is_stale = False
            if max_rec > 0:
                diff_sec = max(0, now_ts - max_rec)
                days_since_last = round(diff_sec / 86400, 1)
                if diff_sec > (7 * 86400):
                    is_stale = True
            elif feed.last_polled and (now_ts - feed.last_polled > 86400):
                is_stale = True

            if is_stale:
                stale_count += 1

            cb_pct = round((cb_cnt / count * 100), 1) if count > 0 else 0.0
            prio_pct = round((prio_cnt / count * 100), 1) if count > 0 else 0.0

            # Kvalitetsindex (0-100):
            # Baslinje 60p, premiera hög andel prio (+0.4) och straffa klickbeten (-0.6)
            raw_quality = 60.0 + (prio_pct * 0.4) - (cb_pct * 0.6)
            quality_score = max(5, min(100, round(raw_quality, 1))) if count > 0 else 50.0

            sources.append({
                "id": feed.id,
                "title": feed.title or feed.url,
                "url": feed.url,
                "icon_url": get_feed_icon_url(feed),
                "total_articles": count,
                "unread_articles": unread_cnt,
                "last_polled": feed.last_polled,
                "last_article_ts": max_rec,
                "days_since_last_article": days_since_last,
                "is_stale": is_stale,
                "clickbait_count": cb_cnt,
                "clickbait_percentage": cb_pct,
                "prio_count": prio_cnt,
                "prio_percentage": prio_pct,
                "avg_prio_score": avg_prio,
                "quality_score": quality_score
            })

            total_all_articles += count
            total_clickbait_all += cb_cnt
            total_prio_all += prio_cnt

        sources.sort(key=lambda s: s["total_articles"], reverse=True)

        avg_cb_pct = round((total_clickbait_all / total_all_articles * 100), 1) if total_all_articles > 0 else 0.0
        avg_pr_pct = round((total_prio_all / total_all_articles * 100), 1) if total_all_articles > 0 else 0.0

        user_feed_ids = [f.id for f in feeds]

        # Kategoristatistik
        categories_stats = []
        if user_feed_ids:
            cat_rows = db.query(
                models.Article.category,
                func.count(models.Article.id).label("total"),
                func.sum(case(((models.Article.is_read == 0) | (models.Article.is_read == None), 1), else_=0)).label("unread_cnt"),
                func.sum(case((models.Article.is_clickbait == 1, 1), else_=0)).label("clickbait_cnt"),
                func.sum(case((or_(models.Article.priority == 'high', models.Article.prio_score >= 75), 1), else_=0)).label("prio_cnt")
            ).filter(models.Article.feed_id.in_(user_feed_ids))\
             .group_by(models.Article.category)\
             .order_by(func.count(models.Article.id).desc()).all()

            for row in cat_rows:
                c_name = (row[0] or "Övrigt").strip()
                c_total = row.total or 0
                c_unread = row.unread_cnt or 0
                c_cb = row.clickbait_cnt or 0
                c_prio = row.prio_cnt or 0
                c_pct = round((c_total / total_all_articles * 100), 1) if total_all_articles > 0 else 0.0
                cb_pct = round((c_cb / c_total * 100), 1) if c_total > 0 else 0.0
                prio_pct = round((c_prio / c_total * 100), 1) if c_total > 0 else 0.0
                categories_stats.append({
                    "name": c_name,
                    "total_articles": c_total,
                    "unread_articles": c_unread,
                    "clickbait_count": c_cb,
                    "clickbait_percentage": cb_pct,
                    "prio_count": c_prio,
                    "prio_percentage": prio_pct,
                    "percentage": c_pct
                })

        # Taggstatistik och trendande ämnesord med smart normalisering och aktualitetsviktning
        from collections import defaultdict
        tagged_articles_count = 0
        top_tags = []
        tag_summary = {
            "total_unique_tags": 0,
            "tagged_articles_count": 0
        }

        STOP_WORDS = {
            "nyheter", "nyhet", "sverige", "artikel", "inrikes", "utrikes", "expressen", "aftonbladet",
            "svt", "sr", "dn", "svd", "omni", "text", "senaste", "övrigt", "allmänt", "larm", "händelse",
            "rapport", "rubrik", "video", "bild", "just nu", "live", "direkt", "tv", "radio", "se"
        }
        UPPER_ACRONYMS = {
            "AI", "NATO", "USA", "EU", "SMHI", "MSB", "SD", "S", "M", "KD", "V", "L", "MP", "C",
            "FN", "WHO", "IMF", "PKK", "IDF", "BBC", "CNN", "LO", "TCO", "SACO", "SEB", "SHB"
        }

        if user_feed_ids:
            tag_rows = db.query(models.Article.tags, models.Article.received_ts, models.Article.feed_id).filter(
                models.Article.feed_id.in_(user_feed_ids),
                models.Article.tags.isnot(None),
                models.Article.tags != "[]",
                models.Article.tags != ""
            ).all()

            tag_data = defaultdict(lambda: {"total_count": 0, "recent_count": 0, "feed_ids": set()})

            for t_val, rec_ts, f_id in tag_rows:
                if not t_val:
                    continue
                found_tags = []
                try:
                    loaded = json.loads(t_val)
                    if isinstance(loaded, list):
                        found_tags = [str(x).strip() for x in loaded if str(x).strip()]
                except Exception:
                    found_tags = [str(x).strip() for x in t_val.split(",") if str(x).strip()]

                if found_tags:
                    tagged_articles_count += 1
                    is_recent = bool(rec_ts and (now_ts - rec_ts) <= (72 * 3600)) # Senaste 3 dygnen

                    for raw_t in found_tags:
                        clean = raw_t.strip().strip('"\'`#.,:;!?()[]{}').strip()
                        if len(clean) < 2 or clean.lower() in STOP_WORDS or clean.isdigit():
                            continue

                        # Normalisera format: Akronymer med versaler, annars Title Case
                        if clean.upper() in UPPER_ACRONYMS:
                            norm_name = clean.upper()
                        elif clean.isupper() and len(clean) <= 4:
                            norm_name = clean.upper()
                        else:
                            norm_name = clean[0].upper() + clean[1:].lower() if len(clean) > 1 else clean.upper()

                        tag_data[norm_name]["total_count"] += 1
                        if is_recent:
                            tag_data[norm_name]["recent_count"] += 1
                        if f_id:
                            tag_data[norm_name]["feed_ids"].add(f_id)

            tag_summary["total_unique_tags"] = len(tag_data)
            tag_summary["tagged_articles_count"] = tagged_articles_count

            # Sortera efter aktualitet och källspridning (trend-score)
            sorted_tags = sorted(
                tag_data.items(),
                key=lambda item: (
                    (item[1]["recent_count"] * 3.5) + (len(item[1]["feed_ids"]) * 2.0) + (item[1]["total_count"] * 0.4)
                ),
                reverse=True
            )

            for t_name, st in sorted_tags[:36]:
                tot_cnt = st["total_count"]
                rec_cnt = st["recent_count"]
                src_cnt = len(st["feed_ids"])
                is_hot = rec_cnt >= 2 or (rec_cnt >= 1 and src_cnt >= 2)
                top_tags.append({
                    "tag": t_name,
                    "count": tot_cnt,
                    "recent_count": rec_cnt,
                    "sources_count": src_cnt,
                    "is_hot": is_hot,
                    "percentage": round((tot_cnt / total_all_articles * 100), 1) if total_all_articles > 0 else 0.0
                })

        most_active = sources[0] if sources else None
        least_active = sources[-1] if sources else None

        return {
            "summary": {
                "total_feeds": len(feeds),
                "total_articles": total_all_articles,
                "stale_feeds_count": stale_count,
                "avg_clickbait_pct": avg_cb_pct,
                "avg_prio_pct": avg_pr_pct,
                "total_categories": len(categories_stats),
                "total_unique_tags": tag_summary["total_unique_tags"],
                "most_active_source": {
                    "title": most_active["title"],
                    "total_articles": most_active["total_articles"]
                } if most_active else None,
                "least_active_source": {
                    "title": least_active["title"],
                    "total_articles": least_active["total_articles"],
                    "is_stale": least_active["is_stale"],
                    "days_since_last_article": least_active["days_since_last_article"]
                } if least_active else None
            },
            "sources": sources,
            "categories": categories_stats,
            "tags": top_tags,
            "tag_summary": tag_summary
        }
    except Exception as e:
        print(f"[ANALYTICS] Fel vid generering av källstatistik: {e}", flush=True)
        return {
            "summary": {
                "total_feeds": 0,
                "total_articles": 0,
                "stale_feeds_count": 0,
                "avg_clickbait_pct": 0.0,
                "avg_prio_pct": 0.0,
                "total_categories": 0,
                "total_unique_tags": 0,
                "most_active_source": None,
                "least_active_source": None
            },
            "sources": [],
            "categories": [],
            "tags": [],
            "tag_summary": {
                "total_unique_tags": 0,
                "tagged_articles_count": 0
            }
        }

@app.post("/articles/{article_id}/read")
def mark_article_read(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if article:
        article.is_read = 1
        db.commit()
    return {"status": "ok"}

@app.post("/articles/read-all")
def mark_all_articles_read(
    feed_id: Optional[int] = None, 
    prio_only: Optional[bool] = False, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == current_user.id)
    if feed_id:
        query = query.filter(models.Feed.id == feed_id)
    else:
        query = query.filter(models.Feed.include_in_dashboard == 1)
        
    if prio_only:
        user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
        user_threshold = (user_ai.prio_threshold if (user_ai and user_ai.prio_threshold) else 75)
        query = query.filter(
            models.Article.ai_processed == 1,
            or_(models.Article.priority == 'high', models.Article.prio_score >= user_threshold)
        )

    articles = query.filter((models.Article.is_read == 0) | (models.Article.is_read == None)).all()
    for article in articles:
        article.is_read = 1
    db.commit()
    return {"status": "ok", "count": len(articles)}

@app.post("/articles/{article_id}/unread")
def mark_article_unread(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if article:
        article.is_read = 0
        db.commit()
    return {"status": "ok"}

@app.post("/articles/{article_id}/lock")
def lock_article(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if article:
        article.is_locked = 1
        db.commit()
    return {"status": "ok"}

@app.post("/articles/{article_id}/unlock")
def unlock_article(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if article:
        article.is_locked = 0
        db.commit()
    return {"status": "ok"}

@app.post("/articles/{article_id}/vote")
def vote_article(
    article_id: int, 
    payload: schemas.ArticleVoteRequest, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikeln hittades inte")
    
    vote_val = 1 if payload.vote > 0 else (-1 if payload.vote < 0 else 0)
    article.user_vote = vote_val
    db.commit()
    return {
        "status": "ok", 
        "article_id": article.id, 
        "user_vote": article.user_vote, 
        "is_locked": article.is_locked
    }

@app.post("/system/purge")
def purge_system(days: int = 30, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    cutoff_ts = int(time.time()) - (days * 24 * 60 * 60)
    query = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.received_ts < cutoff_ts,
        or_(models.Article.is_locked == 0, models.Article.is_locked == None)
    )
    count = query.count()
    if count > 0:
        article_ids = [a.id for a in query.all()]
        db.query(models.Article).filter(models.Article.id.in_(article_ids)).delete(synchronize_session=False)
        db.commit()
    return {"status": "ok", "deleted": count}

@app.post("/ai/chat", response_model=schemas.ChatResponse)
async def ai_chat_endpoint(
    req: schemas.ChatRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Meddelande kan inte vara tomt.")
    
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    model_override = user_ai.selected_model if user_ai and user_ai.selected_model else None

    hist_list = [{"role": h.role, "content": h.content} for h in (req.history or [])]

    result = ai_service.chat_with_news(
        user_id=current_user.id,
        message=req.message,
        history=hist_list,
        db=db,
        model_override=model_override
    )
    return schemas.ChatResponse(
        reply=result.get("reply", ""),
        sources=result.get("sources", []),
        model=result.get("model", ""),
        follow_ups=result.get("follow_ups", [])
    )

@app.post("/ai/chat/stream")
async def ai_chat_stream_endpoint(
    req: schemas.ChatRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Meddelande kan inte vara tomt.")

    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    model_override = user_ai.selected_model if user_ai and user_ai.selected_model else None
    hist_list = [{"role": h.role, "content": h.content} for h in (req.history or [])]

    return StreamingResponse(
        ai_service.stream_chat_with_news(
            user_id=current_user.id,
            message=req.message,
            history=hist_list,
            db=db,
            model_override=model_override
        ),
        media_type="text/event-stream"
    )

@app.get("/user/interest-profile")
def get_user_interest_profile_endpoint(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returnerar en fullständig analys av användarens adaptiva intresseprofil
    baserat på gillade och ogillade artiklar samt deras AI-genererade ämnestaggar och kategorier.
    """
    from collections import Counter
    liked_query = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.user_vote == 1
    ).order_by(models.Article.id.desc())

    disliked_query = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.user_vote == -1
    ).order_by(models.Article.id.desc())

    liked_articles = liked_query.limit(200).all()
    disliked_articles = disliked_query.limit(200).all()

    liked_total = liked_query.count()
    disliked_total = disliked_query.count()

    liked_tags_counter = Counter()
    disliked_tags_counter = Counter()
    liked_categories_counter = Counter()
    disliked_categories_counter = Counter()
    liked_sources_counter = Counter()

    def process_tags(articles, counter, cat_counter, src_counter=None):
        for art in articles:
            if art.category:
                cat_clean = art.category.strip()
                if cat_clean:
                    cat_counter[cat_clean] += 1
            if src_counter is not None and art.feed and art.feed.title:
                src_counter[art.feed.title] += 1

            if art.tags:
                try:
                    parsed = json.loads(art.tags) if isinstance(art.tags, str) else art.tags
                    if isinstance(parsed, list):
                        for t in parsed:
                            clean_t = str(t).strip().lower()
                            if clean_t and len(clean_t) >= 2:
                                counter[clean_t] += 1
                except Exception:
                    pass

    process_tags(liked_articles, liked_tags_counter, liked_categories_counter, liked_sources_counter)
    process_tags(disliked_articles, disliked_tags_counter, disliked_categories_counter)

    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    ignored_tags_list = []
    if user_ai and user_ai.ignored_disliked_tags:
        try:
            parsed_ig = json.loads(user_ai.ignored_disliked_tags) if isinstance(user_ai.ignored_disliked_tags, str) else user_ai.ignored_disliked_tags
            if isinstance(parsed_ig, list):
                ignored_tags_list = [str(t).strip().lower() for t in parsed_ig if t and str(t).strip()]
        except Exception:
            pass

    # Ignorerade ämnen kan aldrig ge ogillat-avdrag eller visas som dämpade
    for it in ignored_tags_list:
        if it in disliked_tags_counter:
            del disliked_tags_counter[it]

    # Gillade ämnen har alltid företräde; ett ämne man gillat kan aldrig ge ogillat-avdrag
    for lt in list(disliked_tags_counter.keys()):
        if lt in liked_tags_counter:
            del disliked_tags_counter[lt]

    max_liked = max(liked_tags_counter.values()) if liked_tags_counter else 1
    liked_tags_list = [
        {
            "tag": tag,
            "count": count,
            "strength": min(100, int(round((count / max_liked) * 100))),
            "bonus_p": min(20, count * 10)
        }
        for tag, count in liked_tags_counter.most_common(50)
    ]

    max_disliked = max(disliked_tags_counter.values()) if disliked_tags_counter else 1
    disliked_tags_list = [
        {
            "tag": tag,
            "count": count,
            "strength": min(100, int(round((count / max_disliked) * 100))),
            "active": count >= 2,
            "penalty_p": 15 if count >= 2 else 0
        }
        for tag, count in disliked_tags_counter.most_common(50)
    ]

    all_cats = set(liked_categories_counter.keys()) | set(disliked_categories_counter.keys())
    categories_breakdown = []
    for cat in sorted(all_cats):
        l_cnt = liked_categories_counter.get(cat, 0)
        d_cnt = disliked_categories_counter.get(cat, 0)
        total_votes = l_cnt + d_cnt
        ratio = round((l_cnt / total_votes) * 100) if total_votes > 0 else 50
        categories_breakdown.append({
            "category": cat,
            "liked_count": l_cnt,
            "disliked_count": d_cnt,
            "total": total_votes,
            "positivity_ratio": ratio
        })

    categories_breakdown.sort(key=lambda x: x["total"], reverse=True)

    top_sources = [
        {"source": src, "count": cnt}
        for src, cnt in liked_sources_counter.most_common(10)
    ]

    def format_recent(art_list):
        res = []
        for a in art_list[:5]:
            p_tags = []
            if a.tags:
                try:
                    p_tags = json.loads(a.tags) if isinstance(a.tags, str) else a.tags
                except Exception:
                    p_tags = []
            res.append({
                "id": a.id,
                "title": a.title or "Utan rubrik",
                "category": a.category or "Övrigt",
                "source": a.feed.title if a.feed else "",
                "tags": p_tags if isinstance(p_tags, list) else []
            })
        return res

    active_disliked_count = sum(1 for c in disliked_tags_counter.values() if c >= 2)

    return {
        "stats": {
            "total_liked": liked_total,
            "total_disliked": disliked_total,
            "unique_liked_tags": len(liked_tags_counter),
            "unique_disliked_tags": len(disliked_tags_counter),
            "active_disliked_tags": active_disliked_count,
            "ignored_tags_count": len(ignored_tags_list)
        },
        "liked_tags": liked_tags_list,
        "disliked_tags": disliked_tags_list,
        "ignored_tags": ignored_tags_list,
        "categories": categories_breakdown,
        "top_sources": top_sources,
        "recent_liked": format_recent(liked_articles),
        "recent_disliked": format_recent(disliked_articles)
    }

@app.post("/user/interest-profile/dismiss-tag")
def dismiss_interest_tag_endpoint(
    req: schemas.TagActionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Tar bort och vitlistar en tagg från dämpade ämnen."""
    clean_tag = req.tag.strip().lower()
    if not clean_tag:
        raise HTTPException(status_code=400, detail="Ogiltig tagg")

    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai:
        user_ai = models.UserAISettings(user_id=current_user.id)
        db.add(user_ai)

    current_ignored = []
    if user_ai.ignored_disliked_tags:
        try:
            parsed = json.loads(user_ai.ignored_disliked_tags) if isinstance(user_ai.ignored_disliked_tags, str) else user_ai.ignored_disliked_tags
            if isinstance(parsed, list):
                current_ignored = [str(t).strip().lower() for t in parsed if t and str(t).strip()]
        except Exception:
            current_ignored = []

    if clean_tag not in current_ignored:
        current_ignored.append(clean_tag)
        user_ai.ignored_disliked_tags = json.dumps(current_ignored)
        db.commit()

    return {"status": "ok", "tag": clean_tag, "ignored_tags": current_ignored}

@app.post("/user/interest-profile/unignore-tag")
def unignore_interest_tag_endpoint(
    req: schemas.TagActionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Återställer en tidigare borttagen tagg så den åter kan dämpas vid framtida ogillanden."""
    clean_tag = req.tag.strip().lower()
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if user_ai and user_ai.ignored_disliked_tags:
        try:
            parsed = json.loads(user_ai.ignored_disliked_tags) if isinstance(user_ai.ignored_disliked_tags, str) else user_ai.ignored_disliked_tags
            if isinstance(parsed, list) and clean_tag in parsed:
                parsed.remove(clean_tag)
                user_ai.ignored_disliked_tags = json.dumps(parsed)
                db.commit()
                return {"status": "ok", "tag": clean_tag, "ignored_tags": parsed}
        except Exception:
            pass
    return {"status": "ok", "tag": clean_tag}

@app.post("/user/interest-profile/reset")
def reset_user_interest_profile_endpoint(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Nollställer alla användarens röstade artiklar samt rensar borttagna taggar."""
    articles = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.user_vote != 0
    ).all()
    count = len(articles)
    for art in articles:
        art.user_vote = 0
    
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if user_ai:
        user_ai.ignored_disliked_tags = "[]"

    db.commit()
    return {"status": "ok", "cleared_votes": count}




