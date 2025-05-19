"""
消息資料庫模型
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship


# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.user import User
    from app.models.conversation import Conversation
    from app.models.message_reference import MessageReference


class MessageRole(str, Enum):
    """消息角色枚舉"""
    USER = "user"  # 使用者訊息
    ASSISTANT = "assistant"  # 系統回應


class Message(SQLModel, table=True):
    """
    消息資料表模型：儲存對話中的使用者查詢和系統回應
    """
    __tablename__ = "messages"
    
    # 主鍵
    message_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    conversation_uuid: uuid.UUID = Field(foreign_key="conversations.conversation_uuid", index=True, nullable=False)
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    
    # 消息內容
    role: str = Field(max_length=20, nullable=False)
    content: str = Field(nullable=False)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False, index=True)
    
    # 關聯
    conversation: "Conversation" = Relationship(back_populates="messages")
    user: "User" = Relationship(back_populates="messages")
    references: List["MessageReference"] = Relationship(back_populates="message", sa_relationship_kwargs={"cascade": "all, delete"})
    
    # 資料表註釋與索引設定
    __table_args__ = {
        'comment': '消息資料表：儲存對話中的使用者查詢和系統回應'
    } 