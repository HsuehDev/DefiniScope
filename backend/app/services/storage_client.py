import os
import time
from typing import Optional, Dict, List, BinaryIO, Union, Tuple
import logging
from datetime import timedelta
import json
from functools import wraps
import uuid
from contextlib import contextmanager

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
import redis.asyncio as redis
from pydantic import BaseModel

from app.core.config import settings
from app.core.minio_client import (
    ensure_bucket_exists,
    upload_file,
    download_file,
    delete_file,
    generate_presigned_url,
    check_upload_timeout
)
from app.utils.file_utils import sanitize_filename, get_file_extension, get_content_type
from app.models.file import FileUploadStatus

logger = logging.getLogger(__name__)

# 分片上傳相關資料結構
class UploadPartInfo(BaseModel):
    """分片上傳資訊模型"""
    part_number: int
    etag: str
    size: int
    
class ChunkMetadata(BaseModel):
    """分片元數據模型"""
    upload_id: str
    file_id: str
    file_name: str
    chunk_number: int
    chunk_total: int
    chunk_size: int
    total_size: int
    bucket_name: str
    object_key: str
    uploaded_parts: List[UploadPartInfo] = []
    
def handle_minio_exceptions(func):
    """處理 MinIO 操作可能出現的異常的裝飾器"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", str(e))
            logger.error(f"MinIO 操作錯誤: {error_code} - {error_message}")
            
            if error_code == "NoSuchBucket":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"儲存桶不存在: {error_message}"
                )
            elif error_code == "NoSuchKey":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"物件不存在: {error_message}"
                )
            elif error_code == "AccessDenied":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"存取被拒絕: {error_message}"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"儲存服務錯誤: {error_message}"
                )
        except Exception as e:
            logger.exception("MinIO 操作發生未預期錯誤")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"儲存服務未預期錯誤: {str(e)}"
            )
    return wrapper

class MinIOClient:
    """MinIO 客戶端封裝，提供簡化的物件儲存操作介面"""
    
    def __init__(self, redis_client: redis.Redis):
        """
        初始化 MinIO 客戶端
        
        從環境變數獲取 MinIO 連線資訊，並設置客戶端
        """
        # 從環境變數讀取 MinIO 連線資訊
        self.endpoint_url = os.getenv("MINIO_URL", "http://minio:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY")
        self.secret_key = os.getenv("MINIO_SECRET_KEY")
        self.region = os.getenv("MINIO_REGION", "us-east-1")
        
        if not self.access_key or not self.secret_key:
            raise ValueError("MinIO 存取金鑰和秘密金鑰必須在環境變數中配置")
        
        # 初始化 S3 客戶端 (MinIO 相容 S3 API)
        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            # 若為自簽證書的環境，可能需要
            # verify=False
        )
        
        # 初始化用於分片上傳狀態追蹤的 Redis 客戶端
        self.redis_client = redis_client
        # 分片上傳狀態在 Redis 中的過期時間 (24小時)
        self.chunk_metadata_ttl = 86400
        
    @handle_minio_exceptions
    async def create_bucket_if_not_exists(self, bucket_name: str) -> bool:
        """
        如果指定的 bucket 不存在，則創建它
        
        Args:
            bucket_name: 要創建的 bucket 名稱
            
        Returns:
            bool: 操作是否成功
            
        根據 PRD 3.1 的 Bucket 策略，為每個用戶創建專屬的 bucket
        """
        try:
            # 檢查 bucket 是否已存在
            self.s3_client.head_bucket(Bucket=bucket_name)
            logger.info(f"儲存桶已存在: {bucket_name}")
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            
            # 如果 bucket 不存在，創建它
            if error_code == "404" or error_code == "NoSuchBucket":
                self.s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={"LocationConstraint": self.region}
                )
                logger.info(f"已創建儲存桶: {bucket_name}")
                return True
            else:
                # 其他錯誤則拋出
                raise
    
    @handle_minio_exceptions
    async def upload_object(
        self, 
        bucket_name: str, 
        object_key: str, 
        file_data: Union[BinaryIO, bytes], 
        content_type: str = "application/octet-stream"
    ) -> Dict:
        """
        將檔案上傳到 MinIO
        
        Args:
            bucket_name: 目標 bucket 名稱
            object_key: 物件的鍵值 (路徑+名稱)
            file_data: 要上傳的檔案資料，可以是檔案流或二進制資料
            content_type: 檔案的 MIME 類型
            
        Returns:
            Dict: 上傳結果資訊
        """
        # 確保 bucket 存在
        await self.create_bucket_if_not_exists(bucket_name)
        
        # 執行上傳
        response = self.s3_client.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=file_data,
            ContentType=content_type
        )
        
        logger.info(f"已上傳物件: {bucket_name}/{object_key}")
        return {
            "bucket": bucket_name,
            "key": object_key,
            "etag": response.get("ETag", "").strip('"'),
            "content_type": content_type
        }
    
    @handle_minio_exceptions
    async def download_object(self, bucket_name: str, object_key: str) -> bytes:
        """
        從 MinIO 下載檔案
        
        Args:
            bucket_name: 來源 bucket 名稱
            object_key: 物件的鍵值 (路徑+名稱)
            
        Returns:
            bytes: 檔案的二進制資料
        """
        response = self.s3_client.get_object(
            Bucket=bucket_name,
            Key=object_key
        )
        
        # 讀取檔案內容
        file_content = response["Body"].read()
        logger.info(f"已下載物件: {bucket_name}/{object_key}")
        return file_content
    
    @handle_minio_exceptions
    async def get_presigned_download_url(
        self, 
        bucket_name: str, 
        object_key: str, 
        expires_in: int = 900  # 15分鐘
    ) -> str:
        """
        生成物件的預簽名下載 URL
        
        Args:
            bucket_name: bucket 名稱
            object_key: 物件的鍵值 (路徑+名稱)
            expires_in: URL 有效期，單位為秒
            
        Returns:
            str: 預簽名 URL
            
        根據 PRD 3.3 的存取控制，使用預簽名 URL 提供臨時檔案存取權限
        """
        presigned_url = self.s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket_name,
                'Key': object_key
            },
            ExpiresIn=expires_in
        )
        
        logger.info(f"已生成預簽名下載 URL: {bucket_name}/{object_key}, 有效期: {expires_in}秒")
        return presigned_url
    
    @handle_minio_exceptions
    async def delete_object(self, bucket_name: str, object_key: str) -> bool:
        """
        從 MinIO 刪除物件
        
        Args:
            bucket_name: bucket 名稱
            object_key: 物件的鍵值 (路徑+名稱)
            
        Returns:
            bool: 操作是否成功
        """
        self.s3_client.delete_object(
            Bucket=bucket_name,
            Key=object_key
        )
        
        logger.info(f"已刪除物件: {bucket_name}/{object_key}")
        return True
    
    @handle_minio_exceptions
    async def init_multipart_upload(
        self, 
        bucket_name: str, 
        object_key: str, 
        file_id: str,
        file_name: str,
        total_size: int,
        chunk_total: int,
        content_type: str = "application/octet-stream"
    ) -> Dict:
        """
        初始化分片上傳
        
        Args:
            bucket_name: bucket 名稱
            object_key: 物件的鍵值 (路徑+名稱)
            file_id: 檔案 ID
            file_name: 檔案原始名稱
            total_size: 檔案總大小
            chunk_total: 分片總數
            content_type: 檔案的 MIME 類型
            
        Returns:
            Dict: 分片上傳的初始化資訊
            
        根據 PRD 3.2 的物件命名策略，支援分片上傳
        """
        # 確保 bucket 存在
        await self.create_bucket_if_not_exists(bucket_name)
        
        # 初始化分片上傳
        response = self.s3_client.create_multipart_upload(
            Bucket=bucket_name,
            Key=object_key,
            ContentType=content_type
        )
        
        upload_id = response["UploadId"]
        logger.info(f"已初始化分片上傳: {bucket_name}/{object_key}, UploadId: {upload_id}")
        
        # 在 Redis 中儲存分片上傳的元數據
        chunk_metadata = ChunkMetadata(
            upload_id=upload_id,
            file_id=file_id,
            file_name=file_name,
            chunk_number=0,  # 初始已上傳數量為0
            chunk_total=chunk_total,
            chunk_size=total_size // chunk_total,
            total_size=total_size,
            bucket_name=bucket_name,
            object_key=object_key,
            uploaded_parts=[]
        )
        
        # 儲存元數據到 Redis
        redis_key = f"upload:{file_id}:{upload_id}"
        await self.redis_client.set(
            redis_key, 
            chunk_metadata.json(), 
            ex=self.chunk_metadata_ttl
        )
        
        return {
            "upload_id": upload_id,
            "bucket_name": bucket_name,
            "object_key": object_key
        }
    
    @handle_minio_exceptions
    async def upload_part(
        self, 
        bucket_name: str, 
        object_key: str, 
        upload_id: str, 
        part_number: int, 
        file_id: str,
        body: Union[BinaryIO, bytes]
    ) -> Dict:
        """
        上傳分片
        
        Args:
            bucket_name: bucket 名稱
            object_key: 物件的鍵值 (路徑+名稱)
            upload_id: 分片上傳 ID
            part_number: 分片編號 (從1開始)
            file_id: 檔案 ID
            body: 分片內容
            
        Returns:
            Dict: 分片上傳結果
        """
        # 上傳分片
        response = self.s3_client.upload_part(
            Bucket=bucket_name,
            Key=object_key,
            UploadId=upload_id,
            PartNumber=part_number,
            Body=body
        )
        
        etag = response["ETag"].strip('"')
        logger.info(f"已上傳分片: {bucket_name}/{object_key}, UploadId: {upload_id}, Part: {part_number}")
        
        # 更新 Redis 中的分片上傳元數據
        redis_key = f"upload:{file_id}:{upload_id}"
        chunk_metadata_json = await self.redis_client.get(redis_key)
        
        if not chunk_metadata_json:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"找不到上傳元數據，可能已過期: {upload_id}"
            )
        
        chunk_metadata = ChunkMetadata.parse_raw(chunk_metadata_json)
        
        # 添加已上傳的分片資訊
        part_info = UploadPartInfo(
            part_number=part_number,
            etag=etag,
            size=len(body) if isinstance(body, bytes) else 0
        )
        
        # 更新已上傳的分片列表
        chunk_metadata.uploaded_parts.append(part_info)
        chunk_metadata.chunk_number += 1
        
        # 更新 Redis 資料
        await self.redis_client.set(
            redis_key, 
            chunk_metadata.json(), 
            ex=self.chunk_metadata_ttl
        )
        
        return {
            "part_number": part_number,
            "etag": etag,
            "upload_id": upload_id,
            "progress": {
                "completed": chunk_metadata.chunk_number,
                "total": chunk_metadata.chunk_total,
                "percentage": round(chunk_metadata.chunk_number / chunk_metadata.chunk_total * 100, 2)
            }
        }
    
    @handle_minio_exceptions
    async def complete_multipart_upload(
        self, 
        file_id: str, 
        upload_id: str
    ) -> Dict:
        """
        完成分片上傳
        
        Args:
            file_id: 檔案 ID
            upload_id: 分片上傳 ID
            
        Returns:
            Dict: 完成分片上傳的結果
        """
        # 從 Redis 獲取分片上傳元數據
        redis_key = f"upload:{file_id}:{upload_id}"
        chunk_metadata_json = await self.redis_client.get(redis_key)
        
        if not chunk_metadata_json:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"找不到上傳元數據，可能已過期: {upload_id}"
            )
        
        chunk_metadata = ChunkMetadata.parse_raw(chunk_metadata_json)
        
        # 檢查是否所有分片都已上傳
        if chunk_metadata.chunk_number != chunk_metadata.chunk_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"分片上傳不完整: 已上傳 {chunk_metadata.chunk_number}/{chunk_metadata.chunk_total} 個分片"
            )
        
        # 排序分片
        parts = sorted(chunk_metadata.uploaded_parts, key=lambda x: x.part_number)
        
        # 準備完成分片上傳
        multipart_upload = {
            "Parts": [
                {
                    "PartNumber": part.part_number,
                    "ETag": part.etag
                }
                for part in parts
            ]
        }
        
        # 完成分片上傳
        response = self.s3_client.complete_multipart_upload(
            Bucket=chunk_metadata.bucket_name,
            Key=chunk_metadata.object_key,
            UploadId=upload_id,
            MultipartUpload=multipart_upload
        )
        
        # 清理 Redis 中的上傳元數據
        await self.redis_client.delete(redis_key)
        
        logger.info(f"已完成分片上傳: {chunk_metadata.bucket_name}/{chunk_metadata.object_key}")
        return {
            "bucket": chunk_metadata.bucket_name,
            "key": chunk_metadata.object_key,
            "etag": response.get("ETag", "").strip('"'),
            "location": response.get("Location", ""),
            "file_name": chunk_metadata.file_name,
            "file_id": file_id,
            "size": chunk_metadata.total_size
        }
    
    @handle_minio_exceptions
    async def abort_multipart_upload(
        self, 
        file_id: str, 
        upload_id: str
    ) -> bool:
        """
        中止分片上傳
        
        Args:
            file_id: 檔案 ID
            upload_id: 分片上傳 ID
            
        Returns:
            bool: 操作是否成功
        """
        # 從 Redis 獲取分片上傳元數據
        redis_key = f"upload:{file_id}:{upload_id}"
        chunk_metadata_json = await self.redis_client.get(redis_key)
        
        if not chunk_metadata_json:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"找不到上傳元數據，可能已過期: {upload_id}"
            )
        
        chunk_metadata = ChunkMetadata.parse_raw(chunk_metadata_json)
        
        # 中止分片上傳
        self.s3_client.abort_multipart_upload(
            Bucket=chunk_metadata.bucket_name,
            Key=chunk_metadata.object_key,
            UploadId=upload_id
        )
        
        # 清理 Redis 中的上傳元數據
        await self.redis_client.delete(redis_key)
        
        logger.info(f"已中止分片上傳: {chunk_metadata.bucket_name}/{chunk_metadata.object_key}")
        return True
    
    @handle_minio_exceptions
    async def get_upload_status(
        self, 
        file_id: str, 
        upload_id: str
    ) -> Dict:
        """
        獲取分片上傳狀態
        
        Args:
            file_id: 檔案 ID
            upload_id: 分片上傳 ID
            
        Returns:
            Dict: 上傳狀態資訊
        """
        # 從 Redis 獲取分片上傳元數據
        redis_key = f"upload:{file_id}:{upload_id}"
        chunk_metadata_json = await self.redis_client.get(redis_key)
        
        if not chunk_metadata_json:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"找不到上傳元數據，可能已過期: {upload_id}"
            )
        
        chunk_metadata = ChunkMetadata.parse_raw(chunk_metadata_json)
        
        return {
            "file_id": file_id,
            "upload_id": upload_id,
            "file_name": chunk_metadata.file_name,
            "bucket": chunk_metadata.bucket_name,
            "key": chunk_metadata.object_key,
            "progress": {
                "completed": chunk_metadata.chunk_number,
                "total": chunk_metadata.chunk_total,
                "percentage": round(chunk_metadata.chunk_number / chunk_metadata.chunk_total * 100, 2)
            },
            "uploaded_parts": [
                {
                    "part_number": part.part_number,
                    "size": part.size
                }
                for part in chunk_metadata.uploaded_parts
            ]
        }
    
    @handle_minio_exceptions
    async def list_objects(
        self, 
        bucket_name: str, 
        prefix: str = "", 
        max_keys: int = 1000
    ) -> List[Dict]:
        """
        列出 bucket 中的物件
        
        Args:
            bucket_name: bucket 名稱
            prefix: 物件前綴
            max_keys: 最大返回數量
            
        Returns:
            List[Dict]: 物件列表
        """
        response = self.s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=prefix,
            MaxKeys=max_keys
        )
        
        objects = []
        if "Contents" in response:
            for obj in response["Contents"]:
                objects.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "etag": obj["ETag"].strip('"')
                })
        
        logger.info(f"已列出物件: {bucket_name}/{prefix}, 數量: {len(objects)}")
        return objects
    
    @handle_minio_exceptions
    async def clean_expired_uploads(self, older_than_days: int = 1) -> int:
        """
        清理過期的未完成上傳
        
        Args:
            older_than_days: 清理超過指定天數的未完成上傳
            
        Returns:
            int: 清理的數量
        
        根據 PRD 3.4 的生命週期管理，自動清理過期的分片上傳
        """
        cleaned_count = 0
        scan_cursor = 0
        pattern = "upload:*"
        
        # 獲取當前時間戳
        current_time = int(time.time())
        expiration_time = current_time - (older_than_days * 86400)
        
        while True:
            scan_cursor, keys = await self.redis_client.scan(
                cursor=scan_cursor,
                match=pattern,
                count=100
            )
            
            for key in keys:
                try:
                    # 獲取 key 的創建時間
                    key_ttl = await self.redis_client.ttl(key)
                    
                    # 如果 TTL 接近過期 (剩餘時間少於總時間的10%)
                    if key_ttl < 0.1 * self.chunk_metadata_ttl:
                        # 解析 key 格式 upload:{file_id}:{upload_id}
                        parts = key.decode().split(":")
                        if len(parts) == 3:
                            file_id = parts[1]
                            upload_id = parts[2]
                            
                            # 獲取分片上傳元數據
                            chunk_metadata_json = await self.redis_client.get(key)
                            if chunk_metadata_json:
                                chunk_metadata = ChunkMetadata.parse_raw(chunk_metadata_json)
                                
                                # 中止分片上傳
                                self.s3_client.abort_multipart_upload(
                                    Bucket=chunk_metadata.bucket_name,
                                    Key=chunk_metadata.object_key,
                                    UploadId=upload_id
                                )
                                
                                # 刪除 Redis 中的元數據
                                await self.redis_client.delete(key)
                                cleaned_count += 1
                                
                                logger.info(f"已清理過期上傳: {chunk_metadata.bucket_name}/{chunk_metadata.object_key}")
                except Exception as e:
                    logger.error(f"清理過期上傳時發生錯誤: {str(e)}")
                    continue
            
            # 檢查是否已掃描完所有 keys
            if scan_cursor == 0:
                break
        
        logger.info(f"已清理 {cleaned_count} 個過期的未完成上傳")
        return cleaned_count 

# 上傳追蹤緩存
_upload_tracking_cache: Dict[str, Dict[str, Any]] = {}


def track_upload_start(file_id: str) -> None:
    """
    追蹤檔案上傳開始
    
    Args:
        file_id: 檔案ID
    """
    _upload_tracking_cache[file_id] = {
        "start_time": time.time(),
        "status": FileUploadStatus.IN_PROGRESS,
        "last_updated": datetime.utcnow()
    }
    logger.info(f"開始追蹤檔案上傳 {file_id}")


def track_upload_complete(file_id: str) -> None:
    """
    追蹤檔案上傳完成
    
    Args:
        file_id: 檔案ID
    """
    if file_id in _upload_tracking_cache:
        _upload_tracking_cache[file_id]["status"] = FileUploadStatus.COMPLETED
        _upload_tracking_cache[file_id]["complete_time"] = time.time()
        _upload_tracking_cache[file_id]["last_updated"] = datetime.utcnow()
        logger.info(f"檔案上傳完成 {file_id}")


def track_upload_failed(file_id: str, error_message: str) -> None:
    """
    追蹤檔案上傳失敗
    
    Args:
        file_id: 檔案ID
        error_message: 錯誤訊息
    """
    if file_id in _upload_tracking_cache:
        _upload_tracking_cache[file_id]["status"] = FileUploadStatus.FAILED
        _upload_tracking_cache[file_id]["error_message"] = error_message
        _upload_tracking_cache[file_id]["last_updated"] = datetime.utcnow()
        logger.error(f"檔案上傳失敗 {file_id}: {error_message}")


def get_upload_status(file_id: str) -> Optional[Dict[str, Any]]:
    """
    獲取檔案上傳狀態
    
    Args:
        file_id: 檔案ID
        
    Returns:
        上傳狀態資訊，如果找不到則返回None
    """
    if file_id in _upload_tracking_cache:
        # 檢查是否超時
        if _upload_tracking_cache[file_id]["status"] == FileUploadStatus.IN_PROGRESS:
            start_time = _upload_tracking_cache[file_id]["start_time"]
            if check_upload_timeout(file_id, start_time):
                track_upload_failed(file_id, "上傳超時")
        
        return _upload_tracking_cache[file_id]
    
    return None


def clear_old_upload_tracking(max_age_hours: int = 24) -> None:
    """
    清理舊的上傳追蹤記錄
    
    Args:
        max_age_hours: 最大保留時間(小時)
    """
    current_time = datetime.utcnow()
    to_delete = []
    
    for file_id, data in _upload_tracking_cache.items():
        last_updated = data.get("last_updated")
        if last_updated:
            age = (current_time - last_updated).total_seconds() / 3600
            if age > max_age_hours:
                to_delete.append(file_id)
    
    for file_id in to_delete:
        del _upload_tracking_cache[file_id]
    
    if to_delete:
        logger.info(f"已清理 {len(to_delete)} 個過期的上傳追蹤記錄")


def generate_file_id() -> str:
    """
    生成唯一檔案ID
    
    Returns:
        唯一檔案ID
    """
    return str(uuid.uuid4())


@contextmanager
def handle_file_upload(file: UploadFile) -> BinaryIO:
    """
    處理檔案上傳的上下文管理器，確保資源正確釋放
    
    Args:
        file: 上傳的檔案對象
        
    Yields:
        檔案對象的 file 屬性
    """
    try:
        yield file.file
    finally:
        file.file.close()


async def upload_user_file(
    user_id: str,
    file: UploadFile,
    bucket_name: Optional[str] = None,
    custom_filename: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    上傳使用者檔案
    
    Args:
        user_id: 使用者ID
        file: 上傳的檔案
        bucket_name: 自定義桶名稱 (可選)
        custom_filename: 自定義檔案名稱 (可選)
        metadata: 元數據 (可選)
        
    Returns:
        包含檔案資訊的字典
        
    Raises:
        HTTPException: 上傳失敗時抛出
    """
    # 生成唯一檔案ID
    file_id = generate_file_id()
    
    # 使用用戶ID作為桶名稱的一部分，確保隔離
    if bucket_name is None:
        bucket_name = f"{settings.MINIO_DEFAULT_BUCKET_PREFIX}-{user_id}"
    
    # 獲取原始檔名和副檔名
    original_filename = file.filename or "unnamed_file"
    extension = get_file_extension(original_filename)
    
    # 設置檔案名稱 (默認: file_id.extension)
    if custom_filename:
        filename = sanitize_filename(custom_filename)
    else:
        filename = f"{file_id}{extension}"
    
    # 準備元數據
    file_metadata = {
        "original_filename": original_filename,
        "content_type": file.content_type or get_content_type(original_filename),
        "user_id": user_id,
        "upload_time": datetime.utcnow().isoformat(),
    }
    
    # 添加自定義元數據
    if metadata:
        file_metadata.update(metadata)
    
    # 開始追蹤上傳
    track_upload_start(file_id)
    
    try:
        # 使用上下文管理器處理檔案
        with handle_file_upload(file) as file_content:
            # 上傳到 MinIO
            upload_success = upload_file(
                bucket_name=bucket_name,
                object_name=filename,
                file_data=file_content,
                content_type=file_metadata["content_type"]
            )
            
            if not upload_success:
                error_msg = f"無法上傳檔案 {original_filename} 到 MinIO"
                track_upload_failed(file_id, error_msg)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_msg
                )
            
            # 標記上傳完成
            track_upload_complete(file_id)
            
            # 生成預簽名URL (15分鐘有效期，符合PRD要求)
            url = generate_presigned_url(bucket_name, filename, expires=900)
            
            # 返回檔案資訊
            return {
                "file_id": file_id,
                "bucket": bucket_name,
                "filename": filename,
                "original_filename": original_filename,
                "content_type": file_metadata["content_type"],
                "size_bytes": file.size,
                "metadata": file_metadata,
                "url": url,
                "upload_status": FileUploadStatus.COMPLETED
            }
    except Exception as e:
        # 記錄錯誤並更新狀態
        error_message = f"檔案上傳失敗: {str(e)}"
        logger.error(error_message, exc_info=True)
        track_upload_failed(file_id, error_message)
        
        # 拋出 HTTP 異常
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message
        )


async def get_file_by_id(
    user_id: str,
    file_id: str,
    bucket_name: Optional[str] = None,
    filename: Optional[str] = None,
    download: bool = False
) -> Dict[str, Any]:
    """
    獲取檔案資訊或內容
    
    Args:
        user_id: 使用者ID
        file_id: 檔案ID
        bucket_name: 桶名稱 (可選)
        filename: 檔案名稱 (可選，默認使用 file_id 作為檔名)
        download: 是否下載檔案內容
        
    Returns:
        包含檔案資訊或內容的字典
        
    Raises:
        HTTPException: 檔案不存在或無法存取時抛出
    """
    # 使用用戶ID作為桶名稱的一部分
    if bucket_name is None:
        bucket_name = f"{settings.MINIO_DEFAULT_BUCKET_PREFIX}-{user_id}"
    
    # 如果未提供檔名，嘗試查詢可能的檔名
    if filename is None:
        # 這裡可以從資料庫中查詢，或嘗試常見的副檔名
        common_extensions = ["", ".pdf", ".docx", ".txt", ".jpg", ".png"]
        for ext in common_extensions:
            possible_filename = f"{file_id}{ext}"
            content = download_file(bucket_name, possible_filename)
            if content is not None:
                filename = possible_filename
                break
        
        if filename is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"檔案 {file_id} 不存在"
            )
    
    # 獲取檔案內容或生成預簽名URL
    if download:
        content = download_file(bucket_name, filename)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"檔案 {filename} 不存在或無法存取"
            )
        
        # 獲取內容類型
        content_type = get_content_type(filename)
        
        return {
            "file_id": file_id,
            "bucket": bucket_name,
            "filename": filename,
            "content": content,
            "content_type": content_type
        }
    else:
        # 生成預簽名URL (15分鐘，符合PRD要求)
        url = generate_presigned_url(bucket_name, filename, expires=900)
        if url is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"檔案 {filename} 不存在或無法存取"
            )
        
        return {
            "file_id": file_id,
            "bucket": bucket_name,
            "filename": filename,
            "url": url
        }


async def delete_user_file(
    user_id: str,
    file_id: str,
    bucket_name: Optional[str] = None,
    filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    刪除使用者檔案
    
    Args:
        user_id: 使用者ID
        file_id: 檔案ID
        bucket_name: 桶名稱 (可選)
        filename: 檔案名稱 (可選)
        
    Returns:
        包含操作結果的字典
        
    Raises:
        HTTPException: 檔案不存在或無法刪除時抛出
    """
    # 使用用戶ID作為桶名稱的一部分
    if bucket_name is None:
        bucket_name = f"{settings.MINIO_DEFAULT_BUCKET_PREFIX}-{user_id}"
    
    # 嘗試刪除檔案
    success = False
    
    # 如果提供了檔名，直接嘗試刪除
    if filename:
        success = delete_file(bucket_name, filename)
    else:
        # 否則嘗試常見的副檔名
        common_extensions = ["", ".pdf", ".docx", ".txt", ".jpg", ".png"]
        for ext in common_extensions:
            possible_filename = f"{file_id}{ext}"
            if delete_file(bucket_name, possible_filename):
                success = True
                filename = possible_filename
                break
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"檔案 {file_id} 不存在或無法刪除"
        )
    
    return {
        "success": True,
        "file_id": file_id,
        "bucket": bucket_name,
        "filename": filename or f"{file_id}"
    } 