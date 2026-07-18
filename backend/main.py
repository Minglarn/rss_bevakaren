from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
import os

import models, schemas, database, auth

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="RSS Bevakaren API")

# Setup default users on startup from environment variables
@app.on_event("startup")
def startup_event():
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
                # Update password if it doesn't match the current environment setting
                if not auth.verify_password(password, user.password_hash):
                    user.password_hash = auth.get_password_hash(password)
    else:
        # Fallback if no environment variables are set and database is empty
        if db.query(models.User).count() == 0:
            hashed_password = auth.get_password_hash("admin")
            default_user = models.User(username="admin", password_hash=hashed_password)
            db.add(default_user)
            
    db.commit()
    db.close()

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
    return db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()

@app.post("/feeds", response_model=schemas.FeedResponse)
def create_feed(feed: schemas.FeedCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_feed = models.Feed(url=feed.url, title=feed.title, polling_interval=feed.polling_interval, user_id=current_user.id)
    db.add(db_feed)
    db.commit()
    db.refresh(db_feed)
    return db_feed

@app.put("/feeds/{feed_id}", response_model=schemas.FeedResponse)
def update_feed(feed_id: int, feed: schemas.FeedCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_feed = db.query(models.Feed).filter(models.Feed.id == feed_id, models.Feed.user_id == current_user.id).first()
    if not db_feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    db_feed.url = feed.url
    db_feed.title = feed.title
    db_feed.polling_interval = feed.polling_interval
    db.commit()
    db.refresh(db_feed)
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

@app.get("/dashboard-feeds")
def get_dashboard_feeds(feed_id: Optional[int] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Feed).filter(models.Feed.user_id == current_user.id)
    if feed_id:
        query = query.filter(models.Feed.id == feed_id)
    feeds = query.all()
    
    all_items = []
    for f in feeds:
        items = rss_parser.fetch_feed_items(f.url)
        # Append a source indicator to each item
        for item in items:
            item["source_title"] = f.title or f.url
            item["feed_id"] = f.id
        all_items.extend(items)
    
    # Sort items by published date
    all_items.sort(key=lambda x: x.get("published", ""), reverse=True)
    return all_items

import requests
from bs4 import BeautifulSoup

@app.get("/scrape")
def scrape_article(url: str, current_user: models.User = Depends(auth.get_current_user)):
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

