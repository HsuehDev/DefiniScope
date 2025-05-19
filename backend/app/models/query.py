"""
查詢相關模型
"""
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from enum import Enum

from sqlmodel import Field, SQLModel, Relationship
from pydantic import BaseModel


# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.user import User
    from app.models.conversation import Conversation


class QueryStatus(str, Enum):
    """
    查詢狀態枚舉
    """
    PENDING = "pending"      # 等待處理
    PROCESSING = "processing" # 處理中
    COMPLETED = "completed"  # 處理完成
    FAILED = "failed"        # 處理失敗


class Query(SQLModel, table=True):
    """
    查詢資料表模型：儲存使用者的查詢及其處理狀態
    """
    __tablename__ = "queries"
    
    # 主鍵，使用UUID代替自增ID
    query_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    conversation_uuid: uuid.UUID = Field(foreign_key="conversations.conversation_uuid", index=True, nullable=False)
    
    # 查詢內容
    content: str = Field(nullable=False)
    
    # 處理狀態
    status: str = Field(max_length=20, default=QueryStatus.PENDING.value, nullable=False)
    error_message: Optional[str] = Field(default=None)
    
    # 處理結果
    keywords: Optional[str] = Field(default=None)  # 提取的關鍵詞，以JSON字符串儲存
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    completed_at: Optional[datetime] = Field(default=None)
    
    # 關聯
    user: "User" = Relationship(back_populates="queries")
    conversation: "Conversation" = Relationship(back_populates="queries")
    
    # 資料表註釋與索引設定
    __table_args__ = (
        {"comment": "查詢資料表：儲存使用者的查詢及其處理狀態"}
    )


# API 模型
class QueryCreate(BaseModel):
    """
    創建查詢的請求模型
    """
    content: str
    conversation_uuid: Optional[uuid.UUID] = None


class QueryResponse(BaseModel):
    """
    查詢回應模型
    """
    query_uuid: uuid.UUID
    conversation_uuid: uuid.UUID
    content: str
    status: str
    created_at: datetime
    
    class Config:
        orm_mode = True 