from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request, Response, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
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
import re
from datetime import datetime

_LOG_TAG_REGEX = re.compile(r"^\[([A-Za-z0-9_ :\-]+)\](?:\s+)?(.*)$", re.DOTALL)

_original_print = builtins.print
def _timestamped_print(*args, **kwargs):
    now_str = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]"
    if args and isinstance(args[0], str):
        first_arg = args[0]
        m = _LOG_TAG_REGEX.match(first_arg)
        if m:
            raw_tag = m.group(1).strip()
            rest = m.group(2)
            
            if raw_tag == "AI Embeddings":
                tag = "AI Embed"
            elif raw_tag == "AI Embeddings Fel":
                tag = "AI Embed Err"
            elif raw_tag == "AI Service Fel":
                tag = "AI Svc Err"
            elif ":" in raw_tag:
                prefix, _, user = raw_tag.partition(":")
                prefix = prefix.strip()
                user = user.strip()
                if prefix == "AI":
                    prefix = "AI  "
                tag = f"{prefix}: {user}"
            else:
                tag = raw_tag
            
            tag_padded = f"{tag:<12}"
            formatted_first = f"[{tag_padded}] {rest}" if rest else f"[{tag_padded}]"
            _original_print(now_str, formatted_first, *args[1:], **kwargs)
            return

    _original_print(now_str, *args, **kwargs)

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
        print(f"[SCRP: system] Kunde inte hämta artikeltext ({url}): {e}", flush=True)
        return None

models.Base.metadata.create_all(bind=database.engine)

def get_icons_dir() -> str:
    """Returnerar och säkerställer katalogen för lokala flödesikoner."""
    base = "/data/icons" if os.path.exists("/data") else os.path.join(os.getcwd(), "data", "icons")
    os.makedirs(base, exist_ok=True)
    return base

GENERIC_ICON_CDNS = [
    "google.", "gstatic.com", "wordpress.com", "wp.com", "feedburner.com",
    "ytimg.com", "cloudinary.com", "duckduckgo.com", "cloudfront.net", "fastly.net",
    "akamaihd.net", "twimg.com"
]

def clean_feed_domain(d: str) -> str:
    """Tar bort www och tekniska RSS-prefix såsom feeds, rss, feed etc."""
    if not d:
        return ""
    d = d.lower().replace("www.", "")
    import re
    return re.sub(r"^(feeds|feed|rss|syndication|xml|podcasts|podcast)\.", "", d)

def get_domain_stem(dom: str) -> str:
    """Extraherar domänens kärnnamn (t.ex. arstechnica från feeds.arstechnica.com eller bbc från feeds.bbci.co.uk)."""
    if not dom:
        return ""
    dom = clean_feed_domain(dom)
    parts = dom.split(".")
    if len(parts) >= 2:
        if parts[-2] in ("co", "com", "org", "edu", "gov", "net") and len(parts) >= 3:
            return parts[-3]
        return parts[-2]
    return parts[0]

def is_matching_icon_domain(feed_url: str, icon_url: str) -> bool:
    """Validerar att en ikon hör till samma flöde/organisation och inte är en felmatchad extern ikon."""
    if not feed_url or not icon_url:
        return True
    from urllib.parse import urlparse
    try:
        f_netloc = urlparse(feed_url).netloc.lower().replace("www.", "")
        i_netloc = urlparse(icon_url).netloc.lower().replace("www.", "")
        if not f_netloc or not i_netloc:
            return True
        if any(cdn in i_netloc for cdn in GENERIC_ICON_CDNS):
            return True
        f_clean = clean_feed_domain(f_netloc)
        i_clean = clean_feed_domain(i_netloc)
        if f_clean in i_clean or i_clean in f_clean:
            return True
        f_stem = get_domain_stem(f_netloc)
        if len(f_stem) >= 3 and f_stem in i_netloc:
            return True
        if "bbc" in f_netloc and "bbc" in i_netloc:
            return True
        return False
    except Exception:
        return True

def get_feed_domain_candidates(target_url: str, website_link: Optional[str] = None) -> list[str]:
    """Genererar prioriterade domännamn för favicon-sökning, strippat från RSS-underdomäner."""
    from urllib.parse import urlparse
    domains = []
    for u in [target_url, website_link]:
        if not u:
            continue
        try:
            raw_d = urlparse(u).netloc.lower().replace("www.", "")
            if raw_d:
                if raw_d not in domains:
                    domains.append(raw_d)
                clean_d = clean_feed_domain(raw_d)
                if clean_d and clean_d not in domains:
                    domains.append(clean_d)
                if "bbci.co.uk" in raw_d or "bbcimg.co.uk" in raw_d:
                    for bbc_d in ["bbc.co.uk", "bbc.com"]:
                        if bbc_d not in domains:
                            domains.append(bbc_d)
        except Exception:
            pass
    return domains

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
                if "ignored_liked_tags" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN ignored_liked_tags TEXT DEFAULT '[]'"))
                    conn.commit()
                    print("[DB] Added ignored_liked_tags column to user_ai_settings", flush=True)
                if "notify_ai_offline" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN notify_ai_offline INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added notify_ai_offline column to user_ai_settings", flush=True)
                if "push_summary_type" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN push_summary_type TEXT DEFAULT 'short'"))
                    conn.commit()
                    print("[DB] Added push_summary_type column to user_ai_settings", flush=True)
                if "short_summary_max_words" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN short_summary_max_words INTEGER DEFAULT 20"))
                    conn.commit()
                    print("[DB] Added short_summary_max_words column to user_ai_settings", flush=True)
                if "short_summary_max_sentences" not in cols:
                    conn.execute(text("ALTER TABLE user_ai_settings ADD COLUMN short_summary_max_sentences INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added short_summary_max_sentences column to user_ai_settings", flush=True)
                conn.execute(text("UPDATE user_ai_settings SET prio_enabled = 0 WHERE prio_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET prio_notify_only = 0 WHERE prio_notify_only IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_title = 1 WHERE push_include_title IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_image = 1 WHERE push_include_image IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_summary = 1 WHERE push_include_summary IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_enabled = 1 WHERE auto_purge_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_days = 30 WHERE auto_purge_days IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_scrape_article_text = 1 WHERE auto_scrape_article_text IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET max_article_age_hours = 24 WHERE max_article_age_hours IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET notify_ai_offline = 1 WHERE notify_ai_offline IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_summary_type = 'short' WHERE push_summary_type IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET short_summary_max_words = 20 WHERE short_summary_max_words IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET short_summary_max_sentences = 1 WHERE short_summary_max_sentences IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET ignored_disliked_tags = '[]' WHERE ignored_disliked_tags IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET ignored_liked_tags = '[]' WHERE ignored_liked_tags IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET custom_system_prompt = NULL WHERE custom_system_prompt IS NOT NULL AND custom_system_prompt NOT LIKE '%SAKLIGA NYHETER%'"))
                conn.execute(text("UPDATE user_ai_settings SET custom_system_prompt = REPLACE(custom_system_prompt, 'Max två korta', 'Max tre korta') WHERE custom_system_prompt LIKE '%Max två korta%'"))
                conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for user_ai_settings: {e}", flush=True)

        try:
            res_users = conn.execute(text("PRAGMA table_info(users)"))
            user_cols = [row[1] for row in res_users.fetchall()]
            if user_cols:
                if "is_admin" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"))
                    conn.commit()
                    print("[DB] Added is_admin column to users", flush=True)

                # Se till att användaren 'admin' eller första användaren får administratörsstatus
                conn.execute(text("UPDATE users SET is_admin = 1 WHERE lower(username) = 'admin'"))
                admin_count = conn.execute(text("SELECT COUNT(*) FROM users WHERE is_admin = 1")).scalar()
                if admin_count == 0:
                    conn.execute(text("UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users)"))
                conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for users: {e}", flush=True)

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

        # Rensa felaktigt läckta artiklar och deras embeddings orsakade av polling-buggen
        try:
            conn.execute(text("""
                DELETE FROM article_embeddings 
                WHERE article_id IN (
                    SELECT a.id FROM articles a
                    JOIN feeds f ON a.feed_id = f.id
                    WHERE a.link LIKE '%notateslaapp.com%' AND f.url NOT LIKE '%notateslaapp%'
                )
            """))
            clean_res = conn.execute(text("""
                DELETE FROM articles 
                WHERE id IN (
                    SELECT a.id FROM articles a
                    JOIN feeds f ON a.feed_id = f.id
                    WHERE a.link LIKE '%notateslaapp.com%' AND f.url NOT LIKE '%notateslaapp%'
                )
            """))
            conn.commit()
            if clean_res.rowcount and clean_res.rowcount > 0:
                print(f"[DB] Rensade bort {clean_res.rowcount} felaktigt korskopplade Tesla-artiklar.", flush=True)
        except Exception as e:
            print(f"[DB] Fel vid rensning av korskopplade artiklar: {e}", flush=True)

        # Rensa felaktiga korskopplade ikoner orsakade av tidigare polling-läckage
        try:
            icons_dir = get_icons_dir()
            res_feeds = conn.execute(text("SELECT id, url, icon_url FROM feeds")).fetchall()
            mismatched_ids = []
            for fid, f_url, f_icon in res_feeds:
                if f_icon and str(f_icon).strip() and f_url and str(f_url).strip():
                    try:
                        if not is_matching_icon_domain(str(f_url), str(f_icon)):
                            mismatched_ids.append(fid)
                    except Exception:
                        pass

            if mismatched_ids:
                print(f"[DB] Hittade {len(mismatched_ids)} flöden med felaktigt korskopplade ikoner. Nollställer och rensar cache...", flush=True)
                for fid in mismatched_ids:
                    conn.execute(text(f"UPDATE feeds SET icon_url = '' WHERE id = {fid}"))
                    icon_path = os.path.join(icons_dir, f"feed_{fid}.png")
                    if os.path.exists(icon_path):
                        try:
                            os.remove(icon_path)
                        except Exception:
                            pass
                conn.commit()
        except Exception as e:
            print(f"[DB] Fel vid automatisk sanering av flödesikoner: {e}", flush=True)

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
                if "clickbait_enabled" not in f_cols:
                    conn.execute(text("ALTER TABLE feeds ADD COLUMN clickbait_enabled INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added clickbait_enabled column to feeds", flush=True)
                if "max_items" not in f_cols:
                    conn.execute(text("ALTER TABLE feeds ADD COLUMN max_items INTEGER DEFAULT 0"))
                    conn.commit()
                    print("[DB] Added max_items column to feeds", flush=True)
                conn.execute(text("UPDATE feeds SET notify_enabled = 1 WHERE notify_enabled IS NULL"))
                conn.execute(text("UPDATE feeds SET clickbait_enabled = 1 WHERE clickbait_enabled IS NULL"))
                conn.execute(text("UPDATE feeds SET max_items = 0 WHERE max_items IS NULL"))
                conn.commit()

                # Säkerställ att officiella myndighetsflöden har clickbait_enabled = 0
                conn.execute(text("""
                    UPDATE feeds 
                    SET clickbait_enabled = 0 
                    WHERE LOWER(title) LIKE '%krisinformation%' 
                       OR LOWER(title) LIKE '%polisen%' 
                       OR LOWER(title) LIKE '%msb%' 
                       OR LOWER(title) LIKE '%domstol%'
                       OR LOWER(url) LIKE '%krisinformation.se%' 
                       OR LOWER(url) LIKE '%polisen.se%'
                       OR LOWER(url) LIKE '%domstol.se%'
                """))
                conn.commit()

                # Automatisk rensning av felaktig ClickBait-märkning för officiella kris- och myndighetsflöden
                conn.execute(text("""
                    UPDATE articles 
                    SET is_clickbait = 0, clickbait_reason = '' 
                    WHERE is_clickbait = 1 AND feed_id IN (
                        SELECT id FROM feeds 
                        WHERE LOWER(title) LIKE '%krisinformation%' 
                           OR LOWER(title) LIKE '%polisen%' 
                           OR LOWER(title) LIKE '%msb%' 
                           OR LOWER(title) LIKE '%domstol%'
                           OR LOWER(url) LIKE '%krisinformation.se%' 
                           OR LOWER(url) LIKE '%polisen.se%'
                           OR LOWER(url) LIKE '%domstol.se%'
                           OR clickbait_enabled = 0
                    )
                """))
                conn.commit()

                # Lägg till Sveriges Domstolar om det inte redan finns för användaren
                first_user = conn.execute(text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).fetchone()
                if first_user:
                    uid = first_user[0]
                    domstol_exists = conn.execute(text(f"SELECT id FROM feeds WHERE user_id = {uid} AND (url LIKE '%domstol.se%' OR title LIKE '%Domstol%')")).fetchone()
                    if not domstol_exists:
                        conn.execute(text(f"""
                            INSERT INTO feeds (url, title, polling_interval, scrape_enabled, include_in_dashboard, notify_enabled, clickbait_enabled, icon_url, user_id)
                            VALUES ('https://www.domstol.se/feed/56/?searchPageId=2693&scope=news', 'Sveriges Domstolar', 20, 1, 1, 1, 0, '', {uid})
                        """))
                        conn.commit()
                        print("[DB] Lade till Sveriges Domstolar som officiellt myndighetsflöde för användare #" + str(uid), flush=True)
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

            # Skapa tabell för IP-Jail (spärrade IP-adresser)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS banned_ips (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip VARCHAR UNIQUE,
                    reason VARCHAR DEFAULT '',
                    banned_at INTEGER DEFAULT 0,
                    expires_at INTEGER DEFAULT 0,
                    user_agent VARCHAR DEFAULT '',
                    attempts_count INTEGER DEFAULT 1
                )
            """))
            conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for push_subscriptions/banned_ips: {e}", flush=True)

ensure_db_migrations()

app = FastAPI(title="RSS Bevakaren API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Has-More", "X-Raw-Count"]
)

# ==========================================
# IP-JAIL & SÄKERHETSHANTERING
# ==========================================
_banned_ips_cache: Dict[str, dict] = {}
_failed_login_attempts: Dict[str, list] = {}

def _extract_client_ip(request: Request) -> str:
    """Extraherar besökarens faktiska IP-adress från proxy-headers eller direkt anslutning."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.split(",")[0].strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "okand"

def _init_banned_ips_cache():
    """Laddar aktiva IP-spärrar från databasen till minnet vid uppstart."""
    global _banned_ips_cache
    now = int(time.time())
    try:
        db = database.SessionLocal()
        banned = db.query(models.BannedIP).filter(
            or_(models.BannedIP.expires_at == 0, models.BannedIP.expires_at > now)
        ).all()
        for b in banned:
            _banned_ips_cache[b.ip] = {
                "id": b.id,
                "reason": b.reason or "Säkerhetsöverträdelse",
                "banned_at": b.banned_at,
                "expires_at": b.expires_at,
                "user_agent": b.user_agent or "",
                "attempts_count": b.attempts_count or 1
            }
        db.close()
        if banned:
            print(f"[SÄKERHET: JAIL] Läste in {len(banned)} aktiva IP-spärrar från databasen.", flush=True)
    except Exception as e:
        print(f"[SÄKERHET: JAIL] Kunde inte initiera IP-spärrcache: {e}", flush=True)

_init_banned_ips_cache()

def _is_ip_banned(ip: str) -> Optional[dict]:
    """Kontrollerar om en IP är aktivt spärrad. Tar bort utgångna spärrar."""
    global _banned_ips_cache
    if not ip or ip in ("127.0.0.1", "::1", "localhost", "okand"):
        return None
    ban_info = _banned_ips_cache.get(ip)
    if not ban_info:
        return None
    now = int(time.time())
    expires_at = ban_info.get("expires_at", 0)
    if expires_at > 0 and now > expires_at:
        _banned_ips_cache.pop(ip, None)
        return None
    return ban_info

def _record_blocked_attempt(ip: str):
    """Ökar räknaren för blockerade anrop från en spärrad IP."""
    global _banned_ips_cache
    if ip in _banned_ips_cache:
        _banned_ips_cache[ip]["attempts_count"] = _banned_ips_cache[ip].get("attempts_count", 0) + 1
        if _banned_ips_cache[ip]["attempts_count"] % 5 == 0:
            try:
                db = database.SessionLocal()
                b = db.query(models.BannedIP).filter(models.BannedIP.ip == ip).first()
                if b:
                    b.attempts_count = _banned_ips_cache[ip]["attempts_count"]
                    db.commit()
                db.close()
            except Exception:
                pass

def _ban_ip(ip: str, reason: str, duration_minutes: int, user_agent: str = ""):
    """Spärrar en IP-adress i angivet antal minuter (0 = permanent) och sparar i DB + cache."""
    global _banned_ips_cache
    if not ip or ip in ("127.0.0.1", "::1", "localhost", "okand"):
        return
    now = int(time.time())
    expires_at = now + (duration_minutes * 60) if duration_minutes > 0 else 0
    duration_str = f"{duration_minutes} minuter" if duration_minutes > 0 else "permanent"

    db_id = 0
    try:
        db = database.SessionLocal()
        existing = db.query(models.BannedIP).filter(models.BannedIP.ip == ip).first()
        if existing:
            existing.reason = reason
            existing.banned_at = now
            existing.expires_at = expires_at
            existing.user_agent = user_agent
            existing.attempts_count = (existing.attempts_count or 1) + 1
            db.commit()
            db_id = existing.id
        else:
            new_ban = models.BannedIP(
                ip=ip,
                reason=reason,
                banned_at=now,
                expires_at=expires_at,
                user_agent=user_agent,
                attempts_count=1
            )
            db.add(new_ban)
            db.commit()
            db.refresh(new_ban)
            db_id = new_ban.id
        db.close()
    except Exception as e:
        print(f"[SÄKERHET: JAIL] Databasfel vid spärrning av {ip}: {e}", flush=True)

    _banned_ips_cache[ip] = {
        "id": db_id,
        "reason": reason,
        "banned_at": now,
        "expires_at": expires_at,
        "user_agent": user_agent,
        "attempts_count": _banned_ips_cache.get(ip, {}).get("attempts_count", 0) + 1
    }
    print(f"[SÄKERHET: BAN] IP {ip} har spärrats ({duration_str}). Orsak: {reason} | User-Agent: {user_agent}", flush=True)

def _unban_ip(ip: str) -> bool:
    """Häver en IP-spärr."""
    global _banned_ips_cache
    _banned_ips_cache.pop(ip, None)
    try:
        db = database.SessionLocal()
        b = db.query(models.BannedIP).filter(models.BannedIP.ip == ip).first()
        if b:
            db.delete(b)
            db.commit()
        db.close()
        print(f"[SÄKERHET: UNBAN] Spärren för IP {ip} har hävts.", flush=True)
        return True
    except Exception as e:
        print(f"[SÄKERHET: JAIL] Fel vid hävning av spärr för {ip}: {e}", flush=True)
        return False

def _record_failed_login(ip: str, user_agent: str):
    """Registrerar ett misslyckat inloggningsförsök och spärrar automatiskt vid överträdelse."""
    global _failed_login_attempts
    if not ip or ip in ("127.0.0.1", "::1", "localhost", "okand"):
        return
    now = time.time()
    if ip not in _failed_login_attempts:
        _failed_login_attempts[ip] = []
    _failed_login_attempts[ip].append(now)

    _failed_login_attempts[ip] = [t for t in _failed_login_attempts[ip] if t > now - 900]
    recent_attempts = _failed_login_attempts[ip]

    # Regel 1: Brute Force (5 misslyckade försök inom 10 minuter) -> 15 min ban
    attempts_10m = [t for t in recent_attempts if t > now - 600]
    if len(attempts_10m) >= 5:
        _failed_login_attempts.pop(ip, None)
        _ban_ip(
            ip=ip,
            reason="Upprepade misslyckade inloggningsförsök (Brute Force)",
            duration_minutes=15,
            user_agent=user_agent
        )
        return

    # Regel 2: Rate Limit (3 misslyckade försök inom 10 sekunder) -> 15 min ban
    attempts_10s = [t for t in recent_attempts if t > now - 10]
    if len(attempts_10s) >= 3:
        _failed_login_attempts.pop(ip, None)
        _ban_ip(
            ip=ip,
            reason="För snabba inloggningsförsök (Rate Limit)",
            duration_minutes=15,
            user_agent=user_agent
        )

@app.middleware("http")
async def security_ip_jail_middleware(request: Request, call_next):
    """Avvisar omedelbart spärrade IP-adresser med HTTP 403 utan att belasta applikationen."""
    if request.method == "OPTIONS":
        return await call_next(request)

    client_ip = _extract_client_ip(request)
    if client_ip not in ("127.0.0.1", "::1", "localhost", "okand"):
        ban_info = _is_ip_banned(client_ip)
        if ban_info:
            _record_blocked_attempt(client_ip)
            return Response(
                content=json.dumps({
                    "detail": "Din IP-adress är temporärt spärrad p.g.a. misstänkt säkerhetsaktivitet.",
                    "ip": client_ip,
                    "reason": ban_info.get("reason", "Säkerhetsöverträdelse"),
                    "expires_at": ban_info.get("expires_at", 0)
                }),
                status_code=status.HTTP_403_FORBIDDEN,
                media_type="application/json"
            )
    return await call_next(request)


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
LAST_UPDATE = "2026-09-23"

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

def is_official_or_exempt_feed(feed_title: str = "", feed_url: str = "", clickbait_enabled: Any = 1) -> bool:
    """Avgör om ett flöde är en officiell myndighet/krisresurs eller om ClickBait-kontroll är avstängd."""
    if clickbait_enabled is not None:
        try:
            if int(clickbait_enabled) == 0:
                return True
        except (ValueError, TypeError):
            pass
    t = (feed_title or "").lower()
    u = (feed_url or "").lower()
    official_keywords = [
        "krisinformation", "polisen", "msb", "sos alarm", "smhi", 
        "folkhalsomyndigheten", "regeringen", "trosa kommun", "kommun",
        "domstol", "domstolsverket", "domstolar"
    ]
    if any(k in t or k in u for k in official_keywords):
        return True
    return False

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

        # Migration: Korrigera historiska artiklar importerade i klump där received_ts skilde sig mer än 24h från published_ts
        try:
            cur.execute("""
                UPDATE articles 
                SET received_ts = published_ts 
                WHERE published_ts > 0 
                  AND received_ts > published_ts + 86400 
                  AND received_ts IN (
                      SELECT received_ts FROM articles GROUP BY feed_id, received_ts HAVING count(*) >= 2
                  );
            """)
            conn.commit()
        except Exception:
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

        # Migration 26: Add clickbait_enabled to feeds
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN clickbait_enabled INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass

        # Migration 27: Add max_items to feeds
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN max_items INTEGER DEFAULT 0;")
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
    admin_env = os.environ.get("APP_ADMIN_USER", "admin").strip().lower()
    
    if usernames_env and passwords_env:
        usernames = [u.strip() for u in usernames_env.split(",") if u.strip()]
        passwords = [p.strip() for p in passwords_env.split(",")]
        
        for i, username in enumerate(usernames):
            password = passwords[i] if i < len(passwords) else "changeme"
            is_adm = 1 if (username.lower() == admin_env or (i == 0 and not any(u.lower() == admin_env for u in usernames))) else 0
            
            user = db.query(models.User).filter(models.User.username == username).first()
            if not user:
                hashed_password = auth.get_password_hash(password)
                new_user = models.User(username=username, password_hash=hashed_password, is_admin=is_adm)
                db.add(new_user)
            else:
                if not auth.verify_password(password, user.password_hash):
                    user.password_hash = auth.get_password_hash(password)
                if is_adm == 1 and not user.is_admin:
                    user.is_admin = 1
    else:
        if db.query(models.User).count() == 0:
            hashed_password = auth.get_password_hash("admin")
            default_user = models.User(username="admin", password_hash=hashed_password, is_admin=1)
            db.add(default_user)
            
    # Säkerställ att minst en användare i systemet alltid är administratör
    if db.query(models.User).count() > 0:
        active_admin = db.query(models.User).filter(models.User.is_admin == 1).first()
        if not active_admin:
            first_user = db.query(models.User).order_by(models.User.id.asc()).first()
            if first_user:
                first_user.is_admin = 1

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

def delete_local_feed_icon(feed_id: int, username: Optional[str] = "system"):
    """Raderar den lokala ikonfilen när ett flöde tas bort."""
    u_str = username or "system"
    try:
        icon_path = os.path.join(get_icons_dir(), f"feed_{feed_id}.png")
        if os.path.exists(icon_path):
            os.remove(icon_path)
            print(f"[ICON: {u_str}] Raderade lokal ikon för flöde #{feed_id}: {icon_path}", flush=True)
    except Exception as e:
        print(f"[ICON: {u_str}] Kunde inte radera lokal ikon för #{feed_id}: {e}", flush=True)

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
            domain = urlparse(target_url).netloc.lower().replace("www.", "")
        except Exception:
            pass

    candidates = []
    # 1. Befintlig sparad extern icon_url om den är giltig http/https och matchar flödets domän
    if getattr(feed, "icon_url", None) and feed.icon_url.strip().startswith(("http://", "https://")):
        raw_icon = feed.icon_url.strip()
        if is_matching_icon_domain(target_url, raw_icon):
            candidates.append(raw_icon)
        else:
            try:
                icon_domain = urlparse(raw_icon).netloc.lower().replace("www.", "")
            except Exception:
                icon_domain = ""
            print(f"[ICON: system] Ignorerade felmatchad sparad ikon för #{feed.id} ({feed.title or domain}): {icon_domain} != {domain}", flush=True)
    
    # 2. Google Favicon Service (128x128 PNG) och DuckDuckGo för flödesdomän och rensad huvuddomän
    domain_candidates = get_feed_domain_candidates(target_url, link)
    for d in domain_candidates:
        candidates.append(f"https://www.google.com/s2/favicons?domain={d}&sz=128")
        candidates.append(f"https://icons.duckduckgo.com/ip3/{d}.ico")

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
                    print(f"[ICON: system] Sparade och konverterade lokal ikon för #{feed.id} ({feed.title or domain}) -> {target_path}", flush=True)
                    return target_path
                except Exception:
                    with open(target_path, "wb") as f:
                        f.write(resp.content)
                    print(f"[ICON: system] Sparade rå ikon för #{feed.id} ({feed.title or domain}) -> {target_path}", flush=True)
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
                print(f"[ICON: system] Fel vid cachning av ikon för flöde #{f.id}: {e}", flush=True)
    except Exception as ex:
        print(f"[ICON: system] Fel i ensure_all_feed_icons_cached: {ex}", flush=True)
    finally:
        db.close()

def get_feed_icon_url(feed: Optional[models.Feed], link: Optional[str] = None) -> str:
    """Returnerar den lokala URL:en för flödets ikon (/api/feed-icons/{id}.png?v=...), eller default."""
    if feed and getattr(feed, "id", None):
        v = getattr(feed, "last_polled", 0) or getattr(feed, "id", 0)
        return f"/api/feed-icons/{feed.id}.png?v={v}"
    return "/default-feed-icon.png"

@app.get("/feed-icons/{feed_id}.png")
@app.get("/api/feed-icons/{feed_id}.png")
def serve_feed_icon(feed_id: int, db: Session = Depends(database.get_db)):
    """Serverar den lokala PNG-ikonen för ett flöde, med automatisk nedladdning vid behov."""
    icons_dir = get_icons_dir()
    target_path = os.path.join(icons_dir, f"feed_{feed_id}.png")

    if os.path.exists(target_path) and os.path.getsize(target_path) > 100:
        return FileResponse(target_path, media_type="image/png", headers={"Cache-Control": "public, max-age=3600, must-revalidate"})

    feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if feed:
        saved_path = download_and_save_feed_icon_sync(feed)
        if saved_path and os.path.exists(saved_path) and os.path.getsize(saved_path) > 100:
            return FileResponse(saved_path, media_type="image/png", headers={"Cache-Control": "public, max-age=3600, must-revalidate"})

    def_path = get_default_icon_path()
    if def_path and os.path.exists(def_path):
        return FileResponse(def_path, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})

    raise HTTPException(status_code=404, detail="Icon not found")

@app.post("/feeds/refresh-icons")
@app.post("/api/feeds/refresh-icons")
def refresh_all_feed_icons(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Rensar och laddar ner alla flödesikoner på nytt för den inloggade användaren.
    """
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
    icons_dir = get_icons_dir()
    
    refreshed = 0
    now_ts = int(time.time())
    for feed in feeds:
        if feed.icon_url and not is_matching_icon_domain(feed.url or "", feed.icon_url):
            feed.icon_url = ""
        
        if (not feed.icon_url or not feed.icon_url.strip()) and feed.url:
            try:
                import feedparser
                parsed = feedparser.parse(feed.url)
                extracted = rss_parser.extract_feed_icon(parsed, feed.url)
                if extracted and not extracted.startswith("/default-feed-icon") and is_matching_icon_domain(feed.url, extracted):
                    feed.icon_url = extracted
            except Exception:
                pass

        feed.last_polled = now_ts
        icon_path = os.path.join(icons_dir, f"feed_{feed.id}.png")
        if os.path.exists(icon_path):
            try:
                os.remove(icon_path)
            except Exception:
                pass
        try:
            download_and_save_feed_icon_sync(feed)
            refreshed += 1
        except Exception as e:
            print(f"[ICON: {current_user.username}] Fel vid hämtning av ikon för #{feed.id}: {e}", flush=True)
            
    db.commit()
    print(f"[ICON: {current_user.username}] Återställde och hämtade om ikoner för {refreshed} flöden.", flush=True)
    return {"status": "ok", "refreshed_count": refreshed}

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

    default_icon = "/default-feed-icon.png?v=2026.09.18.11"
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

                # Skicka nattlig purge-notis till administratörer (Exempel 1)
                try:
                    total_preserved = db.query(models.Article).count()
                    db_size_mb = 0.0
                    for p in ["/data/rss.db", "backend/rss.db", "rss.db"]:
                        if os.path.exists(p):
                            db_size_mb = os.path.getsize(p) / (1024 * 1024)
                            break
                    
                    if total_deleted > 0:
                        notify_title = "Nattlig databasrensning slutförd"
                        notify_body = f"{total_deleted} gamla olåsta artiklar raderades. Databas: {db_size_mb:.1f} MB ({total_preserved} artiklar bevarade)."
                    else:
                        notify_title = "Nattlig databasrensning slutförd"
                        notify_body = f"Databasen är ren och uppdaterad. 0 artiklar behövde raderas (totalt {total_preserved} artiklar)."
                    
                    admin_users = db.query(models.User).filter(models.User.is_admin == 1).all()
                    for admin in admin_users:
                        send_push_notification_to_user(
                            db=db,
                            user_id=admin.id,
                            title=notify_title,
                            body=notify_body,
                            url="/settings?tab=database",
                            context="PURGE"
                        )
                except Exception as notify_err:
                    print(f"[PURGE] Kunde inte skicka administratörsnotis om nattlig rensning: {notify_err}", flush=True)
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
                try:
                    feed_id = getattr(feed, "id", None)
                    if not feed_id:
                        continue
                    feed_exists = db.query(models.Feed.id).filter(models.Feed.id == feed_id).first()
                    if not feed_exists:
                        continue

                    # polling_interval is in minutes
                    interval_sec = (feed.polling_interval or 15) * 60
                    
                    # Check if it's time to poll
                    if current_time - (feed.last_polled or 0) < interval_sec:
                        continue

                    items = []
                    new_articles = []
                    is_initial_poll = (feed.last_polled == 0 or feed.last_polled is None)

                    await manager.send_personal_message(f"POLLING_START:{feed.id}", feed.user_id)
                    try:
                        # Kör nätverksanropet i en egen tråd för att inte blockera event-loopen
                        items = await asyncio.to_thread(rss_parser.fetch_feed_items, feed.url, feed.title)
                    except Exception as e:
                        print(f"[POLL: system] Kunde inte hämta flöde #{feed.id}: {e}", flush=True)
                        items = []
                    
                    if items and (not feed.icon_url or not feed.icon_url.strip()):
                        first_icon = items[0].get("feed_icon")
                        if first_icon and is_matching_icon_domain(feed.url or "", first_icon):
                            feed.icon_url = first_icon
                            db.commit()
                    
                    # Hämta användarens maxålder för artiklar (t.ex. 48h från AI_MAX_ARTICLE_AGE_HOURS)
                    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == feed.user_id).first()
                    max_age_hours = int(user_ai.max_article_age_hours if (user_ai and user_ai.max_article_age_hours) else os.environ.get("AI_MAX_ARTICLE_AGE_HOURS", "48"))
                    cutoff_pub_ts = current_time - (max_age_hours * 3600)

                    # Om flödet har ett specificerat max antal artiklar, begränsa till detta och åsidosätt tidsbegränsningen
                    parsed_items = items
                    custom_max_items = getattr(feed, 'max_items', 0) or 0
                    override_age_limit = bool(custom_max_items > 0)

                    if override_age_limit:
                        parsed_items = parsed_items[:custom_max_items]
                    elif is_initial_poll:
                        # Vid initial hämtning: tillåt upp till 15 nyaste artiklar oavsett ålder så att flödet inte blir tomt
                        parsed_items = parsed_items[:15]
                        override_age_limit = True

                    for item in parsed_items:
                        pub_ts = item.get("published_ts") or 0

                        # Sanitetskontroll mot källor med framtida datum
                        if pub_ts > current_time + 300:
                            pub_ts = current_time

                        # Strikt kontroll av verklig publiceringstid:
                        # Ignorera historiska artiklar som är äldre än max_age_hours (t.ex. 48h)
                        # Användaroverride: Om flödet har ett angett max_items åsidosätts tidsbegränsningen
                        if not override_age_limit:
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
                                
                            # Metod A: Vid initial hämtning sätts received_ts till artikelns faktiska publiceringsdatum
                            # så att historiska artiklar fasas in på sina riktiga historiska datum i Omni-flödet.
                            effective_received = current_time
                            if is_initial_poll and pub_ts > 0:
                                effective_received = pub_ts

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
                                received_ts=effective_received,
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
                                print(f"[POLL: {feed_username}] [ANTI-BURST] '{feed_title}': {len(push_eligible)} artiklar. Begränsar push till de 6 nyaste.", flush=True)

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
                                    print(f"[MQTT: {feed_username}] Fel vid publicering av artikel #{art.id}: {mqtt_err}", flush=True)

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
                except Exception as feed_err:
                    err_name = type(feed_err).__name__
                    err_str = str(feed_err)
                    if "ObjectDeletedError" in err_name or "has been deleted" in err_str:
                        continue
                    print(f"[POLL: system] Fel vid hantering av flöde #{getattr(feed, 'id', '?')}: {feed_err}", flush=True)
        except Exception as e:
            print(f"[POLL: system] Polling error: {e}", flush=True)
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

    ignored_disliked_tags = set()
    ignored_liked_tags = set()
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == user_id).first()
    if user_ai:
        if user_ai.ignored_disliked_tags:
            try:
                parsed_ignored = json.loads(user_ai.ignored_disliked_tags) if isinstance(user_ai.ignored_disliked_tags, str) else user_ai.ignored_disliked_tags
                if isinstance(parsed_ignored, list):
                    ignored_disliked_tags = {str(t).strip().lower() for t in parsed_ignored if t and str(t).strip()}
            except Exception:
                pass
        if user_ai.ignored_liked_tags:
            try:
                parsed_ignored_l = json.loads(user_ai.ignored_liked_tags) if isinstance(user_ai.ignored_liked_tags, str) else user_ai.ignored_liked_tags
                if isinstance(parsed_ignored_l, list):
                    ignored_liked_tags = {str(t).strip().lower() for t in parsed_ignored_l if t and str(t).strip()}
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

    liked_set = set(liked_counter.keys()) - ignored_liked_tags

    # TRÖSKELREGEL: Ett ämne måste ha ogillats i minst 2 artiklar för att aktivera -15p straffavdrag!
    disliked_set = {tag for tag, count in disliked_counter.items() if count >= 2}

    # 1. Gillade ämnen har alltid företräde; ett ämne man gillat kan aldrig ge ett ogillat-avdrag
    disliked_set = disliked_set - liked_set

    # 2. Ignorerade / vitlistade ämnen straffas aldrig
    disliked_set = disliked_set - ignored_disliked_tags

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
    print("[AI Startup] Bakgrundstråd för AI-berikning startad.", flush=True)
    print(f"[AI Startup] Konfigurerad AI-anslutning: URL={ai_service.AI_URL}, Modell='{ai_service.AI_MODEL or '(automatisk)'}', Embeddings='{ai_service.AI_EMBEDDING_MODEL}'", flush=True)
    # Vänta lite i början så appen och AI-servern (Ollama / LM Studio) hinner initialiseras
    await asyncio.sleep(4)
    try:
        startup_models = await asyncio.to_thread(ai_service.get_available_models, True)
        if startup_models:
            print(f"[AI Startup] AI-servern är online! Tillgängliga modeller ({len(startup_models)} st): {startup_models}", flush=True)
        else:
            print(f"[AI Startup] Varning: Inga modeller returnerades från AI-servern. Kontrollera att din modell är hämtad (t.ex. 'ollama pull google/gemma-4-12b-qat').", flush=True)
    except Exception as ex_init:
        print(f"[AI Startup] Fel vid kontakt med AI-servern vid start: {ex_init}", flush=True)

    # --- Embedding-hälsokontroll ---
    try:
        import time as _time
        emb_endpoint = ai_service.get_embeddings_endpoint()
        emb_model    = ai_service.AI_EMBEDDING_MODEL
        print(f"[AI Embed] Testar embedding-endpoint: {emb_endpoint} (modell: '{emb_model}') ...", flush=True)
        _t0   = _time.monotonic()
        _vecs = await asyncio.to_thread(ai_service.get_text_embeddings, ["test: RSS Bevakaren embedding-kontroll"], False, emb_model)
        _ms   = int((_time.monotonic() - _t0) * 1000)
        if _vecs and len(_vecs) > 0 and len(_vecs[0]) > 0:
            _dim = len(_vecs[0])
            print(f"[AI Embed] OK - Vektordimensioner: {_dim}  |  Svarstid: {_ms} ms  |  Modell: '{emb_model}'", flush=True)
        else:
            print(f"[AI Embed] Varning: Endpointen svarade men returnerade inga vektorer. Kontrollera att embedding-modellen '{emb_model}' är laddad i Ollama/LM Studio.", flush=True)
    except Exception as _emb_ex:
        print(f"[AI Embed] Fel vid embedding-test vid uppstart: {_emb_ex}", flush=True)
    # --- Slut embedding-hälsokontroll ---

    while True:
        try:
            # Kontrollera om AI-servern är nåbar innan vi hämtar artiklar (TTL-cachad, snabb)
            is_healthy = await asyncio.to_thread(ai_service.check_lm_studio_health)
            if not is_healthy:
                now = time.time()
                if ai_lm_offline_since is None:
                    ai_lm_offline_since = now

                # Om AI-servern har varit onåbar i minst 45 sekunder och vi inte redan larmat:
                if (now - ai_lm_offline_since >= 45) and not ai_lm_offline_notified:
                    db_alert = database.SessionLocal()
                    try:
                        admin_user = get_admin_user(db_alert)
                        if admin_user:
                            admin_ai = db_alert.query(models.UserAISettings).filter(models.UserAISettings.user_id == admin_user.id).first()
                            wants_alert = bool(admin_ai.notify_ai_offline if admin_ai and admin_ai.notify_ai_offline is not None else 1)
                            if wants_alert:
                                print(f"[AI Driftlarm] AI-servern har varit onåbar i 45 sekunder. Skickar driftnotis till admin '{admin_user.username}'.", flush=True)
                                send_push_notification_to_user(
                                    db=db_alert,
                                    user_id=admin_user.id,
                                    title="AI-motorn är offline",
                                    body="AI-servern (Ollama / LM Studio) svarar inte. Kontrollera att servern och modellen är igång.",
                                    url="/settings?tab=ai",
                                    context="AI Offline Alert"
                                )
                                asyncio.create_task(manager.send_personal_message("AI_OFFLINE_ALERT", admin_user.id))
                                ai_lm_offline_notified = True
                    except Exception as ex_alert:
                        print(f"[AI Driftlarm] Fel vid sändning av offline-notis: {ex_alert}", flush=True)
                    finally:
                        db_alert.close()

                # Sov 15 sekunder om AI-servern är offline för att inte spamma loggar
                await asyncio.sleep(15)
                continue
            else:
                # AI-servern är online! Om vi tidigare larmat om offline skickas en återställningsnotis
                if ai_lm_offline_notified:
                    db_alert = database.SessionLocal()
                    try:
                        admin_user = get_admin_user(db_alert)
                        if admin_user:
                            admin_ai = db_alert.query(models.UserAISettings).filter(models.UserAISettings.user_id == admin_user.id).first()
                            wants_alert = bool(admin_ai.notify_ai_offline if admin_ai and admin_ai.notify_ai_offline is not None else 1)
                            if wants_alert:
                                print(f"[AI Driftlarm] AI-servern är online igen! Skickar återställningsnotis till admin '{admin_user.username}'.", flush=True)
                                send_push_notification_to_user(
                                    db=db_alert,
                                    user_id=admin_user.id,
                                    title="AI-motorn är online igen",
                                    body="Anslutningen till AI-servern är återställd. Analys av köade artiklar återupptas.",
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
                custom_feed_ids = [f_id[0] for f_id in db_init.query(models.Feed.id).filter(models.Feed.max_items > 0).all()]
                
                db_init.query(models.Article).filter(
                    or_(models.Article.ai_processed == 0, models.Article.ai_processed == None),
                    or_(
                        and_(
                            models.Article.published_ts > 0, 
                            models.Article.published_ts < cutoff_ts,
                            or_(~models.Article.feed_id.in_(custom_feed_ids), models.Article.received_ts < cutoff_ts) if custom_feed_ids else True
                        ),
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
                    feed_url = feed_obj.url if feed_obj else ""
                    feed_cb_enabled = getattr(feed_obj, "clickbait_enabled", 1) if feed_obj else 1
                    is_official = is_official_or_exempt_feed(source, feed_url, feed_cb_enabled)

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
                        "short_summary_max_sentences": short_summary_max_sentences,
                        "is_official": is_official
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
                    short_summary_max_sentences=item.get("short_summary_max_sentences", 1),
                    is_official_source=item.get("is_official", False)
                )

                if analysis:
                    category = analysis.get("category", "Övrigt")
                    priority = analysis.get("priority", "low")
                    prio_score = analysis.get("prio_score", 10)
                    prio_reason = analysis.get("prio_reason", "")
                    ai_summary = analysis.get("ai_summary", "")
                    ai_short_summary = analysis.get("ai_short_summary", "")
                    tags_json = json.dumps(analysis.get("tags", []), ensure_ascii=False)
                    is_exempt = item.get("is_official", False)
                    is_clickbait = 0 if is_exempt else analysis.get("is_clickbait", 0)
                    clickbait_reason = "" if is_exempt else analysis.get("clickbait_reason", "")
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
                                cb_prefix = "[ClickBait] " if is_clickbait else ""
                                if cb_prefix and not push_title.startswith("[ClickBait]"):
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
                            f"[AI  : {u_display}] {item['source'] or 'RSS'} #{item['id']} | {category} | {priority.upper()} ({prio_score}p){prio_tag}{cluster_info_str} | {dur}s | \"{item['title']}\"",
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
                        print(f"[AI  : system] LM Studio svarar inte (offline/pausar). Försöker igen senare för artikel {item['id']}", flush=True)
                        await asyncio.sleep(10)
                        break
                    else:
                        attempts = ai_failed_attempts.get(item["id"], 0) + 1
                        ai_failed_attempts[item["id"]] = attempts

                        if attempts < 3:
                            ai_retry_after[item["id"]] = time.time() + 45
                            print(f"[AI  : {u_display}] Artikel #{item['id']} ('{item['title'][:45]}...') misslyckades vid försök {attempts}/3. Schemalägger automatiskt återförsök om 45 sekunder.", flush=True)
                        else:
                            print(f"[AI  : {u_display}] Varning: 3 automatiska försök misslyckades för artikel #{item['id']}. Tilldelar standardvärden så kön inte blockeras.", flush=True)
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
                print(f"[AI Embed] Fel vid bakgrundsvektorisering: {emb_err}", flush=True)

        except Exception as e:
            print(f"[AI] Fel i ai_processing_loop: {e}", flush=True)
            
        await asyncio.sleep(5)


@app.post("/token", response_model=schemas.Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db)
):
    client_ip = _extract_client_ip(request)
    user_agent = request.headers.get("user-agent", "ingen-user-agent")

    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        print(f"[AUTH: SÄKERHET] Misslyckat inloggningsförsök för användare '{form_data.username}' från IP {client_ip} | User-Agent: {user_agent}", flush=True)
        _record_failed_login(client_ip, user_agent)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Nollställ eventuella misslyckade inloggningsförsök vid lyckad autentisering
    _failed_login_attempts.pop(client_ip, None)
    print(f"[AUTH: login] Lyckad inloggning för användare '{user.username}' från IP {client_ip}", flush=True)
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "is_admin": bool(user.is_admin)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.api_route("/login", methods=["GET", "POST"])
@app.api_route("/admin/login", methods=["GET", "POST"])
@app.api_route("/auth/login", methods=["GET", "POST"])
@app.api_route("/user/login", methods=["GET", "POST"])
@app.api_route("/administrator", methods=["GET", "POST"])
@app.api_route("/wp-login.php", methods=["GET", "POST"])
@app.api_route("/api/login", methods=["GET", "POST"])
@app.api_route("/gcp-credentials.json", methods=["GET", "POST"])
@app.api_route("/google-credentials.json", methods=["GET", "POST"])
@app.api_route("/sa.json", methods=["GET", "POST"])
@app.api_route("/.env", methods=["GET", "POST"])
@app.api_route("/firebase-admin.json", methods=["GET", "POST"])
@app.api_route("/keys/service-account.json", methods=["GET", "POST"])
async def honeypot_login_attempt(request: Request):
    """Loggar och avvisar automatiska inloggningsförsök samt spärrar klienten automatiskt i 60 minuter."""
    client_ip = _extract_client_ip(request)
    user_agent = request.headers.get("user-agent", "ingen-user-agent")
    print(f"[AUTH: SÄKERHET] Misstänkt bot-aktivitet mot {request.method} {request.url.path} från IP {client_ip} | User-Agent: {user_agent}", flush=True)
    if client_ip not in ("127.0.0.1", "::1", "localhost", "okand"):
        _ban_ip(
            ip=client_ip,
            reason=f"Honeypot-avsökning mot {request.url.path}",
            duration_minutes=60,
            user_agent=user_agent
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Security violation logged and IP jailed"
    )
 
@app.post("/auth/refresh", response_model=schemas.Token)
def refresh_access_token(current_user: models.User = Depends(auth.get_current_user)):
    """Förlänger sessionen (sliding session) för en aktiv inloggad användare."""
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": current_user.username, "is_admin": bool(current_user.is_admin)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return schemas.UserResponse(
        id=current_user.id,
        username=current_user.username,
        is_admin=bool(current_user.is_admin)
    )

@app.get("/feeds", response_model=List[schemas.FeedResponse])
def get_feeds(
    since: Optional[int] = None,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
    feed_responses = []
    effective_ts = func.coalesce(func.nullif(models.Article.received_ts, 0), models.Article.published_ts)
    for feed in feeds:
        unread_count = db.query(models.Article).filter(
            models.Article.feed_id == feed.id,
            (models.Article.is_read == 0) | (models.Article.is_read == None)
        ).count()
        
        new_count = 0
        if since is not None and since > 0:
            new_count = db.query(models.Article).filter(
                models.Article.feed_id == feed.id,
                effective_ts >= since
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
            "clickbait_enabled": bool(getattr(feed, 'clickbait_enabled', 1) if getattr(feed, 'clickbait_enabled', 1) is not None else True),
            "max_items": getattr(feed, 'max_items', 0) or 0,
            "icon_url": get_feed_icon_url(feed),
            "unread_count": unread_count,
            "new_count": new_count
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

    initial_clickbait = 1
    if is_official_or_exempt_feed(feed.title, feed.url, None):
        initial_clickbait = 0
    elif getattr(feed, 'clickbait_enabled', None) is not None:
        initial_clickbait = 1 if feed.clickbait_enabled else 0

    db_feed = models.Feed(
        url=feed.url, 
        title=feed.title, 
        polling_interval=polling_interval, 
        scrape_enabled=int(feed.scrape_enabled), 
        include_in_dashboard=int(feed.include_in_dashboard), 
        notify_enabled=int(feed.notify_enabled), 
        clickbait_enabled=initial_clickbait,
        max_items=getattr(feed, 'max_items', 0) or 0,
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

    # Publicera automatiskt till Home Assistant MQTT Auto-Discovery
    if mqtt_service.MQTT_ENABLED:
        try:
            mqtt_service.publish_ha_discovery_for_feed(db_feed, username=current_user.username, user_id=current_user.id)
        except Exception as ha_err:
            print(f"[MQTT] Fel vid publicering av HA discovery för flöde #{db_feed.id}: {ha_err}", flush=True)

    # Convert integer to boolean for response
    db_feed.scrape_enabled = bool(db_feed.scrape_enabled)
    db_feed.include_in_dashboard = bool(db_feed.include_in_dashboard)
    db_feed.notify_enabled = bool(db_feed.notify_enabled)
    db_feed.clickbait_enabled = bool(db_feed.clickbait_enabled)
    db_feed.max_items = getattr(db_feed, 'max_items', 0) or 0
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
    if hasattr(feed, 'clickbait_enabled') and feed.clickbait_enabled is not None:
        db_feed.clickbait_enabled = int(feed.clickbait_enabled)
    if hasattr(feed, 'max_items') and feed.max_items is not None:
        old_max = getattr(db_feed, 'max_items', 0) or 0
        new_max = int(feed.max_items)
        db_feed.max_items = new_max
        if new_max > 0 and new_max != old_max:
            db_feed.last_polled = 0
    db.commit()
    db.refresh(db_feed)
    if mqtt_service.MQTT_ENABLED:
        try:
            mqtt_service.publish_ha_discovery_for_feed(db_feed, username=current_user.username, user_id=current_user.id)
        except Exception:
            pass
    db_feed.scrape_enabled = bool(db_feed.scrape_enabled)
    db_feed.include_in_dashboard = bool(db_feed.include_in_dashboard)
    db_feed.notify_enabled = bool(db_feed.notify_enabled)
    db_feed.clickbait_enabled = bool(db_feed.clickbait_enabled)
    db_feed.max_items = getattr(db_feed, 'max_items', 0) or 0
    return db_feed

@app.delete("/feeds/{feed_id}", response_model=dict)
def delete_feed(feed_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id, models.Feed.user_id == current_user.id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    feed_title = feed.title
    feed_id_val = feed.id
    db.delete(feed)
    db.commit()
    delete_local_feed_icon(feed_id_val, current_user.username)
    if mqtt_service.MQTT_ENABLED:
        try:
            mqtt_service.remove_ha_discovery_for_feed(feed_title, username=current_user.username, user_id=current_user.id, feed_id=feed_id_val)
        except Exception as ha_err:
            print(f"[MQTT] Fel vid avregistrering av HA discovery för #{feed_id_val}: {ha_err}", flush=True)
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

@app.get("/feeds/export/opml")
def export_feeds_opml(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    import xml.sax.saxutils as saxutils
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).order_by(models.Feed.title.asc()).all()
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    date_filename = datetime.now().strftime("%Y-%m-%d")
    
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="2.0">',
        '  <head>',
        '    <title>RSS-Bevakaren - Exporterade flöden</title>',
        f'    <dateCreated>{now_str}</dateCreated>',
        f'    <ownerName>{saxutils.escape(current_user.username or "")}</ownerName>',
        '    <docs>http://opml.org/spec2.opml</docs>',
        '  </head>',
        '  <body>'
    ]
    
    for f in feeds:
        title = saxutils.quoteattr(f.title or f.url or "RSS-flöde")
        xml_url = saxutils.quoteattr(f.url or "")
        is_active = "1" if (bool(f.include_in_dashboard) and bool(f.notify_enabled)) else "0"
        inc_dash = "1" if bool(f.include_in_dashboard) else "0"
        notif_en = "1" if bool(f.notify_enabled) else "0"
        scrape_en = "1" if bool(f.scrape_enabled) else "0"
        interval = str(f.polling_interval or 60)
        icon = saxutils.quoteattr(f.icon_url or "")
        
        xml_lines.append(
            f'    <outline type="rss" text={title} title={title} xmlUrl={xml_url} '
            f'active="{is_active}" includeInDashboard="{inc_dash}" '
            f'notifyEnabled="{notif_en}" scrapeEnabled="{scrape_en}" '
            f'pollingInterval="{interval}" iconUrl={icon} />'
        )
        
    xml_lines.append('  </body>')
    xml_lines.append('</opml>')
    
    opml_data = "\n".join(xml_lines)
    return Response(
        content=opml_data,
        media_type="application/xml; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="rss-bevakaren-floden-{date_filename}.opml"'
        }
    )

@app.get("/feeds/export/json")
def export_feeds_json(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).order_by(models.Feed.title.asc()).all()
    date_filename = datetime.now().strftime("%Y-%m-%d")
    
    export_payload = {
        "version": "2026.09.19.01",
        "exported_at": datetime.now().isoformat(),
        "user": current_user.username,
        "feed_count": len(feeds),
        "feeds": [
            {
                "id": f.id,
                "title": f.title,
                "url": f.url,
                "is_active": bool(f.include_in_dashboard) and bool(f.notify_enabled),
                "include_in_dashboard": bool(f.include_in_dashboard),
                "notify_enabled": bool(f.notify_enabled),
                "scrape_enabled": bool(f.scrape_enabled),
                "polling_interval_minutes": f.polling_interval or 60,
                "icon_url": f.icon_url or ""
            }
            for f in feeds
        ]
    }
    
    json_data = json.dumps(export_payload, ensure_ascii=False, indent=2)
    return Response(
        content=json_data,
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="rss-bevakaren-floden-{date_filename}.json"'
        }
    )

@app.post("/feeds/import")
async def import_feeds(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8", errors="replace").strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Kunde inte läsa uppladdad fil: {e}")

    if not content_str:
        raise HTTPException(status_code=400, detail="Filen är tom")

    parsed_feeds = []

    # Kontrollera om det är JSON eller OPML/XML
    if content_str.startswith("{") or (file.filename and file.filename.lower().endswith(".json")):
        try:
            json_obj = json.loads(content_str)
            raw_feeds = json_obj.get("feeds", []) if isinstance(json_obj, dict) else json_obj
            for item in raw_feeds:
                if not isinstance(item, dict):
                    continue
                url = (item.get("url") or "").strip()
                if not url:
                    continue
                parsed_feeds.append({
                    "url": url,
                    "title": (item.get("title") or "").strip() or url,
                    "polling_interval": int(item.get("polling_interval_minutes") or item.get("polling_interval") or 0),
                    "scrape_enabled": 1 if item.get("scrape_enabled", True) else 0,
                    "include_in_dashboard": 1 if item.get("include_in_dashboard", item.get("is_active", True)) else 0,
                    "notify_enabled": 1 if item.get("notify_enabled", True) else 0,
                    "icon_url": item.get("icon_url") or ""
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Ogiltigt JSON-format: {e}")
    else:
        # Tolka som OPML / XML
        try:
            root = ET.fromstring(content_str)
            
            def parse_outlines(parent):
                for elem in parent.findall("outline"):
                    xml_url = (elem.get("xmlUrl") or "").strip()
                    if xml_url:
                        # Extrahera anpassade eller standardvärden
                        title = (elem.get("title") or elem.get("text") or "").strip() or xml_url
                        is_active_attr = elem.get("active")
                        inc_dash_attr = elem.get("includeInDashboard")
                        notif_attr = elem.get("notifyEnabled")
                        scrape_attr = elem.get("scrapeEnabled")
                        poll_attr = elem.get("pollingInterval")
                        icon_attr = elem.get("iconUrl") or ""

                        # Logik för flaggor (standard är aktiverad om ej explicit satt till 0)
                        inc_dash = 0 if (inc_dash_attr == "0" or is_active_attr == "0") else 1
                        notif = 0 if notif_attr == "0" else 1
                        scrape = 0 if scrape_attr == "0" else 1
                        try:
                            interval = int(poll_attr) if poll_attr else 0
                        except (ValueError, TypeError):
                            interval = 0

                        parsed_feeds.append({
                            "url": xml_url,
                            "title": title,
                            "polling_interval": interval,
                            "scrape_enabled": scrape,
                            "include_in_dashboard": inc_dash,
                            "notify_enabled": notif,
                            "icon_url": icon_attr
                        })
                    # Rekursera eventuella undermappar
                    parse_outlines(elem)

            body = root.find("body")
            if body is not None:
                parse_outlines(body)
            else:
                parse_outlines(root)

            # Fallback om outline låg på annan nivå
            if not parsed_feeds:
                for elem in root.iter("outline"):
                    xml_url = (elem.get("xmlUrl") or "").strip()
                    if xml_url:
                        title = (elem.get("title") or elem.get("text") or "").strip() or xml_url
                        parsed_feeds.append({
                            "url": xml_url,
                            "title": title,
                            "polling_interval": 0,
                            "scrape_enabled": 1,
                            "include_in_dashboard": 1,
                            "notify_enabled": 1,
                            "icon_url": elem.get("iconUrl") or ""
                        })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Kunde inte tolka OPML/XML-filen: {e}")

    if not parsed_feeds:
        return {
            "status": "warning",
            "added_count": 0,
            "skipped_count": 0,
            "total_parsed": 0,
            "message": "Inga giltiga flödes-URL:er hittades i filen."
        }

    # Hämta befintliga URL:er för användaren
    existing_urls = set(f.url for f in db.query(models.Feed.url).filter(models.Feed.user_id == current_user.id).all())
    added_count = 0
    skipped_count = 0
    import random

    for item in parsed_feeds:
        feed_url = item["url"]
        if feed_url in existing_urls:
            skipped_count += 1
            continue

        poll_interval = item["polling_interval"]
        if not poll_interval or poll_interval <= 0:
            poll_interval = random.randint(10, 30)

        icon_url = item["icon_url"] or get_feed_icon_url(None, feed_url)

        db_feed = models.Feed(
            url=feed_url,
            title=item["title"],
            polling_interval=poll_interval,
            scrape_enabled=item["scrape_enabled"],
            include_in_dashboard=item["include_in_dashboard"],
            notify_enabled=item["notify_enabled"],
            icon_url=icon_url,
            user_id=current_user.id
        )
        db.add(db_feed)
        existing_urls.add(feed_url)
        added_count += 1

    if added_count > 0:
        db.commit()
        asyncio.create_task(asyncio.to_thread(ensure_all_feed_icons_cached))
        if mqtt_service.MQTT_ENABLED:
            try:
                for db_feed in db.query(models.Feed).filter(models.Feed.user_id == current_user.id, models.Feed.url.in_(existing_urls)).all():
                    mqtt_service.publish_ha_discovery_for_feed(db_feed, username=current_user.username, user_id=current_user.id)
            except Exception:
                pass

    return {
        "status": "ok",
        "added_count": added_count,
        "skipped_count": skipped_count,
        "total_parsed": len(parsed_feeds),
        "message": f"{added_count} nya flöden lades till ({skipped_count} fanns redan i din lista)."
    }

@app.get("/settings/backup/export")
def export_all_settings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    keywords = db.query(models.Keyword).filter(models.Keyword.user_id == current_user.id).all()
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).order_by(models.Feed.title.asc()).all()
    
    date_filename = datetime.now().strftime("%Y-%m-%d")
    
    # Extrahera kategorier & vikter
    cats = normalize_user_categories(json.loads(user_ai.categories) if (user_ai and user_ai.categories) else None)
    
    # Extrahera tagglistor från intresseprofil
    ignored_disliked = []
    ignored_liked = []
    if user_ai and user_ai.ignored_disliked_tags:
        try:
            ignored_disliked = json.loads(user_ai.ignored_disliked_tags)
        except Exception:
            pass
    if user_ai and user_ai.ignored_liked_tags:
        try:
            ignored_liked = json.loads(user_ai.ignored_liked_tags)
        except Exception:
            pass

    notification_settings_data = {
        "prio_notify_only": bool(user_ai.prio_notify_only) if user_ai else False,
        "push_include_title": bool(user_ai.push_include_title if user_ai and user_ai.push_include_title is not None else True),
        "push_include_image": bool(user_ai.push_include_image if user_ai and user_ai.push_include_image is not None else True),
        "push_include_summary": bool(user_ai.push_include_summary if user_ai and user_ai.push_include_summary is not None else True),
        "push_summary_type": user_ai.push_summary_type if (user_ai and user_ai.push_summary_type) else "short",
        "short_summary_max_words": user_ai.short_summary_max_words if user_ai else 20,
        "short_summary_max_sentences": user_ai.short_summary_max_sentences if user_ai else 1,
        "notify_ai_offline": bool(user_ai.notify_ai_offline if user_ai and user_ai.notify_ai_offline is not None else True)
    }

    ai_config_data = {
        "prio_enabled": bool(user_ai.prio_enabled) if user_ai else False,
        "prio_rules": user_ai.prio_rules if user_ai else "",
        "exclude_rules": user_ai.exclude_rules if user_ai else "",
        "prio_threshold": user_ai.prio_threshold if user_ai else 75,
        "custom_system_prompt": user_ai.custom_system_prompt if user_ai else "",
        "selected_model": user_ai.selected_model if user_ai else "",
        "auto_scrape_article_text": bool(user_ai.auto_scrape_article_text if user_ai and user_ai.auto_scrape_article_text is not None else True),
        "max_article_age_hours": user_ai.max_article_age_hours if user_ai else 24,
        "auto_purge_enabled": bool(user_ai.auto_purge_enabled if user_ai and user_ai.auto_purge_enabled is not None else True),
        "auto_purge_days": user_ai.auto_purge_days if user_ai else 30,
        "onboarding_completed": bool(user_ai.onboarding_completed) if user_ai else False
    }

    backup_payload = {
        "format": "rss_bevakaren_full_backup",
        "version": "2026.09.19.03",
        "exported_at": datetime.now().isoformat(),
        "user": current_user.username,
        "notification_settings": notification_settings_data,
        "ai_settings": ai_config_data,
        "categories_and_weights": cats,
        "interest_profile": {
            "ignored_disliked_tags": ignored_disliked,
            "ignored_liked_tags": ignored_liked
        },
        "keywords": [kw.keyword for kw in keywords if kw.keyword],
        "feeds": [
            {
                "url": f.url,
                "title": f.title,
                "polling_interval": f.polling_interval or 60,
                "scrape_enabled": bool(f.scrape_enabled),
                "include_in_dashboard": bool(f.include_in_dashboard),
                "notify_enabled": bool(f.notify_enabled),
                "icon_url": f.icon_url or ""
            }
            for f in feeds
        ]
    }

    json_str = json.dumps(backup_payload, ensure_ascii=False, indent=2)
    return Response(
        content=json_str,
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="rss-bevakaren-alla-installningar-{date_filename}.json"'
        }
    )

@app.post("/settings/backup/import")
async def import_all_settings(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8", errors="replace").strip()
        data = json.loads(content_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Kunde inte tolka säkerhetskopian som JSON: {e}")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Ogiltig filstruktur för säkerhetskopia.")

    # 1. Hämta eller skapa UserAISettings
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai:
        user_ai = models.UserAISettings(user_id=current_user.id)
        db.add(user_ai)

    ai_in = data.get("ai_settings") or {}
    notif_in = data.get("notification_settings") or {}
    combined_notif = {**ai_in, **notif_in}

    if "prio_enabled" in ai_in:
        user_ai.prio_enabled = 1 if ai_in["prio_enabled"] else 0
    if "prio_rules" in ai_in:
        user_ai.prio_rules = (ai_in["prio_rules"] or "").strip()
    if "exclude_rules" in ai_in:
        user_ai.exclude_rules = (ai_in["exclude_rules"] or "").strip()
    if "prio_threshold" in ai_in:
        try:
            user_ai.prio_threshold = max(50, min(95, int(ai_in["prio_threshold"])))
        except (ValueError, TypeError):
            pass
    if "custom_system_prompt" in ai_in:
        user_ai.custom_system_prompt = (ai_in["custom_system_prompt"] or "").strip()
    if "selected_model" in ai_in:
        user_ai.selected_model = (ai_in["selected_model"] or "").strip()
    if "auto_scrape_article_text" in ai_in:
        user_ai.auto_scrape_article_text = 1 if ai_in["auto_scrape_article_text"] else 0
    if "max_article_age_hours" in ai_in:
        try:
            user_ai.max_article_age_hours = max(1, min(168, int(ai_in["max_article_age_hours"])))
        except (ValueError, TypeError):
            pass
    if "auto_purge_enabled" in ai_in:
        user_ai.auto_purge_enabled = 1 if ai_in["auto_purge_enabled"] else 0
    if "auto_purge_days" in ai_in:
        try:
            user_ai.auto_purge_days = max(1, min(365, int(ai_in["auto_purge_days"])))
        except (ValueError, TypeError):
            pass
    if "onboarding_completed" in ai_in:
        user_ai.onboarding_completed = 1 if ai_in["onboarding_completed"] else 0

    # Notisinställningar
    if "prio_notify_only" in combined_notif:
        user_ai.prio_notify_only = 1 if combined_notif["prio_notify_only"] else 0
    if "push_include_title" in combined_notif:
        user_ai.push_include_title = 1 if combined_notif["push_include_title"] else 0
    if "push_include_image" in combined_notif:
        user_ai.push_include_image = 1 if combined_notif["push_include_image"] else 0
    if "push_include_summary" in combined_notif:
        user_ai.push_include_summary = 1 if combined_notif["push_include_summary"] else 0
    if "push_summary_type" in combined_notif:
        user_ai.push_summary_type = combined_notif["push_summary_type"] if combined_notif["push_summary_type"] in ("short", "full") else "short"
    if "short_summary_max_words" in combined_notif:
        try:
            user_ai.short_summary_max_words = max(5, min(100, int(combined_notif["short_summary_max_words"])))
        except (ValueError, TypeError):
            pass
    if "short_summary_max_sentences" in combined_notif:
        try:
            user_ai.short_summary_max_sentences = max(1, min(3, int(combined_notif["short_summary_max_sentences"])))
        except (ValueError, TypeError):
            pass
    if "notify_ai_offline" in combined_notif:
        user_ai.notify_ai_offline = 1 if combined_notif["notify_ai_offline"] else 0

    # 2. Kategorier och vikter
    cats_in = data.get("categories_and_weights")
    if cats_in is not None:
        norm_cats = normalize_user_categories(cats_in)
        user_ai.categories = json.dumps(norm_cats, ensure_ascii=False)
        # Bygg om systemprompt om ej satt manuellt
        if not user_ai.custom_system_prompt:
            user_ai.custom_system_prompt = ai_service.build_user_prompt(
                categories=norm_cats,
                prio_rules=user_ai.prio_rules or "",
                exclude_rules=user_ai.exclude_rules or "",
                prio_threshold=user_ai.prio_threshold or 75
            )

    # 3. Intresseprofil (taggar)
    interest = data.get("interest_profile") or {}
    if "ignored_disliked_tags" in interest:
        user_ai.ignored_disliked_tags = json.dumps(interest["ignored_disliked_tags"] or [], ensure_ascii=False)
    if "ignored_liked_tags" in interest:
        user_ai.ignored_liked_tags = json.dumps(interest["ignored_liked_tags"] or [], ensure_ascii=False)

    # 4. Nyckelord
    keywords_in = data.get("keywords") or []
    existing_kws = set(kw.keyword.lower() for kw in db.query(models.Keyword.keyword).filter(models.Keyword.user_id == current_user.id).all())
    added_keywords = 0
    for kw_str in keywords_in:
        if isinstance(kw_str, str) and kw_str.strip():
            clean_kw = kw_str.strip()
            if clean_kw.lower() not in existing_kws:
                db.add(models.Keyword(keyword=clean_kw, user_id=current_user.id))
                existing_kws.add(clean_kw.lower())
                added_keywords += 1

    # 5. Flöden
    feeds_in = data.get("feeds") or []
    existing_feeds = {f.url: f for f in db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()}
    added_feeds = 0
    updated_feeds = 0
    import random

    for f_item in feeds_in:
        if not isinstance(f_item, dict):
            continue
        url = (f_item.get("url") or "").strip()
        if not url:
            continue
        title = (f_item.get("title") or "").strip() or url
        try:
            poll_int = int(f_item.get("polling_interval") or f_item.get("polling_interval_minutes") or 0)
        except (ValueError, TypeError):
            poll_int = 0
        if poll_int <= 0:
            poll_int = random.randint(10, 30)
        scrape = 1 if f_item.get("scrape_enabled", True) else 0
        inc_dash = 1 if f_item.get("include_in_dashboard", True) else 0
        notif = 1 if f_item.get("notify_enabled", True) else 0
        icon = f_item.get("icon_url") or get_feed_icon_url(None, url)

        if url in existing_feeds:
            existing_f = existing_feeds[url]
            existing_f.title = title
            existing_f.polling_interval = poll_int
            existing_f.scrape_enabled = scrape
            existing_f.include_in_dashboard = inc_dash
            existing_f.notify_enabled = notif
            if icon and not existing_f.icon_url:
                existing_f.icon_url = icon
            updated_feeds += 1
        else:
            db_feed = models.Feed(
                url=url,
                title=title,
                polling_interval=poll_int,
                scrape_enabled=scrape,
                include_in_dashboard=inc_dash,
                notify_enabled=notif,
                icon_url=icon,
                user_id=current_user.id
            )
            db.add(db_feed)
            added_feeds += 1

    db.commit()
    if added_feeds > 0:
        asyncio.create_task(asyncio.to_thread(ensure_all_feed_icons_cached))

    return {
        "status": "ok",
        "message": f"Säkerhetskopia återställd: {added_feeds} nya flöden lades till, {updated_feeds} flöden uppdaterades, {added_keywords} nya nyckelord lades till och alla AI-prompter och vikter har synkroniserats.",
        "added_feeds": added_feeds,
        "updated_feeds": updated_feeds,
        "added_keywords": added_keywords,
        "ai_settings_restored": True
    }

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
        if mqtt_service.MQTT_ENABLED:
            try:
                for db_feed in db.query(models.Feed).filter(models.Feed.user_id == current_user.id, models.Feed.url.in_(existing_urls)).all():
                    mqtt_service.publish_ha_discovery_for_feed(db_feed, username=current_user.username, user_id=current_user.id)
            except Exception:
                pass
        
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
    response: Response,
    feed_id: Optional[int] = None, 
    show_read: Optional[bool] = False, 
    app_mode: Optional[str] = None,
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
    limit: Optional[int] = 80,
    offset: Optional[int] = 0,
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
        elif not show_read and app_mode != "omni":
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
        
    if app_mode == 'omni':
        effective_ts = func.coalesce(func.nullif(models.Article.received_ts, 0), models.Article.published_ts)
        query = query.order_by(effective_ts.desc(), models.Article.published_ts.desc(), models.Article.id.desc())
    else:
        effective_ts = func.coalesce(func.nullif(models.Article.published_ts, 0), models.Article.received_ts)
        query = query.order_by(effective_ts.desc(), models.Article.received_ts.desc(), models.Article.id.desc())
    if offset and offset > 0:
        query = query.offset(offset)
    if limit and limit > 0:
        query = query.limit(limit)
    articles = query.all()
    
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
                "is_read": other["is_read"],
                "ai_short_summary": other.get("ai_short_summary", "")
            })
        head["similar_articles"] = similar
        final_items.append(head)

    final_items.extend(unclustered)
    if app_mode == 'omni':
        final_items.sort(key=lambda x: (x.get("received_ts") or x.get("published_ts") or 0, x.get("id", 0)), reverse=True)
    else:
        final_items.sort(key=lambda x: (x.get("published_ts") or x.get("received_ts") or 0, x.get("id", 0)), reverse=True)
    response.headers["X-Has-More"] = "true" if len(articles) == limit else "false"
    response.headers["X-Raw-Count"] = str(len(articles))
    return final_items

@app.post("/articles/cluster/{cluster_id}/read")
async def mark_cluster_read(
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
    if updated_ids:
        ids_str = ",".join(str(i) for i in updated_ids)
        await manager.send_personal_message(f"ARTICLES_READ:{ids_str}", current_user.id)
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

    feed_title = art.feed.title if art.feed else ""
    feed_url = art.feed.url if art.feed else ""
    feed_cb_enabled = getattr(art.feed, "clickbait_enabled", 1) if art.feed else 1
    is_exempt = is_official_or_exempt_feed(feed_title, feed_url, feed_cb_enabled)

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
        short_summary_max_sentences=short_sents,
        is_official_source=is_exempt
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
    art.is_clickbait = 0 if is_exempt else analysis.get("is_clickbait", 0)
    art.clickbait_reason = "" if is_exempt else analysis.get("clickbait_reason", "")
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
    print(f"[AI  : {current_user.username}] #{art.id} | {art.category} | {art.priority.upper()} ({art.prio_score}p) | {art.ai_duration_s}s | \"{art.title}\"", flush=True)

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
    since: Optional[int] = None,
    app_mode: Optional[str] = None,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai or not user_ai.prio_enabled:
        return {"unread_count": 0, "new_count": 0}

    threshold = user_ai.prio_threshold or 75

    base_query = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == current_user.id,
        models.Article.ai_processed == 1,
        or_(models.Article.priority == 'high', models.Article.prio_score >= threshold)
    )

    unread_count = base_query.filter((models.Article.is_read == 0) | (models.Article.is_read == None)).count()

    new_count = 0
    if since and since > 0:
        new_count = base_query.filter(
            func.coalesce(func.nullif(models.Article.received_ts, 0), models.Article.published_ts) >= since
        ).count()

    return {"unread_count": unread_count, "new_count": new_count}

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
            lm_studio_url=ai_service.AI_URL,
            lm_studio_model="",
            ai_url=ai_service.AI_URL,
            ai_model="",
            server_type=ai_service.get_ai_server_type(),
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
        lm_studio_url=ai_service.AI_URL,
        lm_studio_model=user_ai.selected_model or "",
        ai_url=ai_service.AI_URL,
        ai_model=user_ai.selected_model or "",
        server_type=ai_service.get_ai_server_type(),
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
    
    target_model = config.ai_model if config.ai_model is not None else config.lm_studio_model
    if target_model is not None:
        user_ai.selected_model = target_model.strip()

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
        lm_studio_url=ai_service.AI_URL,
        lm_studio_model=user_ai.selected_model or "",
        ai_url=ai_service.AI_URL,
        ai_model=user_ai.selected_model or "",
        server_type=ai_service.get_ai_server_type(),
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
    print(f"[SCRP: {current_username}] Startade skrapning för {name_str}", flush=True)
    
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

@app.get("/stats/overview")
@app.get("/api/stats/overview")
def get_stats_overview(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Returnerar aggregerad statistik och analysdata för den dedikerade statistikfliken i inställningar:
    - Nyckeltal (totalt, idag, denna vecka, denna månad, lästa, sparade, ClickBait)
    - 14-dagars inflödestrend med prioritetsfördelning
    - 24-timmars dygnsrytm
    - AI-ämneskategorier
    - Toppkällor
    """
    try:
        now = datetime.now()
        now_ts = int(now.timestamp())
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_ts = int(today_start.timestamp())
        week_start_ts = now_ts - (7 * 86400)
        month_start_ts = now_ts - (30 * 86400)

        user_feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
        user_feed_ids = [f.id for f in user_feeds]

        if not user_feed_ids and current_user.is_admin:
            all_feeds = db.query(models.Feed).all()
            user_feed_ids = [f.id for f in all_feeds]

        if not user_feed_ids:
            return {
                "kpi": {
                    "total_articles": 0,
                    "articles_today": 0,
                    "articles_week": 0,
                    "articles_month": 0,
                    "prio_count": 0,
                    "prio_pct": 0.0,
                    "clickbait_count": 0,
                    "clickbait_pct": 0.0,
                    "read_count": 0,
                    "read_pct": 0.0,
                    "locked_count": 0,
                    "avg_ai_duration_s": 0.0
                },
                "daily_trend": [],
                "hourly_distribution": [0] * 24,
                "priority_distribution": {"high": 0, "medium": 0, "low": 0},
                "top_categories": [],
                "top_sources": []
            }

        base_query = db.query(models.Article).filter(models.Article.feed_id.in_(user_feed_ids))
        total_articles = base_query.count()
        articles_today = base_query.filter(models.Article.received_ts >= today_start_ts).count()
        articles_week = base_query.filter(models.Article.received_ts >= week_start_ts).count()
        articles_month = base_query.filter(models.Article.received_ts >= month_start_ts).count()

        prio_count = base_query.filter(or_(models.Article.priority == 'high', models.Article.prio_score >= 75)).count()
        med_count = base_query.filter(and_(
            models.Article.priority != 'high',
            or_(models.Article.priority == 'medium', and_(models.Article.prio_score >= 40, models.Article.prio_score < 75))
        )).count()
        low_count = max(0, total_articles - prio_count - med_count)

        read_count = base_query.filter(models.Article.is_read == 1).count()
        locked_count = base_query.filter(models.Article.is_locked == 1).count()
        clickbait_count = base_query.filter(models.Article.is_clickbait == 1).count()

        avg_ai = db.query(func.avg(models.Article.ai_duration_s)).filter(
            models.Article.feed_id.in_(user_feed_ids),
            models.Article.ai_duration_s > 0
        ).scalar() or 0.0

        # Daglig trend för de senaste 14 dagarna
        daily_trend = []
        swedish_months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
        for i in range(13, -1, -1):
            day_date = (now - timedelta(days=i)).date()
            day_start_ts = int(datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0).timestamp())
            day_end_ts = day_start_ts + 86400

            day_stats = db.query(
                func.count(models.Article.id).label("total"),
                func.sum(case((or_(models.Article.priority == 'high', models.Article.prio_score >= 75), 1), else_=0)).label("high"),
                func.sum(case((and_(models.Article.priority != 'high', or_(models.Article.priority == 'medium', and_(models.Article.prio_score >= 40, models.Article.prio_score < 75))), 1), else_=0)).label("medium")
            ).filter(
                models.Article.feed_id.in_(user_feed_ids),
                models.Article.received_ts >= day_start_ts,
                models.Article.received_ts < day_end_ts
            ).first()

            tot = day_stats.total or 0
            hi = day_stats.high or 0
            md = day_stats.medium or 0
            lo = max(0, tot - hi - md)

            daily_trend.append({
                "date": day_date.strftime("%Y-%m-%d"),
                "label": f"{day_date.day} {swedish_months[day_date.month - 1]}",
                "total": tot,
                "high": hi,
                "medium": md,
                "low": lo
            })

        # Dygnsrytm (fördelning per timme 00-23 över senaste 7 dagarna)
        hourly_distribution = [0] * 24
        recent_ts = db.query(models.Article.received_ts).filter(
            models.Article.feed_id.in_(user_feed_ids),
            models.Article.received_ts >= week_start_ts
        ).all()
        for (r_ts,) in recent_ts:
            if r_ts:
                try:
                    dt = datetime.fromtimestamp(r_ts)
                    hourly_distribution[dt.hour] += 1
                except Exception:
                    pass

        # Topp AI-kategorier
        cat_rows = db.query(
            models.Article.category,
            func.count(models.Article.id).label("cnt")
        ).filter(
            models.Article.feed_id.in_(user_feed_ids),
            models.Article.category.isnot(None),
            models.Article.category != ""
        ).group_by(models.Article.category).order_by(desc("cnt")).limit(6).all()

        top_categories = []
        for cat_name, cnt in cat_rows:
            pct = round((cnt / total_articles * 100), 1) if total_articles > 0 else 0.0
            top_categories.append({
                "name": cat_name,
                "count": cnt,
                "pct": pct
            })

        # Topp 5 källor
        source_stats = []
        for f in user_feeds:
            f_stat = db.query(
                func.count(models.Article.id).label("total"),
                func.sum(case((or_(models.Article.priority == 'high', models.Article.prio_score >= 75), 1), else_=0)).label("high")
            ).filter(models.Article.feed_id == f.id).first()
            f_tot = f_stat.total or 0
            f_hi = f_stat.high or 0
            if f_tot > 0:
                source_stats.append({
                    "feed_id": f.id,
                    "title": f.title or "Namnlöst flöde",
                    "icon_url": f.icon_url or "",
                    "total": f_tot,
                    "high": f_hi,
                    "high_pct": round((f_hi / f_tot * 100), 1)
                })
        source_stats.sort(key=lambda s: s["total"], reverse=True)
        top_sources = source_stats[:5]

        return {
            "kpi": {
                "total_articles": total_articles,
                "articles_today": articles_today,
                "articles_week": articles_week,
                "articles_month": articles_month,
                "prio_count": prio_count,
                "prio_pct": round((prio_count / total_articles * 100), 1) if total_articles > 0 else 0.0,
                "clickbait_count": clickbait_count,
                "clickbait_pct": round((clickbait_count / total_articles * 100), 1) if total_articles > 0 else 0.0,
                "read_count": read_count,
                "read_pct": round((read_count / total_articles * 100), 1) if total_articles > 0 else 0.0,
                "locked_count": locked_count,
                "avg_ai_duration_s": round(float(avg_ai), 2)
            },
            "daily_trend": daily_trend,
            "hourly_distribution": hourly_distribution,
            "priority_distribution": {
                "high": prio_count,
                "medium": med_count,
                "low": low_count
            },
            "top_categories": top_categories,
            "top_sources": top_sources
        }
    except Exception as e:
        print(f"[STATS] Fel vid hämtning av statistiköversikt: {e}", flush=True)
        return {
            "kpi": {
                "total_articles": 0,
                "articles_today": 0,
                "articles_week": 0,
                "articles_month": 0,
                "prio_count": 0,
                "prio_pct": 0.0,
                "clickbait_count": 0,
                "clickbait_pct": 0.0,
                "read_count": 0,
                "read_pct": 0.0,
                "locked_count": 0,
                "avg_ai_duration_s": 0.0
            },
            "daily_trend": [],
            "hourly_distribution": [0] * 24,
            "priority_distribution": {"high": 0, "medium": 0, "low": 0},
            "top_categories": [],
            "top_sources": []
        }

@app.post("/articles/{article_id}/read")
async def mark_article_read(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if article:
        article.is_read = 1
        db.commit()
        await manager.send_personal_message(f"ARTICLE_READ:{article_id}", current_user.id)
    return {"status": "ok"}

@app.post("/articles/read-all")
async def mark_all_articles_read(
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
    await manager.send_personal_message("ALL_READ", current_user.id)
    return {"status": "ok", "count": len(articles)}

@app.post("/articles/{article_id}/unread")
async def mark_article_unread(article_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    article = db.query(models.Article).join(models.Feed).filter(models.Article.id == article_id, models.Feed.user_id == current_user.id).first()
    if article:
        article.is_read = 0
        db.commit()
        await manager.send_personal_message(f"ARTICLE_UNREAD:{article_id}", current_user.id)
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

@app.post("/articles/{article_id}/dismiss_clickbait")
def dismiss_clickbait(
    article_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    article = db.query(models.Article).join(models.Feed).filter(
        models.Article.id == article_id, 
        models.Feed.user_id == current_user.id
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikeln hittades inte")

    article.is_clickbait = 0
    article.clickbait_reason = ""

    # Hämta användarens AI-inställningar för korrekt prio-beräkning
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    user_categories = None
    if user_ai and user_ai.categories:
        try:
            user_categories = json.loads(user_ai.categories)
        except Exception:
            user_categories = None

    tags_list = []
    if article.tags:
        try:
            tags_list = json.loads(article.tags)
        except Exception:
            tags_list = [t.strip() for t in article.tags.split(",") if t.strip()]

    # Beräkna om prioritering utan ClickBait-avdrag (-25p)
    prio_res = ai_service.calculate_priority(
        category=article.category or "Övrigt",
        categories_config=user_categories,
        urgency_score=article.urgency_score or 5,
        substance_score=article.substance_score or 5,
        is_clickbait=False,
        tags=tags_list
    )

    article.priority = prio_res.get("priority", article.priority)
    article.prio_score = prio_res.get("prio_score", article.prio_score)
    article.prio_reason = prio_res.get("prio_reason", article.prio_reason)
    db.commit()

    return {
        "status": "ok",
        "article_id": article.id,
        "is_clickbait": 0,
        "clickbait_reason": "",
        "priority": article.priority,
        "prio_score": article.prio_score,
        "prio_reason": article.prio_reason
    }

@app.post("/system/purge")
def purge_system(days: int = 30, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    """Kräver administratörsbehörighet: Rensa artiklar äldre än givet antal dagar."""
    cutoff_ts = int(time.time()) - (days * 24 * 60 * 60)
    query = db.query(models.Article).filter(
        models.Article.received_ts < cutoff_ts,
        or_(models.Article.is_locked == 0, models.Article.is_locked == None)
    )
    count = query.count()
    if count > 0:
        article_ids = [a.id for a in query.all()]
        db.query(models.ArticleEmbedding).filter(models.ArticleEmbedding.article_id.in_(article_ids)).delete(synchronize_session=False)
        db.query(models.Article).filter(models.Article.id.in_(article_ids)).delete(synchronize_session=False)
        db.commit()
    return {"status": "ok", "deleted": count}

# ==========================================
# ADMINISTRATÖRSPANEL & RBAC ENDPOINTS
# ==========================================

@app.get("/admin/users", response_model=List[schemas.AdminUserResponse])
def admin_get_users(
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Returnerar samtliga användarkonton för administratören."""
    users = db.query(models.User).order_by(models.User.id.asc()).all()
    res = []
    for u in users:
        f_count = db.query(models.Feed).filter(models.Feed.user_id == u.id).count()
        res.append(schemas.AdminUserResponse(
            id=u.id,
            username=u.username,
            is_admin=bool(u.is_admin),
            feed_count=f_count
        ))
    return res

@app.post("/admin/users", response_model=schemas.AdminUserResponse)
def admin_create_user(
    req: schemas.AdminUserCreate,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Skapa ett nytt användarkonto från adminpanelen."""
    clean_username = req.username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Användarnamn kan inte vara tomt.")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Lösenordet måste innehålla minst 4 tecken.")
    
    existing = db.query(models.User).filter(func.lower(models.User.username) == clean_username.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Användarnamnet '{clean_username}' är redan upptaget.")
    
    hashed_pwd = auth.get_password_hash(req.password)
    new_u = models.User(
        username=clean_username,
        password_hash=hashed_pwd,
        is_admin=1 if req.is_admin else 0
    )
    db.add(new_u)
    db.commit()
    db.refresh(new_u)

    # Skapa även standardinställningar för den nya användaren
    new_ai = models.UserAISettings(user_id=new_u.id)
    db.add(new_ai)
    db.commit()

    return schemas.AdminUserResponse(
        id=new_u.id,
        username=new_u.username,
        is_admin=bool(new_u.is_admin),
        feed_count=0
    )

@app.patch("/admin/users/{user_id}", response_model=schemas.AdminUserResponse)
def admin_update_user(
    user_id: int,
    req: schemas.AdminUserUpdate,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Uppdatera lösenord eller adminstatus för en användare."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
    
    if req.is_admin is not None:
        if target.id == admin.id and not req.is_admin:
            other_admins = db.query(models.User).filter(models.User.id != admin.id, models.User.is_admin == 1).count()
            if other_admins == 0:
                raise HTTPException(status_code=400, detail="Du kan inte avlägsna dina egna administratörsrättigheter då du är systemets enda administratör.")
        target.is_admin = 1 if req.is_admin else 0

    if req.password is not None and req.password.strip():
        if len(req.password.strip()) < 4:
            raise HTTPException(status_code=400, detail="Lösenordet måste innehålla minst 4 tecken.")
        target.password_hash = auth.get_password_hash(req.password.strip())

    db.commit()
    db.refresh(target)
    f_count = db.query(models.Feed).filter(models.Feed.user_id == target.id).count()
    return schemas.AdminUserResponse(
        id=target.id,
        username=target.username,
        is_admin=bool(target.is_admin),
        feed_count=f_count
    )

@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Radera en användare och associerad data."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Du kan inte radera ditt eget administratörskonto.")
    
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
    
    # Rensa användarens feeds och artiklar
    feeds = db.query(models.Feed).filter(models.Feed.user_id == user_id).all()
    for f in feeds:
        db.query(models.Article).filter(models.Article.feed_id == f.id).delete(synchronize_session=False)
        db.delete(f)
    
    db.query(models.Keyword).filter(models.Keyword.user_id == user_id).delete(synchronize_session=False)
    db.query(models.PushSubscription).filter(models.PushSubscription.user_id == user_id).delete(synchronize_session=False)
    db.query(models.UserAISettings).filter(models.UserAISettings.user_id == user_id).delete(synchronize_session=False)
    db.query(models.DailyDigest).filter(models.DailyDigest.user_id == user_id).delete(synchronize_session=False)

    db.delete(target)
    db.commit()
    return {"status": "ok", "message": f"Användaren '{target.username}' har raderats."}

@app.get("/admin/users/{user_id}/feeds", response_model=List[schemas.FeedResponse])
def admin_get_user_feeds(
    user_id: int,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Returnerar samtliga flöden för en specifik användare."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
    
    feeds = db.query(models.Feed).filter(models.Feed.user_id == target.id).all()
    feed_responses = []
    for feed in feeds:
        unread_count = db.query(models.Article).filter(
            models.Article.feed_id == feed.id,
            (models.Article.is_read == 0) | (models.Article.is_read == None)
        ).count()
        feed_responses.append({
            "id": feed.id,
            "user_id": feed.user_id,
            "url": feed.url,
            "title": feed.title,
            "polling_interval": feed.polling_interval,
            "scrape_enabled": bool(feed.scrape_enabled),
            "include_in_dashboard": bool(feed.include_in_dashboard),
            "notify_enabled": bool(feed.notify_enabled),
            "clickbait_enabled": bool(getattr(feed, 'clickbait_enabled', 1) if getattr(feed, 'clickbait_enabled', 1) is not None else True),
            "max_items": getattr(feed, 'max_items', 0) or 0,
            "icon_url": get_feed_icon_url(feed),
            "unread_count": unread_count,
            "new_count": 0
        })
    return feed_responses

@app.post("/admin/users/{user_id}/feeds", response_model=schemas.FeedResponse)
def admin_create_user_feed(
    user_id: int,
    feed: schemas.FeedCreate,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Skapar ett nytt flöde för en specifik användare."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
    
    clean_url = (feed.url or "").strip()
    if not clean_url:
        raise HTTPException(status_code=400, detail="Flödes-URL kan inte vara tom.")
    feed.url = clean_url

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

    polling_interval = feed.polling_interval
    if not polling_interval or polling_interval == 60:
        import random
        polling_interval = random.randint(10, 30)

    initial_clickbait = 1
    if is_official_or_exempt_feed(feed.title, feed.url, None):
        initial_clickbait = 0
    elif getattr(feed, 'clickbait_enabled', None) is not None:
        initial_clickbait = 1 if feed.clickbait_enabled else 0

    db_feed = models.Feed(
        url=feed.url, 
        title=feed.title, 
        polling_interval=polling_interval, 
        scrape_enabled=int(feed.scrape_enabled), 
        include_in_dashboard=int(feed.include_in_dashboard), 
        notify_enabled=int(feed.notify_enabled), 
        clickbait_enabled=initial_clickbait,
        max_items=getattr(feed, 'max_items', 0) or 0,
        icon_url=icon_url,
        user_id=target.id
    )
    db.add(db_feed)
    db.commit()
    db.refresh(db_feed)
    try:
        download_and_save_feed_icon_sync(db_feed)
    except Exception as icon_err:
        print(f"[ICONS] Kunde inte ladda ner ikon vid skapande av flöde #{db_feed.id}: {icon_err}", flush=True)

    if mqtt_service.MQTT_ENABLED:
        try:
            mqtt_service.publish_ha_discovery_for_feed(db_feed, username=target.username, user_id=target.id)
        except Exception as ha_err:
            print(f"[MQTT] Fel vid publicering av HA discovery för flöde #{db_feed.id}: {ha_err}", flush=True)

    db_feed.scrape_enabled = bool(db_feed.scrape_enabled)
    db_feed.include_in_dashboard = bool(db_feed.include_in_dashboard)
    db_feed.notify_enabled = bool(db_feed.notify_enabled)
    db_feed.clickbait_enabled = bool(db_feed.clickbait_enabled)
    db_feed.max_items = getattr(db_feed, 'max_items', 0) or 0
    return db_feed

@app.delete("/admin/users/{user_id}/feeds/{feed_id}", response_model=dict)
def admin_delete_user_feed(
    user_id: int,
    feed_id: int,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Tar bort ett flöde från en specifik användare."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
        
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id, models.Feed.user_id == target.id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Flödet hittades inte för denna användare.")
        
    feed_title = feed.title
    feed_id_val = feed.id
    db.delete(feed)
    db.commit()
    delete_local_feed_icon(feed_id_val, target.username)
    if mqtt_service.MQTT_ENABLED:
        try:
            mqtt_service.remove_ha_discovery_for_feed(feed_title, username=target.username, user_id=target.id, feed_id=feed_id_val)
        except Exception as ha_err:
            print(f"[MQTT] Fel vid avregistrering av HA discovery för #{feed_id_val}: {ha_err}", flush=True)
    return {"status": "ok", "message": f"Flödet '{feed_title}' har raderats från användare {target.username}."}

@app.post("/admin/database/clear-articles")
def admin_clear_articles(
    payload: dict,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Töm artiklar från databasen (antingen enbart olåsta eller samtliga)."""
    mode = payload.get("mode", "unlocked")
    query = db.query(models.Article)
    if mode == "unlocked":
        query = query.filter(or_(models.Article.is_locked == 0, models.Article.is_locked == None))
    
    deleted_count = query.count()
    if deleted_count > 0:
        art_ids = [a.id for a in query.all()]
        db.query(models.ArticleEmbedding).filter(models.ArticleEmbedding.article_id.in_(art_ids)).delete(synchronize_session=False)
        db.query(models.Article).filter(models.Article.id.in_(art_ids)).delete(synchronize_session=False)
        db.commit()
    return {"status": "ok", "deleted": deleted_count, "mode": mode}

@app.post("/admin/database/vacuum")
def admin_vacuum_database(
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Optimerar databasen genom att köra SQLite VACUUM."""
    try:
        connection = db.connection().connection
        old_isolation = connection.isolation_level
        connection.isolation_level = None
        cursor = connection.cursor()
        cursor.execute("VACUUM")
        connection.isolation_level = old_isolation
        
        db_size = 0
        for path in ["/data/rss.db", "backend/rss.db", "rss.db"]:
            if os.path.exists(path):
                db_size = os.path.getsize(path)
                break
            
        return {
            "status": "ok",
            "message": "Databasen har optimerats och defragmenterats framgångsrikt.",
            "database_size_bytes": db_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunde inte köra VACUUM: {e}")

@app.post("/admin/ai/model")
def admin_set_system_ai_model(
    payload: dict,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Ställ in global standardmodell för AI-analys för alla användare."""
    new_model = (payload.get("model") or "").strip()
    users_ai = db.query(models.UserAISettings).all()
    for u_ai in users_ai:
        u_ai.selected_model = new_model
    db.commit()
    return {"status": "ok", "selected_model": new_model, "affected_users": len(users_ai)}


# ==========================================
# ADMIN: SÄKERHET & IP-JAIL ENDPOINTS
# ==========================================
@app.get("/admin/security/banned-ips", response_model=List[schemas.BannedIPResponse])
def admin_get_banned_ips(
    admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(database.get_db)
):
    """Returnerar alla spärrade IP-adresser och deras status."""
    now = int(time.time())
    bans = db.query(models.BannedIP).order_by(desc(models.BannedIP.banned_at)).all()
    results = []
    for b in bans:
        cached = _banned_ips_cache.get(b.ip)
        attempts = cached.get("attempts_count", b.attempts_count or 1) if cached else (b.attempts_count or 1)
        is_active = (b.expires_at == 0 or b.expires_at > now) and (b.ip in _banned_ips_cache)
        results.append(schemas.BannedIPResponse(
            id=b.id,
            ip=b.ip,
            reason=b.reason or "Säkerhetsöverträdelse",
            banned_at=b.banned_at or 0,
            expires_at=b.expires_at or 0,
            user_agent=b.user_agent or "Okänd",
            attempts_count=attempts,
            is_active=is_active
        ))
    return results

@app.post("/admin/security/ban-ip")
def admin_manual_ban_ip(
    req: schemas.BanIPRequest,
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Manuell spärrning av en IP-adress från adminpanelen."""
    clean_ip = req.ip.strip()
    if not clean_ip or clean_ip in ("127.0.0.1", "::1", "localhost", "okand"):
        raise HTTPException(status_code=400, detail="Ogiltig IP-adress eller lokal adress som ej kan spärras.")
    
    _ban_ip(
        ip=clean_ip,
        reason=req.reason or "Manuell spärr av administratör",
        duration_minutes=req.duration_minutes if req.duration_minutes is not None else 60,
        user_agent=f"Spärrad manuellt av administratör '{admin.username}'"
    )
    return {"status": "ok", "message": f"IP-adressen {clean_ip} har spärrats."}

@app.post("/admin/security/unban-ip")
def admin_unban_ip(
    payload: dict,
    admin: models.User = Depends(auth.get_current_admin_user)
):
    """Häver spärren för en specifik IP-adress."""
    target_ip = (payload.get("ip") or "").strip()
    if not target_ip:
        raise HTTPException(status_code=400, detail="IP-adress saknas i förfrågan.")
    
    success = _unban_ip(target_ip)
    if not success:
        raise HTTPException(status_code=404, detail=f"Kunde inte hitta eller häva spärren för {target_ip}.")
    return {"status": "ok", "message": f"Spärren för {target_ip} har hävts framgångsrikt."}

@app.get("/admin/security/stats", response_model=schemas.SecurityStatsResponse)
def admin_get_security_stats(
    admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(database.get_db)
):
    """Aggregerad säkerhetsstatistik för adminpanelen."""
    now = int(time.time())
    active_count = len([ip for ip, data in _banned_ips_cache.items() if data.get("expires_at", 0) == 0 or data.get("expires_at", 0) > now])
    total_blocked = db.query(func.coalesce(func.sum(models.BannedIP.attempts_count), 0)).scalar() or 0
    return schemas.SecurityStatsResponse(
        active_bans_count=active_count,
        total_blocked_attempts=int(total_blocked)
    )



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
    ignored_disliked_list = []
    ignored_liked_list = []
    if user_ai:
        if user_ai.ignored_disliked_tags:
            try:
                parsed_ig = json.loads(user_ai.ignored_disliked_tags) if isinstance(user_ai.ignored_disliked_tags, str) else user_ai.ignored_disliked_tags
                if isinstance(parsed_ig, list):
                    ignored_disliked_list = [str(t).strip().lower() for t in parsed_ig if t and str(t).strip()]
            except Exception:
                pass
        if user_ai.ignored_liked_tags:
            try:
                parsed_igl = json.loads(user_ai.ignored_liked_tags) if isinstance(user_ai.ignored_liked_tags, str) else user_ai.ignored_liked_tags
                if isinstance(parsed_igl, list):
                    ignored_liked_list = [str(t).strip().lower() for t in parsed_igl if t and str(t).strip()]
            except Exception:
                pass

    # Ignorerade dämpade ämnen kan aldrig ge ogillat-avdrag eller visas som dämpade
    for it in ignored_disliked_list:
        if it in disliked_tags_counter:
            del disliked_tags_counter[it]

    # Ignorerade gillade ämnen kan aldrig ge intressebonus eller visas som gillade
    for il in ignored_liked_list:
        if il in liked_tags_counter:
            del liked_tags_counter[il]

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
            "ignored_tags_count": len(ignored_disliked_list),
            "ignored_liked_count": len(ignored_liked_list)
        },
        "liked_tags": liked_tags_list,
        "disliked_tags": disliked_tags_list,
        "ignored_tags": ignored_disliked_list,
        "ignored_disliked_tags": ignored_disliked_list,
        "ignored_liked_tags": ignored_liked_list,
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

@app.post("/user/interest-profile/dismiss-liked-tag")
def dismiss_liked_interest_tag_endpoint(
    req: schemas.TagActionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Tar bort en tagg från gillade ämnen så den inte ger intressebonus."""
    clean_tag = req.tag.strip().lower()
    if not clean_tag:
        raise HTTPException(status_code=400, detail="Ogiltig tagg")

    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if not user_ai:
        user_ai = models.UserAISettings(user_id=current_user.id)
        db.add(user_ai)

    current_ignored_liked = []
    if user_ai.ignored_liked_tags:
        try:
            parsed = json.loads(user_ai.ignored_liked_tags) if isinstance(user_ai.ignored_liked_tags, str) else user_ai.ignored_liked_tags
            if isinstance(parsed, list):
                current_ignored_liked = [str(t).strip().lower() for t in parsed if t and str(t).strip()]
        except Exception:
            current_ignored_liked = []

    if clean_tag not in current_ignored_liked:
        current_ignored_liked.append(clean_tag)
        user_ai.ignored_liked_tags = json.dumps(current_ignored_liked)
        db.commit()

    return {"status": "ok", "tag": clean_tag, "ignored_liked_tags": current_ignored_liked}

@app.post("/user/interest-profile/unignore-liked-tag")
def unignore_liked_interest_tag_endpoint(
    req: schemas.TagActionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Återställer en tidigare borttagen tagg så den åter kan ge intressebonus."""
    clean_tag = req.tag.strip().lower()
    user_ai = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == current_user.id).first()
    if user_ai and user_ai.ignored_liked_tags:
        try:
            parsed = json.loads(user_ai.ignored_liked_tags) if isinstance(user_ai.ignored_liked_tags, str) else user_ai.ignored_liked_tags
            if isinstance(parsed, list) and clean_tag in parsed:
                parsed.remove(clean_tag)
                user_ai.ignored_liked_tags = json.dumps(parsed)
                db.commit()
                return {"status": "ok", "tag": clean_tag, "ignored_liked_tags": parsed}
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
        user_ai.ignored_liked_tags = "[]"

    db.commit()
    return {"status": "ok", "cleared_votes": count}




