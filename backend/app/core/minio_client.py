"""
MinIO 客戶端
提供與 MinIO 物件儲存的交互
"""
import logging
from typing import Optional, BinaryIO, Dict, Any

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)

# MinIO 客戶端單例
_minio_client = None


def get_minio_client() -> Minio:
    """
    獲取 MinIO 客戶端單例
    
    Returns:
        Minio 客戶端實例
    """
    global _minio_client
    
    if _minio_client is None:
        _minio_client = Minio(
            settings.MINIO_URL,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        logger.info(f"已創建 MinIO 客戶端連接到 {settings.MINIO_URL}")
    
    return _minio_client


def ensure_bucket_exists(bucket_name: str) -> bool:
    """
    確保指定的桶存在，如果不存在則創建
    
    Args:
        bucket_name: 桶名稱
        
    Returns:
        是否成功確保桶存在
    """
    client = get_minio_client()
    
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            logger.info(f"已創建 MinIO 桶: {bucket_name}")
        return True
    except S3Error as e:
        logger.error(f"MinIO 操作失敗 - 確保桶存在: {str(e)}")
        return False


def upload_file(
    bucket_name: str, 
    object_name: str, 
    file_data: BinaryIO, 
    content_type: str = "application/octet-stream"
) -> bool:
    """
    上傳檔案到 MinIO
    
    Args:
        bucket_name: 桶名稱
        object_name: 物件名稱 (鍵)
        file_data: 檔案數據 (檔案物件或二進制數據)
        content_type: 內容類型
        
    Returns:
        是否上傳成功
    """
    client = get_minio_client()
    
    try:
        # 確保桶存在
        ensure_bucket_exists(bucket_name)
        
        # 上傳檔案
        result = client.put_object(
            bucket_name=bucket_name,
            object_name=object_name,
            data=file_data,
            length=-1,  # 自動計算長度
            content_type=content_type
        )
        
        logger.info(f"已上傳檔案到 MinIO: {bucket_name}/{object_name}")
        return True
    except S3Error as e:
        logger.error(f"MinIO 上傳失敗: {str(e)}")
        return False


def download_file(bucket_name: str, object_name: str) -> Optional[bytes]:
    """
    從 MinIO 下載檔案
    
    Args:
        bucket_name: 桶名稱
        object_name: 物件名稱 (鍵)
        
    Returns:
        檔案數據，如果失敗則返回 None
    """
    client = get_minio_client()
    
    try:
        # 獲取物件
        response = client.get_object(bucket_name, object_name)
        
        # 讀取內容
        data = response.read()
        response.close()
        response.release_conn()
        
        logger.info(f"已從 MinIO 下載檔案: {bucket_name}/{object_name}")
        return data
    except S3Error as e:
        logger.error(f"MinIO 下載失敗: {str(e)}")
        return None


def delete_file(bucket_name: str, object_name: str) -> bool:
    """
    從 MinIO 刪除檔案
    
    Args:
        bucket_name: 桶名稱
        object_name: 物件名稱 (鍵)
        
    Returns:
        是否刪除成功
    """
    client = get_minio_client()
    
    try:
        client.remove_object(bucket_name, object_name)
        logger.info(f"已從 MinIO 刪除檔案: {bucket_name}/{object_name}")
        return True
    except S3Error as e:
        logger.error(f"MinIO 刪除失敗: {str(e)}")
        return False


def generate_presigned_url(
    bucket_name: str, 
    object_name: str, 
    expires: int = 3600, 
    response_headers: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """
    生成預簽名 URL，用於臨時存取檔案
    
    Args:
        bucket_name: 桶名稱
        object_name: 物件名稱 (鍵)
        expires: 有效期 (秒)
        response_headers: 回應頭部
        
    Returns:
        預簽名 URL，如果失敗則返回 None
    """
    client = get_minio_client()
    
    try:
        url = client.presigned_get_object(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=expires,
            response_headers=response_headers
        )
        logger.debug(f"已生成預簽名 URL: {bucket_name}/{object_name}, 有效期 {expires} 秒")
        return url
    except S3Error as e:
        logger.error(f"MinIO 生成預簽名 URL 失敗: {str(e)}")
        return None 