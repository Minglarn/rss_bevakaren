from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

import models, schemas, database, auth

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="RSS Bevakaren API")

# Setup default user on startup if no users exist
@app.on_event("startup")
def startup_event():
    db = database.SessionLocal()
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
    db_feed = models.Feed(url=feed.url, title=feed.title, user_id=current_user.id)
    db.add(db_feed)
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
@app.get("/dashboard-feeds")
def get_dashboard_feeds(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    feeds = db.query(models.Feed).filter(models.Feed.user_id == current_user.id).all()
    all_items = []
    for f in feeds:
        items = rss_parser.fetch_feed_items(f.url)
        # Append a source indicator to each item
        for item in items:
            item["source_title"] = f.title or f.url
        all_items.extend(items)
    
    # Sort items by published date (simplified, string comparison might not be perfect for all RSS dates)
    all_items.sort(key=lambda x: x.get("published", ""), reverse=True)
    return all_items

