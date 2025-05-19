"""
檔案資料庫模型
"""
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from enum import Enum

from sqlmodel import Field, SQLModel, Relationship

# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.user import User
    from app.models.sentence import Sentence


class UploadStatus(str, Enum):
    """
    上傳狀態枚舉
    """
    PENDING = "pending"         # 等待上傳
    IN_PROGRESS = "in_progress" # 上傳中
    COMPLETED = "completed"     # 上傳完成
    FAILED = "failed"           # 上傳失敗
    TIMEOUT = "timeout"         # 上傳超時


class ProcessingStatus(str, Enum):
    """
    處理狀態枚舉
    """
    PENDING = "pending"         # 等待處理
    IN_PROGRESS = "in_progress" # 處理中
    COMPLETED = "completed"     # 處理完成
    FAILED = "failed"           # 處理失敗


class File(SQLModel, table=True):
    """
    檔案資料表模型：儲存使用者上傳的檔案元數據和處理狀態
    """
    __tablename__ = "files"
    
    # 主鍵，使用UUID代替自增ID
    file_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    
    # 檔案基本資訊
    original_name: str = Field(max_length=255, nullable=False)
    size_bytes: int = Field(nullable=False)
    
    # MinIO 儲存資訊
    minio_bucket_name: str = Field(max_length=100, nullable=False)
    minio_object_key: str = Field(max_length=255, nullable=False)
    
    # 檔案狀態
    upload_status: str = Field(max_length=20, default=UploadStatus.PENDING.value, nullable=False)
    processing_status: str = Field(max_length=20, default=ProcessingStatus.PENDING.value, nullable=False)
    error_message: Optional[str] = Field(default=None)
    
    # 處理結果統計
    sentence_count: int = Field(default=0)
    cd_count: int = Field(default=0)  # 概念型定義數量
    od_count: int = Field(default=0)  # 操作型定義數量
    
    # 上傳時間追踪
    upload_started_at: Optional[datetime] = Field(default=None)
    upload_completed_at: Optional[datetime] = Field(default=None)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    
    # 關聯
    user: "User" = Relationship(back_populates="files")
    sentences: List["Sentence"] = Relationship(back_populates="file", sa_relationship_kwargs={"cascade": "all, delete"})
    
    # 資料表註釋與索引設定
    __table_args__ = (
        {"comment": "檔案資料表：儲存使用者上傳的檔案元數據和處理狀態"}
    ) 