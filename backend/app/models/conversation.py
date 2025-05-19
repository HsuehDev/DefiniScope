"""
對話資料庫模型
"""
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship


# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.user import User
    from app.models.message import Message
    from app.models.query import Query


class Conversation(SQLModel, table=True):
    """
    對話資料表模型：儲存使用者的對話上下文
    """
    __tablename__ = "conversations"
    
    # 主鍵
    conversation_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    
    # 對話資訊
    title: str = Field(max_length=255, default="新對話")
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_message_at: Optional[datetime] = Field(default=None, index=True)
    
    # 關聯
    user: "User" = Relationship(back_populates="conversations")
    messages: List["Message"] = Relationship(back_populates="conversation", sa_relationship_kwargs={"cascade": "all, delete"})
    queries: List["Query"] = Relationship(back_populates="conversation", sa_relationship_kwargs={"cascade": "all, delete"})
    
    # 資料表註釋與索引設定
    __table_args__ = {
        'comment': '對話資料表：儲存使用者的對話上下文'
    } 