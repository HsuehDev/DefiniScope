"""
檔案相關的Pydantic模式
"""
from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field


class FileCreate(BaseModel):
    """創建檔案請求模式"""
    original_name: str = Field(..., description="原始檔名")
    size_bytes: int = Field(..., description="檔案大小（位元組）")
    minio_bucket_name: str = Field(..., description="MinIO桶名稱")
    minio_object_key: str = Field(..., description="MinIO對象鍵")


class FileResponse(BaseModel):
    """檔案回應模式"""
    file_uuid: UUID = Field(..., description="檔案唯一識別碼")
    original_name: str = Field(..., description="原始檔名")
    size_bytes: int = Field(..., description="檔案大小（位元組）")
    upload_status: str = Field(..., description="上傳狀態")
    processing_status: str = Field(..., description="處理狀態")
    sentence_count: Optional[int] = Field(None, description="句子總數")
    cd_count: Optional[int] = Field(None, description="概念型定義數量")
    od_count: Optional[int] = Field(None, description="操作型定義數量")
    created_at: datetime = Field(..., description="創建時間")
    updated_at: datetime = Field(..., description="更新時間")


class FileListResponse(BaseModel):
    """檔案列表回應模式"""
    total: int = Field(..., description="總檔案數")
    page: int = Field(..., description="當前頁碼")
    limit: int = Field(..., description="每頁項目數")
    files: List[FileResponse] 