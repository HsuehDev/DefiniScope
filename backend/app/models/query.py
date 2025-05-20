"""
查詢模型定義
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
    from app.models.file import File
    from app.models.sentence import Sentence


class QueryStatus(str, Enum):
    """
    查詢狀態枚舉
    """
    PENDING = "pending"         # 等待處理
    IN_PROGRESS = "in_progress" # 處理中
    COMPLETED = "completed"     # 處理完成
    FAILED = "failed"           # 處理失敗


class Query(SQLModel, table=True):
    """
    查詢數據模型
    """
    __tablename__ = "queries"
    
    # 主鍵
    query_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    file_uuid: Optional[uuid.UUID] = Field(foreign_key="files.file_uuid", index=True, nullable=True)
    
    # 查詢內容
    query_text: str = Field(..., index=True)
    
    # 狀態追蹤
    status: str = Field(default=QueryStatus.PENDING.value, index=True)
    error_message: Optional[str] = Field(default=None)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    
    # 處理時間追蹤
    processing_started_at: Optional[datetime] = Field(default=None)
    processing_completed_at: Optional[datetime] = Field(default=None)
    
    # 關聯
    user: "User" = Relationship(back_populates="queries")
    file: Optional["File"] = Relationship(back_populates="queries")


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