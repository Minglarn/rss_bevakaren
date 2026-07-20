from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
import asyncio
import time
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import timedelta
import os

import models, schemas, database, auth
from pydantic import BaseModel
import logging

class WsLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("WebSocket /ws") == -1

logging.getLogger("uvicorn.access").addFilter(WsLogFilter())
logging.getLogger("uvicorn.error").addFilter(WsLogFilter())

models.Base.metadata.create_all(bind=database.engine)

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
VERSION = "2026.07.20.13"
LAST_UPDATE = "2026-07-20"

# Setup default users on startup from environment variables
@app.on_event("startup")
async def startup_event():
    print(BANNER, flush=True)
    print(f"Version: {VERSION}", flush=True)
    print(f"Senaste uppdatering: {LAST_UPDATE}", flush=True)
    
    db_path = "/data/rss.db"
    
    # Run automatic DB migrations
    if os.path.exists(db_path):
        import sqlite3
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
            pass # Column exists
            
        try:
            cur.execute("UPDATE articles SET received_ts = published_ts WHERE received_ts IS NULL;")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_articles_received_ts ON articles (received_ts);")
        except Exception as e:
            pass
            
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN last_viewed_ts INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass # Column exists
            
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN include_in_dashboard INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass # Column exists

        # Migration 6: Add notify_enabled
        try:
            cur.execute("ALTER TABLE feeds ADD COLUMN notify_enabled INTEGER DEFAULT 1;")
        except sqlite3.OperationalError:
            pass # Column exists

        # Migration 7: Add is_read to articles
        try:
            cur.execute("ALTER TABLE articles ADD COLUMN is_read INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass # Column exists
            
        conn.commit()
        conn.close()
        
        size_kb = os.path.getsize(db_path) / 1024
        print(f"Databasstorlek: {size_kb:.2f} KB", flush=True)
    else:
        print("Databasstorlek: 0 KB (Skapas nu)", flush=True)
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
    
    # Start the background polling task
    asyncio.create_task(polling_loop())

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
                    # Time to poll!
                    short_url = (feed.url[:40] + '...') if len(feed.url) > 40 else feed.url
                    print(f"Polling feed {feed.id} ({feed.title}) [{short_url}]...", flush=True)
                    
                    await manager.send_personal_message(f"POLLING_START:{feed.id}", feed.user_id)
                    try:
                        # Kör nätverksanropet i en egen tråd för att inte blockera event-loopen
                        items = await asyncio.to_thread(rss_parser.fetch_feed_items, feed.url)
                    except Exception as e:
                        print(f"Failed to fetch feed {feed.id}: {e}", flush=True)
                        items = []
                    
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
                            new_article = models.Article(
                                feed_id=feed.id,
                                guid=guid,
                                title=item.get("title"),
                                link=item.get("link"),
                                published=item.get("published"),
                                published_ts=item.get("published_ts"),
                                summary=item.get("summary"),
                                image_url=item.get("image_url"),
                                categories=cat_str,
                                received_ts=current_time
                            )
                            db.add(new_article)
                            new_articles.append(new_article)
                    
                    if new_articles:
                        print(f"Found {len(new_articles)} new articles for feed {feed.id} ({feed.title})", flush=True)
                        db.commit()
                        # Send WS update
                        await manager.send_personal_message(f"NEW_ARTICLES:{feed.id}:{len(new_articles)}", feed.user_id)
                        
                        # Check keywords and feed notify settings
                        user_keywords = db.query(models.Keyword).filter(models.Keyword.user_id == feed.user_id).all()
                        kw_texts = [kw.keyword.lower() for kw in user_keywords] if user_keywords else []
                        
                        for art in new_articles:
                            should_notify = False
                            notify_title = ""
                            notify_body = ""
                            
                            if getattr(feed, "notify_enabled", 1) == 1:
                                should_notify = True
                                notify_title = f"Ny händelse: {feed.title or 'RSS'}"
                                notify_body = art.title
                                
                                if kw_texts:
                                    search_text = f"{art.title or ''} {art.summary or ''}".lower()
                                    matched_kws = [k for k in kw_texts if k in search_text]
                                    if matched_kws:
                                        notify_title = "Nytt larmord hittat!"
                                        notify_body = f"Larmord '{matched_kws[0]}' hittades i: {art.title}"
                                    
                            if should_notify:
                                subs = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == feed.user_id).all()
                                for sub in subs:
                                    try:
                                        webpush(
                                            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                                            data=json.dumps({
                                                "title": notify_title,
                                                "body": notify_body,
                                                "url": art.link
                                            }),
                                            vapid_private_key=VAPID_KEYS["private_key"],
                                            vapid_claims={"sub": VAPID_KEYS["sub"]}
                                        )
                                        print(f"Skickade push-notis till användare {feed.user_id}", flush=True)
                                    except WebPushException as ex:
                                        print(f"WebPushException för feed {feed.id}: {repr(ex)}", flush=True)
                                        if ex.response and ex.response.status_code in [404, 410]:
                                            db.delete(sub)
                                            db.commit()
                                    except Exception as ex:
                                        print(f"Oväntat fel vid webpush: {ex}", flush=True)
                    else:
                        print(f"Polling done for feed {feed.id} ({feed.title}): 0 new articles.", flush=True)
                    
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
            models.Article.received_ts > feed.last_viewed_ts
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
def get_dashboard_feeds(feed_id: Optional[int] = None, show_read: Optional[bool] = False, search: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == current_user.id)
    if feed_id:
        query = query.filter(models.Feed.id == feed_id)
    else:
        query = query.filter(models.Feed.include_in_dashboard == 1)
        
    if not show_read:
        query = query.filter((models.Article.is_read == 0) | (models.Article.is_read == None))
        
    if search:
        query = query.filter(or_(models.Article.title.ilike(f"%{search}%"), models.Article.summary.ilike(f"%{search}%")))
        
    articles = query.order_by(models.Article.received_ts.desc()).limit(150).all()
    
    # Enhance articles with feed info for the UI
    response_items = []
    for art in articles:
        cats = art.categories.split(",") if art.categories else []
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
            "is_read": art.is_read or 0
        }
        response_items.append(art_dict)
        
    return response_items

import requests
from bs4 import BeautifulSoup

@app.get("/scrape")
def scrape_article(url: str, current_username: str = Depends(auth.get_current_username)):
    print(f"Skrapning påbörjad för URL: {url}")
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
            text_content = "Kunde inte extrahera artikeltexten från denna sida."
            
        return {"content": text_content}
    except Exception as e:
        print(f"Scrape error for {url}: {e}")
        return {"content": "Det gick inte att ladda artikeln automatiskt."}

from pywebpush import webpush, WebPushException
import json
import base64
from cryptography.hazmat.primitives.asymmetric import ec

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def get_or_create_vapid_keys():
    import os
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

@app.get("/push/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": VAPID_KEYS["public_key"]}

@app.post("/push/subscribe", response_model=dict)
def subscribe_push(sub: schemas.PushSubscriptionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check if exists
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == sub.endpoint,
        models.PushSubscription.user_id == current_user.id
    ).first()
    
    if not existing:
        db_sub = models.PushSubscription(
            endpoint=sub.endpoint,
            p256dh=sub.p256dh,
            auth=sub.auth,
            user_id=current_user.id
        )
        db.add(db_sub)
        db.commit()
    
    return {"status": "ok"}

class TestPushRequest(BaseModel):
    endpoint: Optional[str] = None

@app.post("/push/test", response_model=dict)
def test_push(req: Optional[TestPushRequest] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == current_user.id)
    if req and req.endpoint:
        query = query.filter(models.PushSubscription.endpoint == req.endpoint)
    subs = query.all()
    if not subs:
        raise HTTPException(status_code=400, detail="Ingen push-prenumeration hittades för denna användare.")
        
    success_count = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                },
                data=json.dumps({"title": "Test från Servern!", "body": "Web Push fungerar nu perfekt!"}),
                vapid_private_key=VAPID_KEYS["private_key"],
                vapid_claims={"sub": VAPID_KEYS["sub"]}
            )
            success_count += 1
            print(f"Skickade framgångsrikt test-push till {sub.endpoint}", flush=True)
        except WebPushException as ex:
            print(f"Web Push Error: {repr(ex)}")
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                db.commit()
                
    return {"status": "ok", "sent": success_count}

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
