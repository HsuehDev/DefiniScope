"""
MinIO客戶端封裝改進建議
針對審計中發現的問題提供改進實現
"""
import os
import io
import uuid
import logging
import concurrent.futures
import time
import mimetypes
from typing import List, Dict, Optional, Union, Tuple, BinaryIO, Callable
from datetime import timedelta
from pathlib import Path
from functools import wraps
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from minio import Minio
from minio.commonconfig import ComposeSource
from minio.error import S3Error, InvalidResponseError, MinioException
from fastapi import HTTPException, status

# 使用模擬配置
from docs.audits.mock_config import settings


logger = logging.getLogger(__name__)


def validate_file_type(file_path: str, allowed_types: Optional[List[str]] = None) -> bool:
    """
    驗證文件類型是否在允許列表中
    
    Args:
        file_path: 文件路徑
        allowed_types: 允許的MIME類型列表，如 ['application/pdf', 'image/jpeg']
        
    Returns:
        bool: 如果文件類型允許返回 True，否則返回 False
    """
    if allowed_types is None:
        return True
        
    # 獲取文件的MIME類型
    mime_type, _ = mimetypes.guess_type(file_path)
    
    # 如果無法確定MIME類型，視為不安全
    if mime_type is None:
        return False
        
    return mime_type in allowed_types


def validate_file_size(file_path: str, max_size: int) -> bool:
    """
    驗證文件大小是否在允許範圍內
    
    Args:
        file_path: 文件路徑
        max_size: 最大允許大小（字節）
        
    Returns:
        bool: 如果文件大小允許返回 True，否則返回 False
    """
    file_size = os.path.getsize(file_path)
    return file_size <= max_size


def handle_minio_error(error: Exception, operation_name: str = "MinIO操作") -> None:
    """
    處理MinIO錯誤並轉換為HTTP異常
    
    Args:
        error: 原始MinIO異常
        operation_name: 操作名稱（用於錯誤消息）
        
    Raises:
        HTTPException: 轉換後的HTTP異常
    """
    error_message = f"{operation_name}失敗: {str(error)}"
    logger.error(error_message)
    
    if isinstance(error, S3Error):
        # 處理常見的S3錯誤碼
        if error.code == "NoSuchBucket":
            status_code = status.HTTP_404_NOT_FOUND
        elif error.code == "NoSuchKey":
            status_code = status.HTTP_404_NOT_FOUND
        elif error.code == "AccessDenied":
            status_code = status.HTTP_403_FORBIDDEN
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    else:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    raise HTTPException(
        status_code=status_code,
        detail=error_message
    )


class MinioClient:
    """
    封裝MinIO客戶端的類，提供文件操作功能
    """
    
    def __init__(self):
        """
        初始化MinIO客戶端
        
        使用配置設置創建MinIO客戶端實例
        """
        try:
            self.client = Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
            
            # 確保默認存儲桶存在
            if not self.client.bucket_exists(settings.MINIO_DEFAULT_BUCKET):
                self.client.make_bucket(settings.MINIO_DEFAULT_BUCKET)
                logger.info(f"成功創建默認存儲桶: {settings.MINIO_DEFAULT_BUCKET}")
            
            logger.info(f"MinIO客戶端初始化成功，連接到: {settings.MINIO_ENDPOINT}")
        except Exception as e:
            logger.error(f"MinIO客戶端初始化失敗: {str(e)}")
            handle_minio_error(e, "MinIO客戶端初始化")
    
    def upload_file(self, file_path: str, object_name: str, bucket_name: str = None) -> Dict:
        """
        上傳文件到MinIO
        
        Args:
            file_path: 本地文件路徑
            object_name: 目標對象名稱
            bucket_name: 目標存儲桶名稱（默認為配置中的默認存儲桶）
            
        Returns:
            Dict: 包含上傳信息的字典
            
        Raises:
            HTTPException: 如果上傳失敗
        """
        bucket_name = bucket_name or settings.MINIO_DEFAULT_BUCKET
        
        try:
            # 檢查文件是否存在
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"文件不存在: {file_path}"
                )
            
            # 驗證文件類型
            if not validate_file_type(file_path, settings.ALLOWED_FILE_TYPES):
                mime_type, _ = mimetypes.guess_type(file_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"不支持的文件類型: {mime_type or '未知'}"
                )
            
            # 驗證文件大小
            if not validate_file_size(file_path, settings.MAX_UPLOAD_FILE_SIZE):
                file_size = os.path.getsize(file_path)
                max_size_mb = settings.MAX_UPLOAD_FILE_SIZE / (1024 * 1024)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"文件大小 ({file_size / (1024 * 1024):.2f} MB) 超出最大允許大小 ({max_size_mb:.2f} MB)"
                )
            
            # 獲取文件大小和內容類型
            file_stat = Path(file_path).stat()
            content_type, _ = mimetypes.guess_type(file_path)
            content_type = content_type or 'application/octet-stream'
            
            # 上傳文件
            with open(file_path, 'rb') as file_data:
                result = self.client.put_object(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    data=file_data,
                    length=file_stat.st_size,
                    content_type=content_type
                )
            
            logger.info(f"成功上傳文件: {file_path} -> {bucket_name}/{object_name}")
            
            return {
                "bucket_name": bucket_name,
                "object_name": object_name,
                "etag": result.etag,
                "version_id": getattr(result, 'version_id', None),
                "size": file_stat.st_size,
                "content_type": content_type
            }
        except HTTPException:
            # 直接重新拋出HTTP異常
            raise
        except Exception as e:
            handle_minio_error(e, f"上傳文件 {file_path}")
    
    def download_file(self, object_name: str, output_path: str, bucket_name: str = None) -> str:
        """
        從MinIO下載文件
        
        Args:
            object_name: 對象名稱
            output_path: 輸出文件路徑
            bucket_name: 存儲桶名稱（默認為配置中的默認存儲桶）
            
        Returns:
            str: 下載的文件路徑
            
        Raises:
            HTTPException: 如果下載失敗
        """
        bucket_name = bucket_name or settings.MINIO_DEFAULT_BUCKET
        
        try:
            # 確保輸出目錄存在
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            
            # 下載文件
            response = self.client.get_object(bucket_name, object_name)
            
            # 將文件內容寫入輸出路徑
            with open(output_path, 'wb') as file_data:
                for data in response.stream(32 * 1024):
                    file_data.write(data)
            
            logger.info(f"成功下載文件: {bucket_name}/{object_name} -> {output_path}")
            
            return output_path
        except Exception as e:
            handle_minio_error(e, f"下載文件 {bucket_name}/{object_name}")
    
    def get_file_url(self, object_name: str, bucket_name: str = None, expires: timedelta = None) -> str:
        """
        獲取文件的預簽名URL
        
        Args:
            object_name: 對象名稱
            bucket_name: 存儲桶名稱（默認為配置中的默認存儲桶）
            expires: URL過期時間（默認為配置中的默認值）
            
        Returns:
            str: 預簽名URL
            
        Raises:
            HTTPException: 如果生成URL失敗
        """
        bucket_name = bucket_name or settings.MINIO_DEFAULT_BUCKET
        expires_seconds = int(expires.total_seconds() if expires else settings.DEFAULT_PRESIGNED_URL_EXPIRY)
        
        try:
            url = self.client.presigned_get_object(
                bucket_name,
                object_name,
                expires=expires_seconds
            )
            
            logger.info(f"成功生成預簽名URL: {bucket_name}/{object_name}, 過期時間: {expires_seconds}秒")
            
            return url
        except Exception as e:
            handle_minio_error(e, f"生成預簽名URL {bucket_name}/{object_name}")
    
    def delete_file(self, object_name: str, bucket_name: str = None) -> bool:
        """
        從MinIO刪除文件
        
        Args:
            object_name: 對象名稱
            bucket_name: 存儲桶名稱（默認為配置中的默認存儲桶）
            
        Returns:
            bool: 是否成功刪除
            
        Raises:
            HTTPException: 如果刪除失敗
        """
        bucket_name = bucket_name or settings.MINIO_DEFAULT_BUCKET
        
        try:
            self.client.remove_object(bucket_name, object_name)
            
            logger.info(f"成功刪除文件: {bucket_name}/{object_name}")
            
            return True
        except Exception as e:
            handle_minio_error(e, f"刪除文件 {bucket_name}/{object_name}") 