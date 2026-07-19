from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

    feeds = relationship("Feed", back_populates="owner")
    keywords = relationship("Keyword", back_populates="owner")
    push_subscriptions = relationship("PushSubscription", back_populates="owner")

class Feed(Base):
    __tablename__ = "feeds"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, index=True)
    title = Column(String, default="")
    polling_interval = Column(Integer, default=60)
    scrape_enabled = Column(Integer, default=1) # SQLite doesn't have native Boolean, use Integer
    last_polled = Column(Integer, default=0) # timestamp
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="feeds")
    articles = relationship("Article", back_populates="feed", cascade="all, delete-orphan")

class Keyword(Base):
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="keywords")

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String, unique=True)
    p256dh = Column(String)
    auth = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="push_subscriptions")

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    feed_id = Column(Integer, ForeignKey("feeds.id"))
    guid = Column(String, index=True) # To prevent duplicates
    title = Column(String)
    link = Column(String)
    published = Column(String)
    published_ts = Column(Integer, index=True)
    received_ts = Column(Integer, index=True)
    summary = Column(String)
    image_url = Column(String)
    categories = Column(String)

    feed = relationship("Feed", back_populates="articles")
