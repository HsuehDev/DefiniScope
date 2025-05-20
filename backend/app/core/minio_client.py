"""
MinIO客戶端
實現與MinIO對象存儲的交互
"""
import os
import io
import uuid
import logging
import concurrent.futures
from typing import List, Dict, Optional, Union, Tuple, BinaryIO, Callable
from datetime import timedelta

from minio import Minio
from minio.commonconfig import ComposeSource
from minio.credentials import Provider
from minio.deleteobjects import DeleteObject
from minio.error import S3Error, InvalidResponseError, MinioException
# 注釋掉不再存在的導入
# from minio.select.options import SelectObjectOptions
from fastapi import HTTPException, status

from app.core.config import settings


logger = logging.getLogger(__name__)


class MinioConnectionPool:
    """
    Minio 連接池，用於管理 Minio 客戶端連接
    此類使用背景執行緒池限制並重用連接
    """
    _instance = None
    _max_workers = 8
    _pool = None
    _clients = []
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MinioConnectionPool, cls).__new__(cls)
            cls._initialize_pool()
        return cls._instance
    
    @classmethod
    def _initialize_pool(cls):
        """初始化連接池和客戶端列表"""
        cls._pool = concurrent.futures.ThreadPoolExecutor(max_workers=cls._max_workers)
        cls._clients = []
        
        # 預先創建客戶端
        for _ in range(cls._max_workers):
            client = Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
            cls._clients.append(client)
    
    @classmethod
    def get_client(cls) -> Minio:
        """獲取一個 Minio 客戶端實例"""
        if cls._instance is None:
            cls._instance = MinioConnectionPool()
        
        # 如果沒有預創建的客戶端，則創建新的
        if not cls._clients:
            return Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
        
        # 從列表中取出一個客戶端
        # 注意：此實現假設客戶端是無狀態且可重用的
        client = cls._clients.pop()
        
        # 用完後放回客戶端列表
        def return_client(client):
            cls._clients.append(client)
            return True
        
        # 為使用後返回客戶端註冊回調
        cls._pool.submit(lambda: return_client(client))
        
        return client
    
    @classmethod
    def submit_task(cls, fn, *args, **kwargs):
        """
        提交任務到執行緒池
        
        Args:
            fn: 要執行的函數
            *args, **kwargs: 函數參數
            
        Returns:
            concurrent.futures.Future 對象
        """
        if cls._instance is None:
            cls._instance = MinioConnectionPool()
        
        return cls._pool.submit(fn, *args, **kwargs)
    
    @classmethod
    def shutdown(cls):
        """關閉連接池"""
        if cls._pool:
            cls._pool.shutdown(wait=True)
            cls._pool = None
            cls._clients = []


class MinioClientManager:
    """
    MinIO客戶端管理器
    管理與MinIO對象存儲的交互，提供高級操作功能
    """
    
    def __init__(self):
        """
        初始化MinIO客戶端管理器
        
        使用配置文件中的設置創建MinIO客戶端
        """
        try:
            # 直接使用連接池獲取客戶端
            self.client = MinioConnectionPool.get_client()
            logger.info(f"MinIO客戶端初始化成功, 端點: {settings.MINIO_ENDPOINT}")
        except Exception as e:
            logger.error(f"MinIO客戶端初始化失敗: {str(e)}")
            raise RuntimeError(f"無法連接到MinIO服務: {str(e)}")
    
    def _handle_minio_error(self, error: Exception, custom_message: str = None) -> None:
        """
        處理MinIO錯誤並轉換為適當的HTTP異常
        
        Args:
            error: 原始MinIO異常
            custom_message: 自定義錯誤訊息
            
        Raises:
            HTTPException: 轉換後的HTTP異常
        """
        error_message = custom_message or str(error)
        logger.error(f"MinIO操作錯誤: {error_message}")
        
        if isinstance(error, S3Error):
            # 處理常見的S3錯誤碼
            if error.code == "NoSuchBucket":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"存儲桶不存在: {error_message}"
                )
            elif error.code == "NoSuchKey":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"對象不存在: {error_message}"
                )
            elif error.code == "AccessDenied":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"存取被拒絕: {error_message}"
                )
            elif error.code == "BucketAlreadyExists":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"存儲桶已存在: {error_message}"
                )
            else:
                # 其他S3錯誤
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"S3操作錯誤: {error_message}"
                )
        elif isinstance(error, InvalidResponseError):
            # 無效響應錯誤
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"從存儲服務收到無效響應: {error_message}"
            )
        elif isinstance(error, (ConnectionError, TimeoutError)):
            # 連接或超時錯誤
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"存儲服務連接失敗: {error_message}"
            )
        else:
            # 其他未知錯誤
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"存儲操作失敗: {error_message}"
            )
    
    async def ensure_bucket_exists(self, bucket_name: str) -> bool:
        """
        確保存儲桶存在，不存在則創建
        
        Args:
            bucket_name: 存儲桶名稱
            
        Returns:
            bool: 是否成功創建或已存在
            
        Raises:
            HTTPException: 如果操作失敗
        """
        try:
            # 檢查存儲桶是否存在
            if not self.client.bucket_exists(bucket_name):
                # 創建存儲桶
                self.client.make_bucket(bucket_name)
                logger.info(f"成功創建存儲桶: {bucket_name}")
                return True
            return True
        except Exception as e:
            self._handle_minio_error(e, f"確保存儲桶 {bucket_name} 存在時失敗")
    
    async def upload_file(
        self, 
        bucket_name: str, 
        object_name: str, 
        file_path: str,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> str:
        """
        上傳文件到MinIO
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            file_path: 文件路徑
            content_type: 內容類型
            metadata: 元數據字典
            
        Returns:
            str: 對象名稱
            
        Raises:
            HTTPException: 如果上傳失敗
        """
        try:
            # 確保存儲桶存在
            await self.ensure_bucket_exists(bucket_name)
            
            # 確保檔案存在
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件不存在: {file_path}")
            
            # 獲取文件大小
            file_size = os.path.getsize(file_path)
            
            # 如果文件過大，使用分片上傳
            if file_size > settings.MINIO_LARGE_FILE_THRESHOLD:
                return await self.upload_large_file(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    file_path=file_path,
                    content_type=content_type,
                    metadata=metadata
                )
            
            # 標準上傳
            self.client.fput_object(
                bucket_name=bucket_name,
                object_name=object_name,
                file_path=file_path,
                content_type=content_type,
                metadata=metadata
            )
            
            logger.info(f"成功上傳文件 {file_path} 到 {bucket_name}/{object_name}")
            return object_name
        except FileNotFoundError as e:
            # 文件不存在錯誤
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文件不存在: {str(e)}"
            )
        except Exception as e:
            self._handle_minio_error(e, f"上傳文件 {file_path} 到 {bucket_name}/{object_name} 失敗")
    
    async def upload_large_file(
        self, 
        bucket_name: str, 
        object_name: str, 
        file_path: str,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None,
        part_size: int = 10 * 1024 * 1024  # 10MB 默認分片大小
    ) -> str:
        """
        分片上傳大文件到 MinIO
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            file_path: 文件路徑
            content_type: 內容類型
            metadata: 元數據字典
            part_size: 分片大小（字節）
            
        Returns:
            str: 對象名稱
            
        Raises:
            HTTPException: 如果上傳失敗
        """
        try:
            # 確保存儲桶存在
            await self.ensure_bucket_exists(bucket_name)
            
            # 確保檔案存在
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件不存在: {file_path}")
            
            # 使用 MinIO 客戶端的 API 進行分片上傳
            # 注意：這裡使用的是 minio-py 的 API，可能會有變化
            file_size = os.path.getsize(file_path)
            total_parts = (file_size + part_size - 1) // part_size
            
            with open(file_path, 'rb') as file_data:
                # 創建多部分上傳
                upload_id = self.client.create_multipart_upload(
                    bucket_name, object_name, content_type, metadata
                )
                
                # 上傳各個部分
                etags = []
                part_number = 1
                
                while True:
                    data = file_data.read(part_size)
                    if not data:
                        break
                    
                    # 上傳部分
                    etag = self.client.put_object_part(
                        bucket_name, object_name, upload_id, part_number,
                        io.BytesIO(data), len(data)
                    )
                    etags.append((part_number, etag))
                    part_number += 1
                    
                    # 記錄進度
                    progress = (part_number - 1) / total_parts * 100
                    logger.debug(f"上傳進度: {progress:.2f}% (分片 {part_number-1}/{total_parts})")
                
                # 完成多部分上傳
                self.client.complete_multipart_upload(
                    bucket_name, object_name, upload_id, etags
                )
            
            logger.info(f"成功分片上傳大文件 {file_path} 到 {bucket_name}/{object_name}")
            return object_name
        except FileNotFoundError as e:
            # 文件不存在錯誤
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文件不存在: {str(e)}"
            )
        except Exception as e:
            self._handle_minio_error(
                e, f"分片上傳大文件 {file_path} 到 {bucket_name}/{object_name} 失敗"
            )
    
    async def upload_bytes(
        self, 
        bucket_name: str, 
        object_name: str, 
        data: bytes,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> str:
        """
        上傳二進制數據到MinIO
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            data: 二進制數據
            content_type: 內容類型
            metadata: 元數據字典
            
        Returns:
            str: 對象名稱
            
        Raises:
            HTTPException: 如果上傳失敗
        """
        try:
            # 確保存儲桶存在
            await self.ensure_bucket_exists(bucket_name)
            
            # 創建 BytesIO 對象
            data_stream = io.BytesIO(data)
            
            # 上傳數據
            self.client.put_object(
                bucket_name=bucket_name,
                object_name=object_name,
                data=data_stream,
                length=len(data),
                content_type=content_type,
                metadata=metadata
            )
            
            logger.info(f"成功上傳二進制數據到 {bucket_name}/{object_name}")
            return object_name
        except Exception as e:
            self._handle_minio_error(e, f"上傳二進制數據到 {bucket_name}/{object_name} 失敗")
    
    async def download_file(
        self, 
        bucket_name: str, 
        object_name: str, 
        file_path: str
    ) -> str:
        """
        從MinIO下載文件
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            file_path: 保存路徑
            
        Returns:
            str: 文件保存路徑
            
        Raises:
            HTTPException: 如果下載失敗
        """
        try:
            # 確保目標目錄存在
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # 下載對象
            self.client.fget_object(
                bucket_name=bucket_name,
                object_name=object_name,
                file_path=file_path
            )
            
            logger.info(f"成功下載 {bucket_name}/{object_name} 到 {file_path}")
            return file_path
        except Exception as e:
            self._handle_minio_error(e, f"下載 {bucket_name}/{object_name} 到 {file_path} 失敗")
    
    async def download_bytes(
        self, 
        bucket_name: str, 
        object_name: str
    ) -> bytes:
        """
        從MinIO下載二進制數據
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            
        Returns:
            bytes: 二進制數據
            
        Raises:
            HTTPException: 如果下載失敗
        """
        try:
            # 獲取對象
            response = self.client.get_object(
                bucket_name=bucket_name,
                object_name=object_name
            )
            
            # 讀取全部數據
            data = response.read()
            response.close()
            response.release_conn()
            
            logger.info(f"成功下載 {bucket_name}/{object_name} 的二進制數據")
            return data
        except Exception as e:
            self._handle_minio_error(e, f"下載 {bucket_name}/{object_name} 的二進制數據失敗")
    
    async def get_presigned_url(
        self, 
        bucket_name: str, 
        object_name: str, 
        expires: timedelta = timedelta(hours=1),
        response_headers: Optional[dict] = None
    ) -> str:
        """
        獲取對象的預簽名URL
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            expires: 過期時間
            response_headers: 回應標頭
            
        Returns:
            str: 預簽名URL
            
        Raises:
            HTTPException: 如果生成URL失敗
        """
        try:
            # 轉換過期時間為秒
            expires_seconds = int(expires.total_seconds())
            
            # 生成預簽名URL
            url = self.client.presigned_get_object(
                bucket_name=bucket_name,
                object_name=object_name,
                expires=expires_seconds,
                response_headers=response_headers
            )
            
            logger.info(f"成功生成 {bucket_name}/{object_name} 的預簽名URL")
            return url
        except Exception as e:
            self._handle_minio_error(e, f"生成 {bucket_name}/{object_name} 的預簽名URL失敗")
    
    async def get_upload_presigned_url(
        self, 
        bucket_name: str, 
        object_name: str, 
        expires: timedelta = timedelta(hours=1)
    ) -> str:
        """
        獲取上傳對象的預簽名URL
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            expires: 過期時間
            
        Returns:
            str: 預簽名URL
            
        Raises:
            HTTPException: 如果生成URL失敗
        """
        try:
            # 確保存儲桶存在
            await self.ensure_bucket_exists(bucket_name)
            
            # 轉換過期時間為秒
            expires_seconds = int(expires.total_seconds())
            
            # 生成預簽名URL
            url = self.client.presigned_put_object(
                bucket_name=bucket_name,
                object_name=object_name,
                expires=expires_seconds
            )
            
            logger.info(f"成功生成 {bucket_name}/{object_name} 的上傳預簽名URL")
            return url
        except Exception as e:
            self._handle_minio_error(e, f"生成 {bucket_name}/{object_name} 的上傳預簽名URL失敗")
    
    async def get_object_stat(
        self, 
        bucket_name: str, 
        object_name: str
    ) -> Dict:
        """
        獲取對象的統計信息
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            
        Returns:
            Dict: 對象統計信息
            
        Raises:
            HTTPException: 如果獲取統計信息失敗
        """
        try:
            # 獲取對象統計信息
            stat = self.client.stat_object(
                bucket_name=bucket_name,
                object_name=object_name
            )
            
            # 轉換為字典
            stat_dict = {
                "size": stat.size,
                "etag": stat.etag,
                "last_modified": stat.last_modified,
                "content_type": stat.content_type,
                "metadata": stat.metadata
            }
            
            logger.info(f"成功獲取 {bucket_name}/{object_name} 的統計信息")
            return stat_dict
        except Exception as e:
            self._handle_minio_error(e, f"獲取 {bucket_name}/{object_name} 的統計信息失敗")
    
    async def delete_object(
        self, 
        bucket_name: str, 
        object_name: str
    ) -> bool:
        """
        刪除對象
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            
        Returns:
            bool: 是否成功刪除
            
        Raises:
            HTTPException: 如果刪除失敗
        """
        try:
            # 刪除對象
            self.client.remove_object(
                bucket_name=bucket_name,
                object_name=object_name
            )
            
            logger.info(f"成功刪除 {bucket_name}/{object_name}")
            return True
        except Exception as e:
            self._handle_minio_error(e, f"刪除 {bucket_name}/{object_name} 失敗")
    
    async def delete_objects(
        self, 
        bucket_name: str, 
        object_names: List[str]
    ) -> bool:
        """
        批量刪除對象
        
        Args:
            bucket_name: 存儲桶名稱
            object_names: 對象名稱列表
            
        Returns:
            bool: 是否成功刪除
            
        Raises:
            HTTPException: 如果刪除失敗
        """
        try:
            # 創建刪除對象列表
            delete_objects = [DeleteObject(name) for name in object_names]
            
            # 執行批量刪除
            errors = self.client.remove_objects(
                bucket_name=bucket_name,
                delete_object_list=delete_objects
            )
            
            # 檢查錯誤
            error_count = 0
            for error in errors:
                logger.error(f"刪除對象失敗: {error}")
                error_count += 1
            
            if error_count > 0:
                logger.warning(f"批量刪除部分失敗: 總共 {len(object_names)} 個對象中的 {error_count} 個刪除失敗")
                return False
            
            logger.info(f"成功刪除 {bucket_name} 中的 {len(object_names)} 個對象")
            return True
        except Exception as e:
            self._handle_minio_error(e, f"批量刪除 {bucket_name} 中的對象失敗")
    
    async def list_objects(
        self, 
        bucket_name: str, 
        prefix: Optional[str] = None,
        recursive: bool = True
    ) -> List[Dict]:
        """
        列出存儲桶中的對象
        
        Args:
            bucket_name: 存儲桶名稱
            prefix: 前綴
            recursive: 是否遞歸
            
        Returns:
            List[Dict]: 對象列表
            
        Raises:
            HTTPException: 如果列表獲取失敗
        """
        try:
            # 列出對象
            objects = self.client.list_objects(
                bucket_name=bucket_name,
                prefix=prefix,
                recursive=recursive
            )
            
            # 轉換為列表
            object_list = []
            for obj in objects:
                object_list.append({
                    "name": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified,
                    "etag": obj.etag,
                    "content_type": "application/octet-stream"  # 默認值
                })
            
            logger.info(f"成功列出 {bucket_name} 中的 {len(object_list)} 個對象")
            return object_list
        except Exception as e:
            self._handle_minio_error(e, f"列出 {bucket_name} 中的對象失敗")
    
    async def copy_object(
        self, 
        source_bucket: str, 
        source_object: str, 
        dest_bucket: str, 
        dest_object: str,
        metadata: Optional[dict] = None
    ) -> str:
        """
        複製對象
        
        Args:
            source_bucket: 源存儲桶名稱
            source_object: 源對象名稱
            dest_bucket: 目標存儲桶名稱
            dest_object: 目標對象名稱
            metadata: 新元數據
            
        Returns:
            str: 目標對象名稱
            
        Raises:
            HTTPException: 如果複製失敗
        """
        try:
            # 確保目標存儲桶存在
            await self.ensure_bucket_exists(dest_bucket)
            
            # 複製對象
            result = self.client.copy_object(
                bucket_name=dest_bucket,
                object_name=dest_object,
                source_bucket_name=source_bucket,
                source_object_name=source_object,
                metadata=metadata
            )
            
            logger.info(f"成功複製 {source_bucket}/{source_object} 到 {dest_bucket}/{dest_object}")
            return dest_object
        except Exception as e:
            self._handle_minio_error(
                e, f"複製 {source_bucket}/{source_object} 到 {dest_bucket}/{dest_object} 失敗"
            )
    
    async def compose_objects(
        self, 
        bucket_name: str, 
        sources: List[Dict[str, str]], 
        dest_object: str,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> str:
        """
        合成多個對象為一個新對象
        
        Args:
            bucket_name: 存儲桶名稱
            sources: 源對象列表，每個元素為字典 {'name': 對象名稱}
            dest_object: 目標對象名稱
            content_type: 內容類型
            metadata: 元數據
            
        Returns:
            str: 目標對象名稱
            
        Raises:
            HTTPException: 如果合成失敗
        """
        try:
            # 確保存儲桶存在
            await self.ensure_bucket_exists(bucket_name)
            
            # 創建合成源對象列表
            compose_sources = [
                ComposeSource(bucket_name, source["name"]) 
                for source in sources
            ]
            
            # 合成對象
            self.client.compose_object(
                bucket_name=bucket_name,
                object_name=dest_object,
                sources=compose_sources,
                content_type=content_type,
                metadata=metadata
            )
            
            logger.info(f"成功合成 {len(sources)} 個對象到 {bucket_name}/{dest_object}")
            return dest_object
        except Exception as e:
            self._handle_minio_error(e, f"合成對象到 {bucket_name}/{dest_object} 失敗")
    
    async def select_object_content(
        self, 
        bucket_name: str, 
        object_name: str,
        expression: str,
        input_serialization: Dict,
        output_serialization: Dict
    ) -> bytes:
        """
        使用SQL查詢對象內容
        
        注意：此方法在當前版本的MinIO客戶端中已不可用
        由於minio.select.options.SelectObjectOptions類已被移除
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            expression: SQL表達式
            input_serialization: 輸入序列化配置
            output_serialization: 輸出序列化配置
            
        Returns:
            bytes: 查詢結果
            
        Raises:
            HTTPException: 不支持的操作異常
        """
        error_msg = "select_object_content 操作在當前MinIO客戶端版本中不受支持"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=error_msg
        )
    
    async def get_bucket_versioning(self, bucket_name: str) -> Dict:
        """
        獲取存儲桶的版本控制狀態
        
        Args:
            bucket_name: 存儲桶名稱
            
        Returns:
            Dict: 版本控制狀態
            
        Raises:
            HTTPException: 如果獲取狀態失敗
        """
        try:
            # 獲取版本控制狀態
            config = self.client.get_bucket_versioning(bucket_name)
            
            # 轉換為字典
            result = {"status": config.status or "Disabled"}
            
            logger.info(f"成功獲取 {bucket_name} 的版本控制狀態: {result['status']}")
            return result
        except Exception as e:
            self._handle_minio_error(e, f"獲取 {bucket_name} 的版本控制狀態失敗")
    
    async def set_bucket_versioning(self, bucket_name: str, enabled: bool) -> bool:
        """
        設置存儲桶的版本控制狀態
        
        Args:
            bucket_name: 存儲桶名稱
            enabled: 是否啟用版本控制
            
        Returns:
            bool: 是否設置成功
            
        Raises:
            HTTPException: 如果設置狀態失敗
        """
        try:
            # 設置版本控制狀態
            self.client.set_bucket_versioning(
                bucket_name=bucket_name,
                status="Enabled" if enabled else "Suspended"
            )
            
            status = "啟用" if enabled else "停用"
            logger.info(f"成功{status} {bucket_name} 的版本控制")
            return True
        except Exception as e:
            self._handle_minio_error(e, f"設置 {bucket_name} 的版本控制狀態失敗")
    
    async def get_object_tags(self, bucket_name: str, object_name: str) -> Dict:
        """
        獲取對象的標籤
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            
        Returns:
            Dict: 標籤字典
            
        Raises:
            HTTPException: 如果獲取標籤失敗
        """
        try:
            # 獲取對象標籤
            tags = self.client.get_object_tags(
                bucket_name=bucket_name,
                object_name=object_name
            )
            
            logger.info(f"成功獲取 {bucket_name}/{object_name} 的標籤")
            return tags
        except Exception as e:
            self._handle_minio_error(e, f"獲取 {bucket_name}/{object_name} 的標籤失敗")
    
    async def set_object_tags(
        self, 
        bucket_name: str, 
        object_name: str, 
        tags: Dict
    ) -> bool:
        """
        設置對象的標籤
        
        Args:
            bucket_name: 存儲桶名稱
            object_name: 對象名稱
            tags: 標籤字典
            
        Returns:
            bool: 是否設置成功
            
        Raises:
            HTTPException: 如果設置標籤失敗
        """
        try:
            # 設置對象標籤
            self.client.set_object_tags(
                bucket_name=bucket_name,
                object_name=object_name,
                tags=tags
            )
            
            logger.info(f"成功設置 {bucket_name}/{object_name} 的標籤")
            return True
        except Exception as e:
            self._handle_minio_error(e, f"設置 {bucket_name}/{object_name} 的標籤失敗")


# 創建全局單例
minio_client = MinioClientManager() 