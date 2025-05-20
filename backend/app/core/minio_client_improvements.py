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
import asyncio
from typing import List, Dict, Optional, Union, Tuple, BinaryIO, Callable, Any
from datetime import timedelta
from pathlib import Path
from functools import wraps
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from minio import Minio
from minio.commonconfig import ComposeSource
from minio.error import S3Error, InvalidResponseError, MinioException
from fastapi import HTTPException, status

# 使用應用配置
from app.core.mock_config import settings


logger = logging.getLogger(__name__)


# 自定義異常類
class StorageException(Exception):
    """儲存相關異常基類"""
    def __init__(self, message: str, status_code: int = 500, details: Any = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class FileValidationError(StorageException):
    """文件驗證錯誤"""
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=400, details=details)


# 文件驗證器
class FileValidator:
    """文件驗證工具類，提供文件類型和大小的驗證功能"""
    
    @staticmethod
    def validate_file_type(file_path: str, allowed_types: Optional[set] = None) -> bool:
        """
        驗證文件類型是否在允許列表中
        
        Args:
            file_path: 文件路徑
            allowed_types: 允許的 MIME 類型集合，如 {'application/pdf', 'image/jpeg'}
            
        Returns:
            bool: 如果文件類型允許返回 True
            
        Raises:
            FileValidationError: 如果文件類型不允許
        """
        if allowed_types is None:
            return True
            
        # 獲取文件的 MIME 類型
        mime_type, _ = mimetypes.guess_type(file_path)
        
        # 如果無法確定 MIME 類型，視為不安全
        if mime_type is None:
            raise FileValidationError(f"無法確定文件類型: {file_path}")
            
        if mime_type not in allowed_types:
            raise FileValidationError(f"不允許的文件類型: {mime_type}")
            
        return True

    @staticmethod
    def validate_file_size(file_path: str, max_size: int = None) -> bool:
        """
        驗證文件大小是否在允許範圍內
        
        Args:
            file_path: 文件路徑
            max_size: 最大允許大小（字節），如果為 None 則使用配置中的值
            
        Returns:
            bool: 如果文件大小允許返回 True
            
        Raises:
            FileValidationError: 如果文件大小超過限制
        """
        if max_size is None:
            max_size = getattr(settings, 'MAX_UPLOAD_FILE_SIZE', 100 * 1024 * 1024)  # 默認 100MB
            
        file_size = os.path.getsize(file_path)
        if file_size > max_size:
            max_size_mb = max_size / (1024 * 1024)
            file_size_mb = file_size / (1024 * 1024)
            raise FileValidationError(
                f"文件大小超過限制: {file_size_mb:.2f}MB > {max_size_mb:.2f}MB"
            )
            
        return True

    @staticmethod
    def validate_file(file_path: str, allowed_types: Optional[set] = None, max_size: int = None) -> bool:
        """
        驗證文件類型和大小
        
        Args:
            file_path: 文件路徑
            allowed_types: 允許的 MIME 類型集合
            max_size: 最大允許大小（字節）
            
        Returns:
            bool: 如果文件類型和大小都允許返回 True
            
        Raises:
            FileValidationError: 如果文件類型或大小不符合要求
        """
        FileValidator.validate_file_type(file_path, allowed_types)
        FileValidator.validate_file_size(file_path, max_size)
        return True


# MinIO 連接池
class MinioConnectionPool:
    """
    MinIO 連接池，管理和重用 MinIO 客戶端連接
    """
    
    _instance = None
    _clients = []
    _lock = asyncio.Lock()
    _pool_size = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(MinioConnectionPool, cls).__new__(cls)
            cls._pool_size = getattr(settings, 'MINIO_CONNECTION_POOL_SIZE', 5)
            cls._clients = []
        return cls._instance
    
    @classmethod
    async def initialize(cls):
        """初始化連接池"""
        async with cls._lock:
            if not cls._clients:
                for _ in range(cls._pool_size):
                    client = Minio(
                        endpoint=settings.MINIO_ENDPOINT,
                        access_key=settings.MINIO_ACCESS_KEY,
                        secret_key=settings.MINIO_SECRET_KEY,
                        secure=getattr(settings, 'MINIO_SECURE', False),
                        region=getattr(settings, 'MINIO_REGION', None)
                    )
                    cls._clients.append({"client": client, "in_use": False})
                logger.info(f"MinIO 連接池初始化完成，建立了 {cls._pool_size} 個連接")
    
    @classmethod
    async def get_client(cls):
        """
        從連接池獲取 MinIO 客戶端
        
        Returns:
            Minio: MinIO 客戶端實例
        """
        await cls.initialize()
        
        async with cls._lock:
            # 尋找可用的客戶端
            for client_info in cls._clients:
                if not client_info["in_use"]:
                    client_info["in_use"] = True
                    return client_info["client"]
            
            # 如果沒有可用的客戶端，創建新的
            logger.warning(f"MinIO 連接池中所有 {cls._pool_size} 個連接都在使用中，將創建新連接")
            client = Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=getattr(settings, 'MINIO_SECURE', False),
                region=getattr(settings, 'MINIO_REGION', None)
            )
            return client
    
    @classmethod
    async def release_client(cls, client):
        """
        釋放客戶端回到連接池
        
        Args:
            client: 要釋放的 MinIO 客戶端
        """
        async with cls._lock:
            for client_info in cls._clients:
                if client_info["client"] is client:
                    client_info["in_use"] = False
                    return
    
    @classmethod
    async def close_all(cls):
        """關閉所有連接"""
        async with cls._lock:
            cls._clients = []
            logger.info("已關閉所有 MinIO 連接")


# MinIO 客戶端管理器
class MinioClientManager:
    """
    MinIO 客戶端管理器，提供 MinIO 操作的高級封裝
    """
    
    def __init__(self):
        """初始化 MinIO 客戶端管理器"""
        self.default_bucket = getattr(settings, 'MINIO_DEFAULT_BUCKET', 'default')
        
    async def _get_client(self):
        """獲取 MinIO 客戶端"""
        return await MinioConnectionPool.get_client()
    
    async def _release_client(self, client):
        """釋放 MinIO 客戶端"""
        await MinioConnectionPool.release_client(client)
    
    async def _execute_with_client(self, operation):
        """
        使用客戶端執行操作並正確處理異常
        
        Args:
            operation: 異步函數，接受 client 參數
            
        Returns:
            操作結果
            
        Raises:
            StorageException: 如果操作失敗
        """
        client = None
        try:
            client = await self._get_client()
            return await operation(client)
        except StorageException:
            # 直接傳遞自定義異常
            raise
        except S3Error as e:
            error_message = f"MinIO S3 錯誤: {str(e)}"
            logger.error(error_message)
            
            # 轉換為自定義異常
            if e.code == "NoSuchBucket":
                raise StorageException(f"存儲桶不存在: {e.bucket_name}", status_code=404)
            elif e.code == "NoSuchKey":
                raise StorageException(f"對象不存在: {e.object_name}", status_code=404)
            elif e.code == "AccessDenied":
                raise StorageException("拒絕訪問", status_code=403)
            else:
                raise StorageException(error_message, status_code=500, details={"code": e.code})
        except Exception as e:
            error_message = f"存儲操作錯誤: {str(e)}"
            logger.error(error_message)
            raise StorageException(error_message, status_code=500)
        finally:
            if client:
                await self._release_client(client)
    
    async def ensure_bucket_exists(self, bucket_name: str) -> bool:
        """
        確保存儲桶存在，如果不存在則創建
        
        Args:
            bucket_name: 存儲桶名稱
            
        Returns:
            bool: 操作是否成功
        """
        async def _operation(client):
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
                logger.info(f"已創建 MinIO 存儲桶: {bucket_name}")
            return True
            
        return await self._execute_with_client(_operation)
    
    async def upload_file(self, bucket_name: str, object_name: str, file_path: str, 
                         content_type: str = None, metadata: Dict = None) -> Dict:
        """
        上傳文件到 MinIO
        
        Args:
            bucket_name: 目標存儲桶名稱
            object_name: 目標對象名稱
            file_path: 本地文件路徑
            content_type: 文件內容類型，如果為 None 則自動檢測
            metadata: 對象元數據
            
        Returns:
            Dict: 包含上傳信息的字典
        """
        # 檢查文件是否存在
        if not os.path.exists(file_path):
            raise StorageException(f"文件不存在: {file_path}", status_code=404)
        
        # 自動檢測內容類型
        if content_type is None:
            content_type, _ = mimetypes.guess_type(file_path)
            content_type = content_type or 'application/octet-stream'
        
        # 統一元數據
        metadata = metadata or {}
        
        async def _operation(client):
            # 確保存儲桶存在
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
            
            # 獲取文件大小
            file_stat = Path(file_path).stat()
            
            # 上傳文件
            result = client.fput_object(
                bucket_name=bucket_name,
                object_name=object_name,
                file_path=file_path,
                content_type=content_type,
                metadata=metadata
            )
            
            # 構建返回結果
            return {
                'bucket_name': bucket_name,
                'object_name': object_name,
                'etag': result['etag'] if isinstance(result, dict) and 'etag' in result else getattr(result, 'etag', 'mock-etag'),
                'version_id': result['version_id'] if isinstance(result, dict) and 'version_id' in result else getattr(result, 'version_id', None),
                'size': file_stat.st_size,
                'content_type': content_type
            }
            
        return await self._execute_with_client(_operation)
    
    async def upload_bytes(self, bucket_name: str, object_name: str, data: bytes,
                          content_type: str = 'application/octet-stream', metadata: Dict = None) -> Dict:
        """
        上傳二進制數據到 MinIO
        
        Args:
            bucket_name: 目標存儲桶名稱
            object_name: 目標對象名稱
            data: 二進制數據
            content_type: 內容類型
            metadata: 對象元數據
            
        Returns:
            Dict: 包含上傳信息的字典
        """
        # 驗證數據
        if not data:
            raise StorageException("無法上傳空數據", status_code=400)
        
        # 統一元數據
        metadata = metadata or {}
        
        async def _operation(client):
            # 確保存儲桶存在
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
            
            # 準備數據
            data_stream = io.BytesIO(data)
            data_length = len(data)
            
            # 上傳數據
            result = client.put_object(
                bucket_name=bucket_name,
                object_name=object_name,
                data=data_stream,
                length=data_length,
                content_type=content_type,
                metadata=metadata
            )
            
            # 構建返回結果
            return {
                'bucket_name': bucket_name,
                'object_name': object_name,
                'etag': result['etag'] if isinstance(result, dict) and 'etag' in result else getattr(result, 'etag', 'mock-etag'),
                'version_id': result['version_id'] if isinstance(result, dict) and 'version_id' in result else getattr(result, 'version_id', None),
                'size': data_length,
                'content_type': content_type
            }
            
        return await self._execute_with_client(_operation)
    
    async def download_file(self, bucket_name: str, object_name: str, file_path: str) -> str:
        """
        從 MinIO 下載文件
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            file_path: 下載文件的目標路徑
            
        Returns:
            str: 下載的文件路徑
        """
        async def _operation(client):
            # 確保目標目錄存在
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            # 檢查對象是否存在
            try:
                client.stat_object(bucket_name, object_name)
            except S3Error as e:
                if e.code == "NoSuchKey":
                    raise StorageException(f"對象不存在: {object_name}", status_code=404)
                raise
            
            # 下載文件
            client.fget_object(bucket_name, object_name, file_path)
            
            return file_path
            
        return await self._execute_with_client(_operation)
    
    async def download_bytes(self, bucket_name: str, object_name: str) -> bytes:
        """
        從 MinIO 下載二進制數據
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            
        Returns:
            bytes: 對象的二進制數據
        """
        async def _operation(client):
            # 檢查對象是否存在
            try:
                client.stat_object(bucket_name, object_name)
            except S3Error as e:
                if e.code == "NoSuchKey":
                    raise StorageException(f"對象不存在: {object_name}", status_code=404)
                raise
            
            # 下載數據
            response = client.get_object(bucket_name, object_name)
            try:
                data = response.read()
                return data
            finally:
                response.close()
                response.release_conn()
            
        return await self._execute_with_client(_operation)
    
    async def get_presigned_url(self, bucket_name: str, object_name: str, 
                              expires: timedelta = None, response_headers: Dict = None) -> str:
        """
        獲取對象的預簽名URL
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            expires: URL過期時間
            response_headers: 回應標頭
            
        Returns:
            str: 預簽名URL
        """
        if expires is None:
            expires = timedelta(hours=1)  # 默認1小時
            
        async def _operation(client):
            # 檢查對象是否存在
            try:
                client.stat_object(bucket_name, object_name)
            except S3Error as e:
                if e.code == "NoSuchKey":
                    raise StorageException(f"對象不存在: {object_name}", status_code=404)
                raise
            
            # 獲取預簽名URL
            expires_seconds = int(expires.total_seconds())
            url = client.presigned_get_object(
                bucket_name, 
                object_name, 
                expires=expires_seconds,
                response_headers=response_headers
            )
            
            return url
            
        return await self._execute_with_client(_operation)
    
    async def delete_object(self, bucket_name: str, object_name: str) -> bool:
        """
        刪除 MinIO 中的對象
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            
        Returns:
            bool: 刪除操作是否成功
        """
        async def _operation(client):
            # 檢查存儲桶是否存在
            if not client.bucket_exists(bucket_name):
                return False
                
            # 檢查對象是否存在
            try:
                client.stat_object(bucket_name, object_name)
            except Exception as e:
                # 通用的錯誤處理，檢查錯誤訊息是否表示對象不存在
                error_str = str(e).lower()
                if "does not exist" in error_str or "not found" in error_str or "nosuchkey" in error_str:
                    return False
                raise  # 其他錯誤則重新拋出
                
            # 刪除對象
            client.remove_object(bucket_name, object_name)
            
            return True
            
        return await self._execute_with_client(_operation)
    
    async def list_objects(self, bucket_name: str, prefix: str = None, 
                          recursive: bool = True) -> List[Dict]:
        """
        列出存儲桶中的對象
        
        Args:
            bucket_name: 存儲桶名稱
            prefix: 對象名稱前綴
            recursive: 是否遞歸列出所有對象
            
        Returns:
            List[Dict]: 對象列表
        """
        async def _operation(client):
            # 檢查存儲桶是否存在
            if not client.bucket_exists(bucket_name):
                raise StorageException(f"存儲桶不存在: {bucket_name}", status_code=404)
                
            # 列出對象
            objects = client.list_objects(
                bucket_name, 
                prefix=prefix, 
                recursive=recursive
            )
            
            # 格式化返回結果
            result = []
            for obj in objects:
                result.append({
                    'object_name': obj.object_name,
                    'size': obj.size,
                    'etag': obj.etag,
                    'last_modified': obj.last_modified
                })
                
            return result
            
        return await self._execute_with_client(_operation)


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