"""
上傳分片資料庫模型
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship


# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.user import User


class UploadChunk(SQLModel, table=True):
    """
    上傳分片資料表模型：追踪檔案分片上傳狀態，支援斷點續傳
    """
    __tablename__ = "upload_chunks"
    
    # 主鍵
    chunk_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    
    # 分片上傳資訊
    upload_id: str = Field(max_length=100, nullable=False)
    file_id: str = Field(max_length=100, nullable=False)
    chunk_number: int = Field(nullable=False)
    chunk_total: int = Field(nullable=False)
    chunk_size: int = Field(nullable=False)
    
    # MinIO 儲存資訊
    minio_bucket_name: str = Field(max_length=100, nullable=False)
    minio_object_key: str = Field(max_length=255, nullable=False)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    expires_at: datetime = Field(nullable=False, index=True)
    
    # 關聯
    user: "User" = Relationship(back_populates="upload_chunks")
    
    # 資料表註釋與索引設定
    __table_args__ = {
        'comment': '上傳分片資料表：追踪檔案分片上傳狀態，支援斷點續傳'
    } 