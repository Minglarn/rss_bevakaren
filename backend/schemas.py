from pydantic import BaseModel
from typing import List, Optional

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class FeedBase(BaseModel):
    url: str
    title: Optional[str] = ""
    polling_interval: int = 60
    scrape_enabled: bool = True
    include_in_dashboard: bool = True
    notify_enabled: bool = True

class FeedCreate(FeedBase):
    pass

class FeedResponse(FeedBase):
    id: int
    user_id: int
    unread_count: int = 0

    class Config:
        from_attributes = True

class KeywordBase(BaseModel):
    keyword: str

class KeywordCreate(KeywordBase):
    pass

class KeywordResponse(KeywordBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class PushSubscriptionBase(BaseModel):
    endpoint: str
    p256dh: str
    auth: str

class PushSubscriptionCreate(PushSubscriptionBase):
    pass

class PushSubscriptionResponse(PushSubscriptionBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class ArticleResponse(BaseModel):
    id: int
    feed_id: int
    guid: Optional[str] = None
    title: Optional[str] = None
    link: Optional[str] = None
    published: Optional[str] = None
    published_ts: Optional[int] = 0
    summary: Optional[str] = None
    image_url: Optional[str] = None
    categories: Optional[List[str]] = []
    source_title: Optional[str] = None
    scrape_enabled: Optional[bool] = True
    received_ts: Optional[int] = 0
    is_read: Optional[int] = 0
    is_locked: Optional[int] = 0

    class Config:
        from_attributes = True
