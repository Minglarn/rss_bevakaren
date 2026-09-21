from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool = False

    class Config:
        from_attributes = True

class AdminUserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False

class AdminUserUpdate(BaseModel):
    password: Optional[str] = None
    is_admin: Optional[bool] = None

class AdminUserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    feed_count: int = 0

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    is_admin: Optional[bool] = False

class FeedBase(BaseModel):
    url: str
    title: Optional[str] = ""
    polling_interval: int = 60
    scrape_enabled: bool = True
    include_in_dashboard: bool = True
    notify_enabled: bool = True
    clickbait_enabled: bool = True
    max_items: Optional[int] = 0
    icon_url: Optional[str] = ""

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
    device_id: Optional[str] = ""

class PushSubscriptionCreate(PushSubscriptionBase):
    pass

class PushSubscriptionResponse(PushSubscriptionBase):
    id: int
    user_id: int
    user_agent: Optional[str] = ""
    device_id: Optional[str] = ""
    created_at: Optional[int] = 0
    updated_at: Optional[int] = 0

    class Config:
        from_attributes = True

class PushDeviceInfo(BaseModel):
    id: int
    endpoint_snippet: str
    device_name: str
    user_agent: Optional[str] = ""
    device_id: Optional[str] = ""
    created_at: Optional[int] = 0
    updated_at: Optional[int] = 0
    is_current: Optional[bool] = False

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
    feed_icon: Optional[str] = ""
    scrape_enabled: Optional[bool] = True
    received_ts: Optional[int] = 0
    is_read: Optional[int] = 0
    is_locked: Optional[int] = 0
    ai_processed: Optional[int] = 0
    category: Optional[str] = "Övrigt"
    priority: Optional[str] = "low"
    prio_score: Optional[int] = 0
    prio_reason: Optional[str] = ""
    urgency_score: Optional[int] = 5
    substance_score: Optional[int] = 5
    user_vote: Optional[int] = 0
    ai_duration_s: Optional[float] = None
    ai_model: Optional[str] = ""
    ai_summary: Optional[str] = None
    ai_short_summary: Optional[str] = None
    tags: Optional[List[str]] = []
    is_clickbait: Optional[int] = 0
    clickbait_reason: Optional[str] = ""
    allow_push: Optional[int] = 1
    cluster_id: Optional[int] = None
    cluster_size: Optional[int] = 1
    similar_articles: Optional[List[Dict[str, Any]]] = []
    content: Optional[str] = None

    class Config:
        from_attributes = True

class CategoryItem(BaseModel):
    name: str
    weight: int = 5

class AIConfigUpdate(BaseModel):
    prio_rules: Optional[str] = ""
    exclude_rules: Optional[str] = ""
    categories: Optional[List[Union[CategoryItem, Dict[str, Any], str]]] = None
    prio_threshold: Optional[int] = 75
    system_prompt: Optional[str] = ""
    onboarding_completed: Optional[bool] = None
    prio_enabled: Optional[bool] = None
    prio_notify_only: Optional[bool] = None
    lm_studio_model: Optional[str] = None
    ai_model: Optional[str] = None
    ai_url: Optional[str] = None
    push_include_title: Optional[bool] = None
    push_include_image: Optional[bool] = None
    push_include_summary: Optional[bool] = None
    auto_purge_enabled: Optional[bool] = None
    auto_purge_days: Optional[int] = None
    auto_scrape_article_text: Optional[bool] = None
    max_article_age_hours: Optional[int] = None
    notify_ai_offline: Optional[bool] = None
    push_summary_type: Optional[str] = None
    short_summary_max_words: Optional[int] = None
    short_summary_max_sentences: Optional[int] = None

class AIConfigResponse(BaseModel):
    prio_rules: str = ""
    exclude_rules: str = ""
    categories: List[Dict[str, Any]] = []
    prio_threshold: int = 75
    system_prompt: str = ""
    onboarding_completed: bool = False
    prio_enabled: bool = False
    prio_notify_only: bool = False
    lm_studio_url: str = ""
    lm_studio_model: str = ""
    ai_url: str = ""
    ai_model: str = ""
    server_type: str = "AI-motorn"
    available_models: List[str] = []
    is_healthy: bool = False
    push_include_title: bool = True
    push_include_image: bool = True
    push_include_summary: bool = True
    auto_purge_enabled: bool = True
    auto_purge_days: int = 30
    auto_scrape_article_text: bool = True
    max_article_age_hours: int = 24
    notify_ai_offline: bool = True
    push_summary_type: str = "short"
    short_summary_max_words: int = 20
    short_summary_max_sentences: int = 1

class ArticlePrioritizeRequest(BaseModel):
    topic: Optional[str] = None
    add_as_keyword: bool = True

class ChatMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatSource(BaseModel):
    id: int
    title: str
    source_name: str
    published_at: Optional[str] = None
    link: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    is_prio: Optional[bool] = False

class ChatResponse(BaseModel):
    reply: str
    sources: List[ChatSource] = []
    model: str = ""
    follow_ups: List[str] = []

class ClusteredArticleSummary(BaseModel):
    id: int
    feed_id: Optional[int] = None
    title: Optional[str] = ""
    source_title: Optional[str] = ""
    link: Optional[str] = ""
    published: Optional[str] = ""
    published_ts: Optional[int] = 0
    is_read: Optional[int] = 0

class DailyDigestResponse(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = ""
    content: Optional[str] = ""
    digest_type: Optional[str] = "morning"
    article_ids: Optional[List[int]] = []
    articles: Optional[List[Dict[str, Any]]] = []
    created_at: Optional[int] = 0

class DigestGenerateRequest(BaseModel):
    force_refresh: Optional[bool] = False
    force_rule_based: Optional[bool] = False

class ClusterBulkReadRequest(BaseModel):
    cluster_id: int

class ArticleVoteRequest(BaseModel):
    vote: int # 1 = Gilla, -1 = Ogilla, 0 = Nollställ

class TagActionRequest(BaseModel):
    tag: str


