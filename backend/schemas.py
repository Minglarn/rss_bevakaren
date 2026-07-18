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

class FeedCreate(FeedBase):
    pass

class FeedResponse(FeedBase):
    id: int
    user_id: int

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
