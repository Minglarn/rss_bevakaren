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
    ai_processed: Optional[int] = 0
    category: Optional[str] = "Övrigt"
    priority: Optional[str] = "low"
    prio_score: Optional[int] = 0
    prio_reason: Optional[str] = ""
    ai_summary: Optional[str] = None
    tags: Optional[List[str]] = []

    class Config:
        from_attributes = True

class CategoryItem(BaseModel):
    name: str
    weight: int = 5

class AIConfigUpdate(BaseModel):
    prio_rules: Optional[str] = ""
    exclude_rules: Optional[str] = ""
    categories: Optional[List[Any]] = []
    prio_threshold: Optional[int] = 75
    system_prompt: Optional[str] = ""
    onboarding_completed: Optional[bool] = None
    prio_enabled: Optional[bool] = None
    lm_studio_model: Optional[str] = None

class AIConfigResponse(BaseModel):
    prio_rules: str = ""
    exclude_rules: str = ""
    categories: List[Dict[str, Any]] = []
    prio_threshold: int = 75
    system_prompt: str = ""
    onboarding_completed: bool = False
    prio_enabled: bool = False
    lm_studio_url: str = ""
    lm_studio_model: str = ""
    available_models: List[str] = []
    is_healthy: bool = False

class ArticlePrioritizeRequest(BaseModel):
    topic: Optional[str] = None
    add_as_keyword: bool = True
