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
    ai_settings = relationship("UserAISettings", back_populates="owner", uselist=False, cascade="all, delete-orphan")

class Feed(Base):
    __tablename__ = "feeds"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, index=True)
    title = Column(String, default="")
    polling_interval = Column(Integer, default=60)
    scrape_enabled = Column(Integer, default=1) # SQLite doesn't have native Boolean, use Integer
    last_polled = Column(Integer, default=0) # timestamp
    last_viewed_ts = Column(Integer, default=0) # timestamp
    include_in_dashboard = Column(Integer, default=1) # 1 = true, 0 = false
    notify_enabled = Column(Integer, default=1) # 1 = true, 0 = false
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
    is_read = Column(Integer, default=0)
    is_locked = Column(Integer, default=0)
    ai_processed = Column(Integer, default=0, index=True)
    category = Column(String, default="Övrigt", index=True)
    priority = Column(String, default="low", index=True)
    prio_score = Column(Integer, default=0)
    prio_reason = Column(String, default="")
    ai_summary = Column(String, nullable=True)
    tags = Column(String, default="[]")
    is_clickbait = Column(Integer, default=0)
    clickbait_reason = Column(String, default="")

    feed = relationship("Feed", back_populates="articles")
 
class UserAISettings(Base):
    __tablename__ = "user_ai_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    prio_rules = Column(String, default="") # Fritext vad användaren prioriterar
    exclude_rules = Column(String, default="") # Fritext vad som ska nedprioriteras
    categories = Column(String, default='["Teknik", "Politik", "Blåljus", "Lokalt", "Ekonomi", "Nöje", "Övrigt"]')
    prio_threshold = Column(Integer, default=75) # Poängtröskel för "high"
    custom_system_prompt = Column(String, default="") # Anpassad eller genererad systemprompt
    onboarding_completed = Column(Integer, default=0) # 0 = ej genomförd, 1 = genomförd
    prio_enabled = Column(Integer, default=0) # 0 = inaktiverad, 1 = aktivt personligt PRIO-flöde
    prio_notify_only = Column(Integer, default=0) # 1 = endast notiser för PRIO-flödet, 0 = alla artiklar
    selected_model = Column(String, default="") # Vald LM Studio-modell (tom = standard/aktiv)

    owner = relationship("User", back_populates="ai_settings")
