"""
檔案資料庫模型
"""
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from enum import Enum, auto

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
    UPLOADING = "uploading"     # 上傳中
    COMPLETED = "completed"     # 上傳完成
    FAILED = "failed"           # 上傳失敗
    EXPIRED = "expired"         # 上傳過期


class ProcessingStatus(str, Enum):
    """
    處理狀態枚舉
    """
    PENDING = "pending"             # 等待處理
    EXTRACTING = "extracting"       # 抽取文本中
    SPLITTING = "splitting"         # 切分句子中
    CLASSIFYING = "classifying"     # 分類定義中
    COMPLETED = "completed"         # 處理完成
    FAILED = "failed"               # 處理失敗


class File(SQLModel, table=True):
    """
    檔案資料表模型
    """
    __tablename__ = "files"
    
    # 主鍵，使用UUID代替自增ID
    uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 檔案關聯的使用者
    user_uuid: uuid.UUID = Field(foreign_key="users.uuid", index=True, nullable=False)
    
    # 檔案基本信息
    original_name: str = Field(nullable=False)
    size_bytes: int = Field(nullable=False)
    mime_type: str = Field(default="application/pdf", nullable=False)
    
    # MinIO 存儲信息
    minio_bucket_name: str = Field(nullable=False)
    minio_object_key: str = Field(nullable=False)
    
    # 檔案狀態
    upload_status: UploadStatus = Field(default=UploadStatus.PENDING, nullable=False)
    processing_status: ProcessingStatus = Field(default=ProcessingStatus.PENDING, nullable=False)
    error_message: Optional[str] = Field(default=None)
    
    # 處理統計信息
    sentence_count: Optional[int] = Field(default=None)
    cd_count: Optional[int] = Field(default=None)  # 概念型定義數量
    od_count: Optional[int] = Field(default=None)  # 操作型定義數量
    
    # 分片上傳信息
    upload_id: Optional[str] = Field(default=None)
    chunk_total: Optional[int] = Field(default=None)
    chunks_received: Optional[int] = Field(default=None)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    
    # 關聯
    # user: Optional["User"] = Relationship(back_populates="files")
    # sentences: List["Sentence"] = Relationship(back_populates="file") 