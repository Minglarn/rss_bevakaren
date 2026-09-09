from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
import asyncio
import time
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from typing import List, Optional, Dict, Any
from datetime import timedelta
import os
import json

import models, schemas, database, auth, ai_service, rss_parser
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
                conn.execute(text("UPDATE user_ai_settings SET prio_enabled = 0 WHERE prio_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET prio_notify_only = 0 WHERE prio_notify_only IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_title = 1 WHERE push_include_title IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_image = 1 WHERE push_include_image IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET push_include_summary = 1 WHERE push_include_summary IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_enabled = 1 WHERE auto_purge_enabled IS NULL"))
                conn.execute(text("UPDATE user_ai_settings SET auto_purge_days = 30 WHERE auto_purge_days IS NULL"))
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
                conn.execute(text("UPDATE articles SET allow_push = 1 WHERE allow_push IS NULL"))
                conn.commit()
        except Exception as e:
            print(f"[DB] Migration notice for articles: {e}", flush=True)

        try:
            res_feeds = conn.execute(text("PRAGMA table_info(feeds)"))
            f_cols = [row[1] for row in res_feeds.fetchall()]
            if f_cols:
                if "notify_enabled" not in f_cols:
                    conn.execute(text("ALTER TABLE feeds ADD COLUMN notify_enabled INTEGER DEFAULT 1"))
                    conn.commit()
                    print("[DB] Added notify_enabled column to feeds", flush=True)
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

        # Migration 14: Add user_agent, created_at, updated_at to push_subscriptions
        for col_def in [
            ("user_agent", "TEXT DEFAULT ''"),
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
    
    # Start background polling, AI enrichment and scheduled nightly purge
    asyncio.create_task(polling_loop())
    asyncio.create_task(ai_processing_loop())
    asyncio.create_task(scheduled_purge_loop())

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
                "icon": "/pwa-192x192.png",
                "badge": "/badge.png"
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
                    short_url = (feed.url[:40] + '...') if len(feed.url) > 40 else feed.url
                    print(f"Polling feed {feed.id} ({feed.title}) [{short_url}]...", flush=True)
                    
                    await manager.send_personal_message(f"POLLING_START:{feed.id}", feed.user_id)
                    try:
                        # Kör nätverksanropet i en egen tråd för att inte blockera event-loopen
                        items = await asyncio.to_thread(rss_parser.fetch_feed_items, feed.url, feed.title)
                    except Exception as e:
                        print(f"Failed to fetch feed {feed.id}: {e}", flush=True)
                        items = []
                    
                    is_initial_poll = (feed.last_polled == 0 or feed.last_polled is None)
                    new_articles = []
                    
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
                    
                    if new_articles:
                        feed_title = feed.title or "RSS"
                        first_id = new_articles[0].id
                        last_id = new_articles[-1].id
                        id_range = f"#{first_id}" if first_id == last_id else f"#{first_id}-#{last_id}"
                        
                        # Burst-skydd: Om fler än 2 artiklar i en och samma poll kvalificerar sig för push, begränsa till max 2 nyaste
                        if not is_initial_poll:
                            push_eligible = [a for a in new_articles if a.allow_push == 1]
                            if len(push_eligible) > 2:
                                for a in push_eligible[:-2]:
                                    a.allow_push = 0
                                print(f"[ANTI-BURST] '{feed_title}': {len(push_eligible)} artiklar. Begränsar push till de 2 nyaste för att förhindra notis-bombning.", flush=True)

                        print(f"[POLL] {feed_title}: {len(new_articles)} nya artiklar sparade ({id_range})", flush=True)
                        db.commit()
                        
                        if is_initial_poll:
                            print(f"[POLL] {feed_title}: Initial inläsning slutförd, artiklar sparade tyst utan push-notiser.", flush=True)
                            await manager.send_personal_message(f"INITIAL_ARTICLES:{feed.id}:{len(new_articles)}", feed.user_id)
                        else:
                            await manager.send_personal_message(f"NEW_ARTICLES:{feed.id}:{len(new_articles)}", feed.user_id)
                        
                        # Check keywords and feed notify settings
                        user_keywords = db.query(models.Keyword).filter(models.Keyword.user_id == feed.user_id).all()
                        kw_texts = [kw.keyword.lower() for kw in user_keywords] if user_keywords else []
                        
                        if not is_initial_poll:
                            user_ai_pref = db.query(models.UserAISettings).filter(models.UserAISettings.user_id == feed.user_id).first()
                            ai_enabled_for_user = bool(user_ai_pref and user_ai_pref.prio_enabled)

                            # Om AI inte är aktiverat skickas traditionell rå-push (endast för tillåtna artiklar)
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
                    await asyncio.sleep(10)
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
                    
                    analysis = await asyncio.to_thread(
                        ai_service.analyze_article,
                        title=art.title,
                        summary=art.summary,
                        source_title=source,
                        categories=cats,
                        custom_prompt=user_prompt,
                        user_categories=user_cats,
                        model_override=user_model
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
                            print(f"[Push] Fel vid hantering av push-notis för artikel {art.id}: {push_err}", flush=True)

                        # LOGGNING ENLIGT FÖRSLAG B (Adaptivt format)
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
                                f"  Analys:   {art.category} | {art.priority.upper()} ({art.prio_score}p) | Svarstid: {dur}s\n"
                                f"  Leverans: {deliv_str}\n"
                                f"====================================================================",
                                flush=True
                            )
                        else:
                            # Kompakt 2-raders format för vanliga artiklar
                            print(
                                f"[AI: {u_display}] {source or 'RSS'} #{art.id} | {art.category} | {art.priority.upper()} ({art.prio_score}p) | {dur}s\n"
                                f"  \"{art.title}\"",
                                flush=True
                            )

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
    if not feed.title or not feed.title.strip():
        import feedparser
        parsed = feedparser.parse(feed.url)
        if parsed.feed and "title" in parsed.feed:
            feed.title = parsed.feed.title
        else:
            feed.title = feed.url

    db_feed = models.Feed(url=feed.url, title=feed.title, polling_interval=feed.polling_interval, scrape_enabled=int(feed.scrape_enabled), include_in_dashboard=int(feed.include_in_dashboard), notify_enabled=int(feed.notify_enabled), user_id=current_user.id)
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
    
    # Enhance articles with feed info for the UI
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
            "clickbait_reason": art.clickbait_reason or "" if include_ai else ""
        }
        response_items.append(art_dict)
        
    return response_items

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
    analysis = await asyncio.to_thread(
        ai_service.analyze_article,
        title=art.title,
        summary=art.summary,
        source_title=source,
        categories=cats,
        custom_prompt=user_prompt,
        user_categories=user_cats,
        model_override=user_model
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
            auto_purge_days=30
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
        auto_purge_days=int(user_ai.auto_purge_days or 30)
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
        push_include_summary=bool(user_ai.push_include_summary if user_ai.push_include_summary is not None else 1)
    )

import requests
from bs4 import BeautifulSoup

@app.get("/scrape")
def scrape_article(
    url: str, 
    feed_name: Optional[str] = None, 
    db: Session = Depends(database.get_db), 
    current_username: str = Depends(auth.get_current_username)
):
    display_name = feed_name.strip() if (feed_name and feed_name.strip()) else None
    if not display_name:
        art = db.query(models.Article).filter(models.Article.link == url).first()
        if art and art.feed:
            display_name = art.feed.title or art.feed.url
            
    name_str = display_name if display_name else "Okänt flöde"
    print(f"Scraping started for feed: {name_str}")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.text, "html.parser")
        
        # Simple extraction: find all paragraphs inside main or article tags, 
        # fallback to all paragraphs if not found
        article_body = soup.find("article") or soup.find("main") or soup.find("body")
        if article_body:
            paragraphs = article_body.find_all("p")
        else:
            paragraphs = soup.find_all("p")
            
        text_content = "\n\n".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))
        
        if not text_content:
            text_content = "Could not extract article text from this page."
            
        return {"content": text_content}
    except Exception as e:
        print(f"Scrape error for feed '{name_str}': {e}")
        return {"content": "Could not load article automatically."}

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

    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == sub.endpoint
    ).first()
    
    if existing:
        existing.user_id = current_user.id
        existing.p256dh = sub.p256dh
        existing.auth = sub.auth
        existing.user_agent = user_agent
        existing.updated_at = now_ts
        db.commit()
        print(f"[Push] Uppdaterade prenumeration för enhet ({dev_name}) kopplad till '{current_user.username}'", flush=True)
    else:
        db_sub = models.PushSubscription(
            endpoint=sub.endpoint,
            p256dh=sub.p256dh,
            auth=sub.auth,
            user_id=current_user.id,
            user_agent=user_agent,
            created_at=now_ts,
            updated_at=now_ts
        )
        db.add(db_sub)
        db.commit()
        print(f"[Push] Registrerade ny prenumerationsenhet ({dev_name}) för '{current_user.username}'", flush=True)
    
    return {"status": "ok"}

@app.post("/push/unsubscribe", response_model=dict)
def unsubscribe_push(sub: schemas.PushSubscriptionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
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
    subs = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == current_user.id).all()
    result = []
    for sub in subs:
        endpoint_snip = sub.endpoint[-28:] if sub.endpoint else "okänd"
        dev_title = parse_device_name(sub.user_agent)
        is_cur = bool(current_ua and sub.user_agent and current_ua == sub.user_agent)
        result.append(schemas.PushDeviceInfo(
            id=sub.id,
            endpoint_snippet=endpoint_snip,
            device_name=dev_title,
            user_agent=sub.user_agent or "",
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

