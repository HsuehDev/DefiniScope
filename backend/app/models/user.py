"""
用戶資料庫模型
"""
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship
from pydantic import EmailStr

# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.file import File
    from app.models.sentence import Sentence
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.models.upload_chunk import UploadChunk
    from app.models.query import Query


class User(SQLModel, table=True):
    """
    使用者資料表模型：儲存系統使用者的帳戶資訊和認證資料
    """
    __tablename__ = "users"
    
    # 主鍵，使用UUID代替自增ID以提高安全性
    user_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 使用者認證資訊
    email: str = Field(max_length=255, index=True, unique=True, nullable=False)
    password_hash: str = Field(max_length=255, nullable=False)
    
    # 用戶個人資訊
    full_name: Optional[str] = Field(default=None)
    
    # 狀態資訊
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_login_at: Optional[datetime] = Field(default=None)
    
    # 關聯
    files: List["File"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete"})
    sentences: List["Sentence"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete"})
    conversations: List["Conversation"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete"})
    messages: List["Message"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete"})
    upload_chunks: List["UploadChunk"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete"})
    queries: List["Query"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete"})
    
    # 資料表註釋與索引設定
    __table_args__ = {
        'comment': '使用者資料表：儲存系統使用者的帳戶資訊和認證資料'
    } 