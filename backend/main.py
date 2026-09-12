from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse
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
                conn.execute(text("UPDATE user_ai_settings SET prio_enabled = 0 WHERE prio_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET prio_notify_only = 0 WHERE prio_notify_only IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_title = 1 WHERE push_include_title IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_image = 1 WHERE push_include_image IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_summary = 1 WHERE push_include_summary IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_enabled = 1 WHERE auto_purge_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_days = 30 WHERE auto_purge_days IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_scrape_article_text = 1 WHERE auto_scrape_article_text IS NULL"))
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
LAST_UPDATE = "2026-09-08"

def normalize_user_categories(cats_raw: Any) -> List[Dict[str, Any]]:
    """Säkerställer att kategorier returneras som en lista av dicts: [{'name': '...', 'weight': X}, ...]."""
    if not cats_raw:
        return list(ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS)
    
    parsed = cats_raw
    if isinstance(cats_raw, str):
        try:
            parsed = json.loads(cats_raw)
        except Exception:
            parsed = []
            
    if not parsed:
        return list(ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS)
        
    result = []
    default_map = {c["name"].lower(): c["weight"] for c in ai_service.DEFAULT_CATEGORIES_WITH_WEIGHTS}
    
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict) and "name" in item:
                name = str(item["name"]).strip()
                try:
                    w = int(item.get("weight", default_map.get(name.lower(), 5)))
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

def get_feed_icon_url(feed: Optional[models.Feed], link: Optional[str] = None) -> str:
    """Returnerar flödets sparade ikon eller genererar en automatisk favicon via Google service."""
    if feed and getattr(feed, "icon_url", None) and feed.icon_url.strip():
        return feed.icon_url.strip()
    target_url = (feed.url if feed and feed.url else "") or (link or "")
    if target_url:
        try:
            from urllib.parse import urlparse
            domain = urlparse(target_url).netloc
            if domain:
                return f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
        except Exception:
            pass
    return ""

def send_push_notification_to_user(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    url: str = "/",
    article_id: Optional[int] = None,
    image_url: Optional[str] = None,
    context: str = "Push",
    silent: bool = False
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

    for idx, sub in enumerate(subs, 1):
        dev_desc = parse_device_name(sub.user_agent)
        endpoint_snippet = sub.endpoint[-28:] if sub.endpoint else "okänd"
        
        try:
            payload = {
                "title": title,
                "body": body,
                "url": url or "/",
                "article_id": article_id,
                "icon": "/pwa-192x192.png?v=2026.09.09.03",
                "badge": "/badge.png?v=2026.09.09.03"
            }
            if image_url:
                payload["image"] = image_url

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
                    
                    for item in items:
                        # Use link or title as GUID if GUID is missing
                        guid = item.get("link") or item.get("title")
                        
                        # Check if article exists
                        existing = db.query(models.Article).filter(
                            models.Article.feed_id == feed.id,
                            models.Article.guid == guid
                        ).first()
                        
                        if not existing:
                            cat_str = ",".join(item.get("categories", []))
                            pub_ts = item.get("published_ts") or 0
                            
                            # Tyst initial inläsning och tidsfilter (> 2 timmar gammal = ingen push)
                            art_allow_push = 1
                            if is_initial_poll:
                                art_allow_push = 0
                            elif pub_ts > 0 and (current_time - pub_ts > 7200):
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

                        # Burst-skydd: Om fler än 2 artiklar i en och samma poll kvalificerar sig för push, begränsa till max 2 nyaste
                        if not is_initial_poll:
                            push_eligible = [a for a in new_articles if a.allow_push == 1]
                            if len(push_eligible) > 2:
                                for a in push_eligible[:-2]:
                                    a.allow_push = 0
                                db.commit()
                                print(f"[ANTI-BURST: {feed_username}] '{feed_title}': {len(push_eligible)} artiklar. Begränsar push till de 2 nyaste.", flush=True)

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
                                    if is_feed_notify == 1:
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
                                        send_push_notification_to_user(
                                            db=db,
                                            user_id=feed.user_id,
                                            title=notify_title,
                                            body=notify_body or "Ny artikel",
                                            url=art.link or "/",
                                            article_id=art.id,
                                            image_url=art.image_url,
                                            context="Rå-Push"
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

ai_wake_event = asyncio.Event()

async def ai_processing_loop():
    print("Background AI enrichment loop started", flush=True)
    # Vänta lite i början så appen och LM Studio hinner initialiseras
    await asyncio.sleep(5)
    
    while True:
        try:
            # Kontrollera om LM Studio är nåbart innan vi hämtar artiklar
            is_healthy = await asyncio.to_thread(ai_service.check_lm_studio_health)
            if not is_healthy:
                # Sov 30 sekunder om LM Studio är offline för att inte spamma loggar
                await asyncio.sleep(30)
                continue
                
            db = database.SessionLocal()
            try:
                max_age_hours = int(os.environ.get("AI_MAX_ARTICLE_AGE_HOURS", "24"))
                now = int(time.time())
                cutoff_ts = now - (max_age_hours * 3600)

                # 1. Arkivera/hoppa automatiskt över gamla artiklar (> max_age_hours) och artiklar som redan är lästa
                # så att LM Studio inte slösar tid och resurser på historisk backlog
                db.query(models.Article).filter(
                    or_(models.Article.ai_processed == 0, models.Article.ai_processed == None),
                    or_(
                        models.Article.received_ts < cutoff_ts,
                        models.Article.is_read == 1
                    )
                ).update({models.Article.ai_processed: 2}, synchronize_session=False)
                db.commit()

                # 2. Hämta endast färska, olästa artiklar från aktiva flöden som inkommit inom tidsfönstret
                unprocessed = db.query(models.Article).join(models.Feed).filter(
                    or_(models.Article.ai_processed == 0, models.Article.ai_processed == None),
                    models.Article.received_ts >= cutoff_ts,
                    or_(models.Article.is_read == 0, models.Article.is_read == None),
                    models.Feed.include_in_dashboard == 1
                ).order_by(models.Article.received_ts.desc()).limit(3).all()
                
                if not unprocessed:
                    db.close()
                    try:
                        await asyncio.wait_for(ai_wake_event.wait(), timeout=10.0)
                    except asyncio.TimeoutError:
                        pass
                    finally:
                        ai_wake_event.clear()
                    continue

                for art in unprocessed:
                    cats = art.categories.split(",") if art.categories else []
                    
                    # Hämta feed säkert och ta reda på användare och källa
                    feed_id = art.feed_id
                    feed_obj = db.query(models.Feed).filter(models.Feed.id == feed_id).first() if feed_id else None
                    source = feed_obj.title if (feed_obj and feed_obj.title) else ""
                    user_id = feed_obj.user_id if feed_obj else None
                    
                    user_prompt = None
                    user_cats = None
                    user_ai = None
                    if user_id:
                        user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == user_id).first()
                        # Om användaren inte har aktiverat PRIO-flödet, skippa AI-analys och spara resurser
                        if not user_ai or not user_ai.prio_enabled:
                            art.ai_processed = 1
                            db.commit()
                            continue

                        if user_ai:
                            user_cats = normalize_user_categories(user_ai.categories)
                            user_prompt = ai_service.ensure_clickbait_in_prompt(user_ai.custom_system_prompt, categories=user_cats)

                    user_model = user_ai.selected_model if (user_ai and user_ai.selected_model) else None
                    u_rec = db.query(models.User).filter(models.User.id == user_id).first() if user_id else None
                    u_display = u_rec.username if u_rec else f"user_{user_id}"
                    
                    loop = asyncio.get_running_loop()
                    last_reported_pct = -1

                    def on_progress_sync(pct: int):
                        nonlocal last_reported_pct
                        if pct != last_reported_pct:
                            last_reported_pct = pct
                            if user_id:
                                asyncio.run_coroutine_threadsafe(
                                    manager.send_personal_message(f"AI_PROGRESS:{art.id}:{pct}", user_id),
                                    loop
                                )

                    # Skicka start-progress (0%) direkt så UI visar aktiv progress
                    if user_id:
                        await manager.send_personal_message(f"AI_PROGRESS:{art.id}:0", user_id)

                    # Avgör om vi ska hämta och använda skrapad brödtext för djup AI-analys
                    article_text_for_ai = art.summary or ""
                    auto_scrape_active = (user_ai.auto_scrape_article_text != 0) if (user_ai and user_ai.auto_scrape_article_text is not None) else True
                    feed_allows_scrape = (feed_obj.scrape_enabled != 0) if (feed_obj and feed_obj.scrape_enabled is not None) else True

                    if auto_scrape_active and feed_allows_scrape and art.link:
                        scraped_text = art.content
                        if not scraped_text or len(scraped_text.strip()) < 30:
                            scraped_text = await asyncio.to_thread(extract_clean_article_text, art.link, 8)
                            if scraped_text and len(scraped_text.strip()) > 30:
                                art.content = scraped_text
                                db.commit()
                        if scraped_text and len(scraped_text.strip()) > 30:
                            # Använd de första 2500 tecknen så AI får hela händelsekontexten och fakta
                            article_text_for_ai = scraped_text[:2500]

                    analysis = await asyncio.to_thread(
                        ai_service.analyze_article,
                        title=art.title,
                        summary=article_text_for_ai,
                        source_title=source,
                        categories=cats,
                        custom_prompt=user_prompt,
                        user_categories=user_cats,
                        model_override=user_model,
                        on_progress=on_progress_sync
                    )
                    
                    if analysis:
                        art.ai_processed = 1
                        art.category = analysis.get("category", "Övrigt")
                        art.priority = analysis.get("priority", "low")
                        art.prio_score = analysis.get("prio_score", 10)
                        art.prio_reason = analysis.get("prio_reason", "")
                        art.ai_summary = analysis.get("ai_summary", "")
                        art.tags = json.dumps(analysis.get("tags", []), ensure_ascii=False)
                        art.is_clickbait = analysis.get("is_clickbait", 0)
                        art.clickbait_reason = analysis.get("clickbait_reason", "")
                        dur = analysis.get("duration_s", 0.0)
                        
                        # STEG 1: Specifika bevakningsord (trumfar allt -> 100p & HIGH)
                        matched_kw = []
                        if user_id:
                            user_keywords = db.query(models.Keyword).filter(models.Keyword.user_id == user_id).all()
                            text_to_check = f"{art.title or ''} {art.summary or ''}".lower()
                            matched_kw = [kw.keyword for kw in user_keywords if kw.keyword and kw.keyword.lower() in text_to_check]
                            if matched_kw:
                                art.priority = "high"
                                art.prio_score = 100
                                kw_str = ", ".join(matched_kw)
                                art.prio_reason = f"Träff på bevakningsord: {kw_str}"

                        db.commit()

                        # Generera semantisk embedding och utför Topic-klustring direkt så artikeln är klustrad i realtid
                        cluster_info_str = ""
                        try:
                            summary_text = art.ai_summary or art.summary or ""
                            await asyncio.to_thread(ai_service.save_article_embedding, art.id, art.title, summary_text, db)
                            cid, sim = await asyncio.to_thread(ai_service.find_or_create_article_cluster, art.id, db)
                            if cid and cid != art.id:
                                pct = int(round(sim * 100)) if sim else 100
                                cluster_info_str = f" | Kluster #{cid} ({pct}%)"
                        except Exception:
                            pass

                        # Avgör om pushnotis ska skickas för PRIO, bevakningsord eller flöde
                        should_send_push = False
                        push_title = ""
                        context_tag = "Push"
                        push_info = None

                        try:
                            feed_notify_setting = feed_obj.notify_enabled if (feed_obj and feed_obj.notify_enabled is not None) else 1
                            feed_notifs_on = (feed_notify_setting == 1)

                            threshold = (user_ai.prio_threshold if (user_ai and user_ai.prio_threshold) else 75)
                            is_prio = (art.priority and str(art.priority).lower() == "high") or ((art.prio_score or 0) >= threshold)

                            # Om notiser är avstängda för flödet eller artikeln är markerad som tyst/initial/gammal skickas inga notiser
                            if not feed_notifs_on:
                                should_send_push = False
                            elif getattr(art, 'allow_push', 1) == 0:
                                should_send_push = False
                            elif art.published_ts and (now - art.published_ts > 7200):
                                should_send_push = False
                            else:
                                inc_title = bool(user_ai.push_include_title if (user_ai and user_ai.push_include_title is not None) else 1)
                                inc_image = bool(user_ai.push_include_image if (user_ai and user_ai.push_include_image is not None) else 1)
                                inc_summary = bool(user_ai.push_include_summary if (user_ai and user_ai.push_include_summary is not None) else 1)

                                if matched_kw:
                                    should_send_push = True
                                    kw_str = ", ".join(matched_kw)
                                    push_title = f"Bevakningsord ({kw_str}): {art.title}" if inc_title else f"Bevakningsord ({kw_str})"
                                    context_tag = "Bevakningsord-Push"
                                elif user_ai and user_ai.prio_enabled and is_prio:
                                    should_send_push = True
                                    push_title = f"PRIO ({source or 'RSS'}): {art.title}" if inc_title else f"PRIO ({source or 'RSS'})"
                                    context_tag = "PRIO-Push"
                                elif user_ai and user_ai.prio_enabled and not user_ai.prio_notify_only:
                                    should_send_push = True
                                    push_title = f"{source or 'RSS'}: {art.title}" if inc_title else f"{source or 'RSS'}"
                                    context_tag = "Flöde-Push"
                                elif not user_ai or not user_ai.prio_enabled:
                                    should_send_push = True
                                    push_title = f"{source or 'RSS'}: {art.title}" if inc_title else f"{source or 'RSS'}"
                                    context_tag = "Flöde-Push"

                            if should_send_push and user_id:
                                push_body = (art.ai_summary or art.summary or art.title or "Ny artikel") if inc_summary else (art.summary or art.title or "Ny artikel")
                                push_img = art.image_url if inc_image else None
                                push_info = send_push_notification_to_user(
                                    db=db,
                                    user_id=user_id,
                                    title=push_title,
                                    body=push_body,
                                    url=art.link or "/",
                                    article_id=art.id,
                                    image_url=push_img,
                                    context=context_tag,
                                    silent=True
                                )
                        except Exception as push_err:
                            print(f"[Push: {u_display}] Fel vid hantering av push-notis för artikel {art.id}: {push_err}", flush=True)

                        # LOGGNING FÖR AI-ANALYS
                        prio_tag = " [PRIO]" if is_prio else ""
                        if should_send_push:
                            tag_name = "BEVAKNINGSORD" if matched_kw else "PRIO-NOTIS"
                            kw_info = f": {', '.join(matched_kw)}" if matched_kw else ""
                            
                            if push_info:
                                deliv_cnt = push_info.get("delivered", 0)
                                total_devs = push_info.get("total", 0)
                                sc = push_info.get("status_code", 200)
                                img_str = ", med bild" if art.image_url else ""
                                if total_devs == 0:
                                    deliv_str = "Inga aktiva enheter registrerade"
                                elif deliv_cnt > 0:
                                    deliv_str = f"Skickad till {deliv_cnt} enhet(er) (HTTP {sc}{img_str})"
                                else:
                                    err_summary = f" ({'; '.join(push_info.get('errors', []))})" if push_info.get("errors") else ""
                                    deliv_str = f"Misslyckades skicka till {total_devs} enhet(er){err_summary}"
                            else:
                                deliv_str = "Kunde inte skicka notis (användare saknas eller fel uppstod)"

                            print(
                                f"====================================================================\n"
                                f"[{tag_name}{kw_info}] Användare: {u_display} | Källa: {source or 'RSS'} | #{art.id}\n"
                                f"  Titel:    \"{art.title}\"\n"
                                f"  Analys:   {art.category} | {art.priority.upper()} ({art.prio_score}p){cluster_info_str} | Svarstid: {dur}s\n"
                                f"  Leverans: {deliv_str}\n"
                                f"====================================================================",
                                flush=True
                            )
                        else:
                            # Kompakt 1-raders format för vanliga artiklar
                            print(
                                f"[AI: {u_display}] {source or 'RSS'} #{art.id} | {art.category} | {art.priority.upper()} ({art.prio_score}p){prio_tag}{cluster_info_str} | {dur}s | \"{art.title}\"",
                                flush=True
                            )

                        # Publicera till MQTT (uppdaterar användarens flödestopic med AI-data och vid prio även användarens prio-topic)
                        try:
                            mqtt_service.publish_article(
                                article=art,
                                feed=feed_obj,
                                username=u_display,
                                user_id=user_id,
                                is_prio=is_prio,
                                matched_keywords=matched_kw,
                                is_update=True
                            )
                        except Exception as mqtt_err:
                            print(f"[MQTT: {u_display}] Fel vid publicering av berikad artikel {art.id}: {mqtt_err}", flush=True)

                        # Skicka WS-signal om AI-uppdatering till användaren
                        if user_id:
                            await manager.send_personal_message(f"AI_UPDATED:{art.id}", user_id)
                    else:
                        # Kontrollera om LM Studio är offline eller om det var fel på just denna artikel
                        is_online = await asyncio.to_thread(ai_service.check_lm_studio_health)
                        if not is_online:
                            print(f"[AI] LM Studio svarar inte (offline/pausar). Försöker igen senare för artikel {art.id}", flush=True)
                            await asyncio.sleep(10)
                            break
                        else:
                            # LM Studio är online men analysen kunde inte slutföras för denna artikel.
                            # Sätt standardvärden så att inte en enskild artikel blockerar hela kön i en oändlig loop.
                            print(f"[AI] Varning: Analys misslyckades för artikel {art.id}. Tilldelar standardvärden så kön inte blockeras.", flush=True)
                            art.ai_processed = 1
                            art.category = "Övrigt"
                            art.priority = "medium"
                            art.prio_score = 50
                            art.prio_reason = "Standardprioritering (AI-analys kunde inte slutföras)"
                            art.tags = "[]"
                            db.commit()
                        
                # 3. Bakgrundsvektorisering: Vektorisera färska artiklar som saknar embedding
                try:
                    missing_embs = db.query(models.Article).outerjoin(models.ArticleEmbedding).filter(
                        models.ArticleEmbedding.article_id == None,
                        models.Article.received_ts >= cutoff_ts
                    ).order_by(desc(models.Article.received_ts)).limit(15).all()
                    if missing_embs:
                        await asyncio.to_thread(ai_service.batch_embed_articles, missing_embs, db)
                except Exception as emb_err:
                    print(f"[AI Embeddings] Fel vid bakgrundsvektorisering: {emb_err}", flush=True)

            finally:
                db.close()
                
        except Exception as e:
            print(f"[AI] Fel i ai_processing_loop: {e}", flush=True)
            
        await asyncio.sleep(10)


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
            models.Article.received_ts > feed.last_viewed_ts,
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

    db_feed = models.Feed(
        url=feed.url, 
        title=feed.title, 
        polling_interval=feed.polling_interval, 
        scrape_enabled=int(feed.scrape_enabled), 
        include_in_dashboard=int(feed.include_in_dashboard), 
        notify_enabled=int(feed.notify_enabled), 
        icon_url=icon_url,
        user_id=current_user.id
    )
    db.add(db_feed)
    db.commit()
    db.refresh(db_feed)
    # Convert integer to boolean for response
    db_feed.scrape_enabled = bool(db_feed.scrape_enabled)
    db_feed.include_in_dashboard = bool(db_feed.include_in_dashboard)
    db_feed.notify_enabled = bool(db_feed.notify_enabled)
    return db_feed

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
            for outline in root.iter("outline"):
                if outline.get("type") == "rss":
                    feeds.append({
                        "title": outline.get("text") or outline.get("title", ""),
                        "url": outline.get("xmlUrl", ""),
                        "description": outline.get("description", "")
                    })
    except Exception as e:
        print(f"Error parsing OPML: {e}")
    return feeds

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
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    include_ai = bool(ai_mode or prio_only)
    query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == current_user.id)
    if article_id:
        query = query.filter(models.Article.id == article_id)
    else:
        if feed_id:
            query = query.filter(models.Feed.id == feed_id)
        else:
            query = query.filter(models.Feed.include_in_dashboard == 1)
            
        if not show_read:
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
        
    articles = query.order_by(models.Article.received_ts.desc()).limit(150).all()
    
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
            # AI-fält levereras i AI-läget och PRIO-läget - Klassiskt läge förblir 100% rått och snabbt
            "ai_processed": art.ai_processed or 0 if include_ai else 0,
            "category": art.category if include_ai else None,
            "priority": art.priority if include_ai else None,
            "prio_score": art.prio_score or 0 if include_ai else 0,
            "prio_reason": art.prio_reason or "" if include_ai else "",
            "ai_summary": art.ai_summary if include_ai else None,
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
        for other in c_items[1:]:
            other_locs = ai_service.extract_article_locations(other.get("title", ""), other.get("ai_summary", ""), other.get("tags"))
            if ai_service.has_location_conflict(head_locs, other_locs):
                # Geografisk konflikt: Bryt ut artikeln till separat händelse direkt i UI
                other["cluster_id"] = None
                other["cluster_size"] = 1
                other["similar_articles"] = []
                unclustered.append(other)
            else:
                valid_c_items.append(other)

        head["cluster_size"] = len(valid_c_items)
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
    final_items.sort(key=lambda x: x.get("received_ts", 0), reverse=True)
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
    user_prompt = ai_service.ensure_clickbait_in_prompt(user_ai.custom_system_prompt if user_ai else None, categories=user_cats)

    user_model = user_ai.selected_model if (user_ai and user_ai.selected_model) else None
    
    loop = asyncio.get_running_loop()
    last_reported_pct = -1

    def on_progress_sync(pct: int):
        nonlocal last_reported_pct
        if pct != last_reported_pct:
            last_reported_pct = pct
            asyncio.run_coroutine_threadsafe(
                manager.send_personal_message(f"AI_PROGRESS:{art.id}:{pct}", current_user.id),
                loop
            )

    await manager.send_personal_message(f"AI_PROGRESS:{art.id}:0", current_user.id)

    analysis = await asyncio.to_thread(
        ai_service.analyze_article,
        title=art.title,
        summary=art.summary,
        source_title=source,
        categories=cats,
        custom_prompt=user_prompt,
        user_categories=user_cats,
        model_override=user_model,
        on_progress=on_progress_sync
    )
    if not analysis:
        raise HTTPException(status_code=502, detail="LM Studio svarade inte eller kunde inte analysera artikeln.")
        
    art.ai_processed = 1
    art.category = analysis.get("category", "Övrigt")
    art.priority = analysis.get("priority", "low")
    art.prio_score = analysis.get("prio_score", 10)
    art.prio_reason = analysis.get("prio_reason", "")
    art.ai_summary = analysis.get("ai_summary", "")
    art.tags = json.dumps(analysis.get("tags", []), ensure_ascii=False)
    art.is_clickbait = analysis.get("is_clickbait", 0)
    art.clickbait_reason = analysis.get("clickbait_reason", "")

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

    return {"status": "ok", "article_id": art.id, "analysis": analysis}

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
            auto_purge_enabled=True,
            auto_purge_days=30,
            auto_scrape_article_text=True
        )
        
    cats = normalize_user_categories(user_ai.categories)

    prompt = ai_service.ensure_clickbait_in_prompt(user_ai.custom_system_prompt, categories=cats)
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
        auto_purge_enabled=bool(user_ai.auto_purge_enabled if user_ai.auto_purge_enabled is not None else 1),
        auto_purge_days=int(user_ai.auto_purge_days or 30),
        auto_scrape_article_text=bool(user_ai.auto_scrape_article_text if user_ai.auto_scrape_article_text is not None else 1)
    )

@app.get("/ai/models")
def get_ai_models(current_user: models.User = Depends(auth.get_current_user)):
    models_list = ai_service.get_available_models()
    return {
        "models": models_list,
        "active_model": ai_service.get_active_model(),
        "is_healthy": ai_service.check_lm_studio_health()
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
    if config.auto_purge_enabled is not None:
        user_ai.auto_purge_enabled = 1 if config.auto_purge_enabled else 0
    if config.auto_purge_days is not None:
        user_ai.auto_purge_days = max(1, min(365, config.auto_purge_days))
    if config.auto_scrape_article_text is not None:
        user_ai.auto_scrape_article_text = 1 if config.auto_scrape_article_text else 0

    cats = normalize_user_categories(user_ai.categories)

    if config.system_prompt and config.system_prompt.strip():
        user_ai.custom_system_prompt = config.system_prompt.strip()
    else:
        # Generera prompt från de uppdaterade reglerna och kategorierna
        user_ai.custom_system_prompt = ai_service.build_user_prompt(
            categories=cats,
            prio_rules=user_ai.prio_rules,
            exclude_rules=user_ai.exclude_rules,
            prio_threshold=user_ai.prio_threshold or 75
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
        auto_purge_enabled=bool(user_ai.auto_purge_enabled if user_ai.auto_purge_enabled is not None else 1),
        auto_purge_days=int(user_ai.auto_purge_days or 30),
        auto_scrape_article_text=bool(user_ai.auto_scrape_article_text if user_ai.auto_scrape_article_text is not None else 1)
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

        # Taggstatistik och trendande ämnesord
        from collections import Counter
        tag_counter = Counter()
        tagged_articles_count = 0
        top_tags = []
        tag_summary = {
            "total_unique_tags": 0,
            "tagged_articles_count": 0
        }

        if user_feed_ids:
            tag_rows = db.query(models.Article.tags).filter(
                models.Article.feed_id.in_(user_feed_ids),
                models.Article.tags.isnot(None),
                models.Article.tags != "[]",
                models.Article.tags != ""
            ).all()

            for (t_val,) in tag_rows:
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
                    for t in found_tags:
                        # Filtrera bort extremt korta eller brusiga taggar
                        if len(t) >= 2:
                            tag_counter[t] += 1

            tag_summary["total_unique_tags"] = len(tag_counter)
            tag_summary["tagged_articles_count"] = tagged_articles_count

            for t_name, cnt in tag_counter.most_common(60):
                top_tags.append({
                    "tag": t_name,
                    "count": cnt,
                    "percentage": round((cnt / total_all_articles * 100), 1) if total_all_articles > 0 else 0.0
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
def mark_all_articles_read(feed_id: Optional[int] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == current_user.id)
    if feed_id:
        query = query.filter(models.Feed.id == feed_id)
    else:
        query = query.filter(models.Feed.include_in_dashboard == 1)
        
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


