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
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="feeds")

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
