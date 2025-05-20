"""
MinIO客戶端的單元測試案例
使用pytest和pytest-mock
"""
import io
import os
import pytest
import uuid
import time
from datetime import timedelta
from unittest.mock import MagicMock, patch, call
from fastapi import HTTPException

from app.core.minio_client import MinioClientManager, MinioConnectionPool


@pytest.fixture
def mock_minio_client():
    """提供模擬的MinIO客戶端"""
    client = MagicMock()
    return client


@pytest.fixture
def minio_manager(mock_minio_client):
    """提供帶有模擬客戶端的MinioClientManager實例"""
    with patch("app.core.minio_client.MinioConnectionPool.get_client", return_value=mock_minio_client):
        manager = MinioClientManager()
        manager.client = mock_minio_client
        yield manager


class TestMinioConnectionPool:
    """MinioConnectionPool單元測試"""
    
    def test_singleton_pattern(self):
        """測試單例模式實現"""
        # 重置實例以確保乾淨的測試環境
        MinioConnectionPool._instance = None
        MinioConnectionPool._clients = []
        
        # 模擬Minio類
        with patch("app.core.minio_client.Minio") as mock_minio:
            # 首次調用
            instance1 = MinioConnectionPool()
            # 第二次調用
            instance2 = MinioConnectionPool()
            
            # 驗證是同一個實例
            assert instance1 is instance2
            # 驗證Minio構造函數被調用
            mock_minio.assert_called()
    
    def test_get_client(self):
        """測試獲取客戶端"""
        # 重置實例以確保乾淨的測試環境
        MinioConnectionPool._instance = None
        MinioConnectionPool._clients = []
        
        # 模擬Minio類
        with patch("app.core.minio_client.Minio") as mock_minio:
            # 模擬預創建的客戶端
            mock_client = MagicMock()
            mock_minio.return_value = mock_client
            
            # 初始化連接池
            pool = MinioConnectionPool()
            
            # 使上下文管理器中的回調函數執行
            with patch.object(MinioConnectionPool, "_pool") as mock_pool:
                # 獲取客戶端
                client = MinioConnectionPool.get_client()
                
                # 驗證返回的是預期的客戶端
                assert client is mock_client
                # 驗證回調函數被提交
                mock_pool.submit.assert_called()


class TestMinioClientManager:
    """MinioClientManager單元測試"""
    
    def test_init_success(self, mock_minio_client):
        """測試初始化成功"""
        # 配置模擬對象
        with patch("app.core.minio_client.MinioConnectionPool.get_client", return_value=mock_minio_client):
            # 執行
            manager = MinioClientManager()
            
            # 驗證
            assert manager.client is mock_minio_client
    
    def test_init_failure(self):
        """測試初始化失敗"""
        # 模擬異常
        with patch("app.core.minio_client.MinioConnectionPool.get_client", side_effect=Exception("連接失敗")):
            # 執行與驗證
            with pytest.raises(RuntimeError) as excinfo:
                MinioClientManager()
            assert "無法連接到MinIO服務" in str(excinfo.value)


class TestEnsureBucketExists:
    """ensure_bucket_exists 方法測試"""
    
    @pytest.mark.asyncio
    async def test_bucket_already_exists(self, minio_manager):
        """測試桶已存在的情況"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        minio_manager.client.bucket_exists.return_value = True
        
        # 執行
        result = await minio_manager.ensure_bucket_exists(bucket_name)
        
        # 驗證
        assert result is True
        minio_manager.client.bucket_exists.assert_called_once_with(bucket_name)
        minio_manager.client.make_bucket.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_create_bucket(self, minio_manager):
        """測試創建新桶的情況"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        minio_manager.client.bucket_exists.return_value = False
        
        # 執行
        result = await minio_manager.ensure_bucket_exists(bucket_name)
        
        # 驗證
        assert result is True
        minio_manager.client.bucket_exists.assert_called_once_with(bucket_name)
        minio_manager.client.make_bucket.assert_called_once_with(bucket_name)
    
    @pytest.mark.asyncio
    async def test_bucket_create_error(self, minio_manager):
        """測試創建桶失敗的情況"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        minio_manager.client.bucket_exists.return_value = False
        minio_manager.client.make_bucket.side_effect = Exception("無法創建桶")
        
        # 執行與驗證
        with pytest.raises(HTTPException) as excinfo:
            await minio_manager.ensure_bucket_exists(bucket_name)
        assert excinfo.value.status_code == 500
        assert "存儲操作失敗" in excinfo.value.detail


class TestUploadFile:
    """upload_file 方法測試"""
    
    @pytest.mark.asyncio
    async def test_regular_file_upload(self, minio_manager):
        """測試常規文件上傳"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/test.pdf"
        content_type = "application/pdf"
        metadata = {"key": "value"}
        
        # 模擬確保桶存在
        with patch.object(minio_manager, "ensure_bucket_exists", return_value=True) as mock_ensure:
            # 模擬檔案存在和大小
            with patch("os.path.exists", return_value=True), \
                 patch("os.path.getsize", return_value=1024):  # 小於閾值
                
                # 執行
                result = await minio_manager.upload_file(
                    bucket_name, object_name, file_path, content_type, metadata
                )
                
                # 驗證
                assert result == object_name
                mock_ensure.assert_called_once_with(bucket_name)
                minio_manager.client.fput_object.assert_called_once_with(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    file_path=file_path,
                    content_type=content_type,
                    metadata=metadata
                )
    
    @pytest.mark.asyncio
    async def test_large_file_upload(self, minio_manager):
        """測試大文件上傳 (使用分片上傳)"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/test.pdf"
        content_type = "application/pdf"
        metadata = {"key": "value"}
        
        # 模擬大文件大小 (超過閾值)
        large_size = 200 * 1024 * 1024  # 200MB
        
        # 模擬確保桶存在
        with patch.object(minio_manager, "ensure_bucket_exists", return_value=True) as mock_ensure:
            # 模擬檔案存在和大小
            with patch("os.path.exists", return_value=True), \
                 patch("os.path.getsize", return_value=large_size), \
                 patch.object(minio_manager, "upload_large_file", return_value=object_name) as mock_upload_large:
                
                # 執行
                result = await minio_manager.upload_file(
                    bucket_name, object_name, file_path, content_type, metadata
                )
                
                # 驗證
                assert result == object_name
                mock_ensure.assert_called_once_with(bucket_name)
                mock_upload_large.assert_called_once_with(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    file_path=file_path,
                    content_type=content_type,
                    metadata=metadata
                )
                # 確保沒有調用標準上傳
                minio_manager.client.fput_object.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_file_not_found(self, minio_manager):
        """測試文件不存在"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/nonexistent.pdf"
        
        # 模擬確保桶存在
        with patch.object(minio_manager, "ensure_bucket_exists", return_value=True) as mock_ensure:
            # 模擬檔案不存在
            with patch("os.path.exists", return_value=False):
                
                # 執行與驗證
                with pytest.raises(HTTPException) as excinfo:
                    await minio_manager.upload_file(bucket_name, object_name, file_path)
                
                assert excinfo.value.status_code == 404
                assert "文件不存在" in excinfo.value.detail
                mock_ensure.assert_called_once_with(bucket_name)
    
    @pytest.mark.asyncio
    async def test_upload_error(self, minio_manager):
        """測試上傳過程中的錯誤"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/test.pdf"
        
        # 模擬確保桶存在
        with patch.object(minio_manager, "ensure_bucket_exists", return_value=True) as mock_ensure:
            # 模擬檔案存在但上傳失敗
            with patch("os.path.exists", return_value=True), \
                 patch("os.path.getsize", return_value=1024):
                
                minio_manager.client.fput_object.side_effect = Exception("上傳失敗")
                
                # 執行與驗證
                with pytest.raises(HTTPException) as excinfo:
                    await minio_manager.upload_file(bucket_name, object_name, file_path)
                
                assert excinfo.value.status_code == 500
                assert "上傳文件" in excinfo.value.detail
                assert "失敗" in excinfo.value.detail
                mock_ensure.assert_called_once_with(bucket_name)


class TestUploadLargeFile:
    """upload_large_file 方法測試"""
    
    @pytest.mark.asyncio
    async def test_large_file_upload_success(self, minio_manager):
        """測試大文件分片上傳成功"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/test.pdf"
        content_type = "application/pdf"
        metadata = {"key": "value"}
        
        # 模擬檔案大小為15MB (需要2個分片)
        file_size = 15 * 1024 * 1024
        part_size = 10 * 1024 * 1024  # 10MB分片
        
        # 模擬確保桶存在
        with patch.object(minio_manager, "ensure_bucket_exists", return_value=True) as mock_ensure:
            # 模擬檔案存在
            with patch("os.path.exists", return_value=True), \
                 patch("os.path.getsize", return_value=file_size):
                
                # 模擬文件打開和讀取
                mock_file = MagicMock()
                mock_file.__enter__.return_value = mock_file
                mock_file.read.side_effect = [b"x" * part_size, b"x" * (file_size - part_size), b""]
                
                with patch("builtins.open", return_value=mock_file):
                    # 模擬MinIO分片上傳操作
                    upload_id = "test-upload-id"
                    minio_manager.client.create_multipart_upload.return_value = upload_id
                    minio_manager.client.put_object_part.side_effect = ["etag1", "etag2"]
                    
                    # 執行
                    result = await minio_manager.upload_large_file(
                        bucket_name, object_name, file_path, content_type, metadata
                    )
                    
                    # 驗證
                    assert result == object_name
                    mock_ensure.assert_called_once_with(bucket_name)
                    
                    # 驗證創建多部分上傳
                    minio_manager.client.create_multipart_upload.assert_called_once_with(
                        bucket_name, object_name, content_type, metadata
                    )
                    
                    # 驗證上傳各個部分
                    assert minio_manager.client.put_object_part.call_count == 2
                    
                    # 驗證完成多部分上傳
                    minio_manager.client.complete_multipart_upload.assert_called_once_with(
                        bucket_name, object_name, upload_id, [(1, "etag1"), (2, "etag2")]
                    )
    
    @pytest.mark.asyncio
    async def test_large_file_upload_error(self, minio_manager):
        """測試大文件分片上傳錯誤"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/test.pdf"
        
        # 模擬確保桶存在
        with patch.object(minio_manager, "ensure_bucket_exists", return_value=True) as mock_ensure:
            # 模擬檔案存在但創建多部分上傳失敗
            with patch("os.path.exists", return_value=True), \
                 patch("os.path.getsize", return_value=20 * 1024 * 1024):
                
                minio_manager.client.create_multipart_upload.side_effect = Exception("無法創建多部分上傳")
                
                # 執行與驗證
                with pytest.raises(HTTPException) as excinfo:
                    await minio_manager.upload_large_file(bucket_name, object_name, file_path)
                
                assert excinfo.value.status_code == 500
                assert "分片上傳大文件" in excinfo.value.detail
                assert "失敗" in excinfo.value.detail
                mock_ensure.assert_called_once_with(bucket_name)


class TestDownloadFile:
    """download_file 方法測試"""
    
    @pytest.mark.asyncio
    async def test_download_success(self, minio_manager):
        """測試下載文件成功"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/download.pdf"
        
        # 模擬目錄創建
        with patch("os.makedirs") as mock_makedirs:
            # 執行
            result = await minio_manager.download_file(bucket_name, object_name, file_path)
            
            # 驗證
            assert result == file_path
            mock_makedirs.assert_called_once_with(os.path.dirname(file_path), exist_ok=True)
            minio_manager.client.fget_object.assert_called_once_with(
                bucket_name=bucket_name,
                object_name=object_name,
                file_path=file_path
            )
    
    @pytest.mark.asyncio
    async def test_download_error(self, minio_manager):
        """測試下載文件失敗"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_path = "/tmp/download.pdf"
        
        # 模擬目錄創建
        with patch("os.makedirs"):
            # 模擬下載失敗
            minio_manager.client.fget_object.side_effect = Exception("下載失敗")
            
            # 執行與驗證
            with pytest.raises(HTTPException) as excinfo:
                await minio_manager.download_file(bucket_name, object_name, file_path)
            
            assert excinfo.value.status_code == 500
            assert "下載" in excinfo.value.detail
            assert "失敗" in excinfo.value.detail


class TestPreSignedUrl:
    """get_presigned_url 和 get_upload_presigned_url 方法測試"""
    
    @pytest.mark.asyncio
    async def test_get_presigned_url_default_expiry(self, minio_manager):
        """測試獲取預簽名URL (默認過期時間)"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        expected_url = "https://minio-server/test-bucket/test.pdf?X-Amz-Algorithm=..."
        
        minio_manager.client.presigned_get_object.return_value = expected_url
        
        # 執行
        result = await minio_manager.get_presigned_url(bucket_name, object_name)
        
        # 驗證
        assert result == expected_url
        minio_manager.client.presigned_get_object.assert_called_once_with(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=int(timedelta(hours=1).total_seconds()),  # 默認1小時
            response_headers=None
        )
    
    @pytest.mark.asyncio
    async def test_get_presigned_url_custom_expiry(self, minio_manager):
        """測試獲取預簽名URL (自定義過期時間)"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        expected_url = "https://minio-server/test-bucket/test.pdf?X-Amz-Algorithm=..."
        custom_expires = timedelta(minutes=30)
        
        minio_manager.client.presigned_get_object.return_value = expected_url
        
        # 執行
        result = await minio_manager.get_presigned_url(bucket_name, object_name, custom_expires)
        
        # 驗證
        assert result == expected_url
        minio_manager.client.presigned_get_object.assert_called_once_with(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=int(custom_expires.total_seconds()),
            response_headers=None
        )
    
    @pytest.mark.asyncio
    async def test_get_presigned_url_error(self, minio_manager):
        """測試獲取預簽名URL失敗"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        minio_manager.client.presigned_get_object.side_effect = Exception("生成URL失敗")
        
        # 執行與驗證
        with pytest.raises(HTTPException) as excinfo:
            await minio_manager.get_presigned_url(bucket_name, object_name)
        
        assert excinfo.value.status_code == 500
        assert "生成預簽名URL失敗" in excinfo.value.detail
    
    @pytest.mark.asyncio
    async def test_get_upload_presigned_url(self, minio_manager):
        """測試獲取上傳用預簽名URL"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        expected_url = "https://minio-server/test-bucket/test.pdf?X-Amz-Algorithm=..."
        
        minio_manager.client.presigned_put_object.return_value = expected_url
        
        # 執行
        result = await minio_manager.get_upload_presigned_url(bucket_name, object_name)
        
        # 驗證
        assert result == expected_url
        minio_manager.client.presigned_put_object.assert_called_once_with(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=int(timedelta(hours=1).total_seconds())  # 默認1小時
        )


class TestDeleteObject:
    """delete_object 和 delete_objects 方法測試"""
    
    @pytest.mark.asyncio
    async def test_delete_object_success(self, minio_manager):
        """測試刪除單個對象成功"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        # 執行
        result = await minio_manager.delete_object(bucket_name, object_name)
        
        # 驗證
        assert result is True
        minio_manager.client.remove_object.assert_called_once_with(
            bucket_name=bucket_name,
            object_name=object_name
        )
    
    @pytest.mark.asyncio
    async def test_delete_object_error(self, minio_manager):
        """測試刪除單個對象失敗"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        minio_manager.client.remove_object.side_effect = Exception("刪除失敗")
        
        # 執行與驗證
        with pytest.raises(HTTPException) as excinfo:
            await minio_manager.delete_object(bucket_name, object_name)
        
        assert excinfo.value.status_code == 500
        assert "刪除對象" in excinfo.value.detail
        assert "失敗" in excinfo.value.detail
    
    @pytest.mark.asyncio
    async def test_delete_objects_success(self, minio_manager):
        """測試批量刪除對象成功"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_names = ["test1.pdf", "test2.pdf", "test3.pdf"]
        
        # 執行
        result = await minio_manager.delete_objects(bucket_name, object_names)
        
        # 驗證
        assert result is True
        # 驗證調用了remove_objects，而不是重複調用remove_object
        minio_manager.client.remove_objects.assert_called_once()
        # 由於remove_objects的參數是迭代器，無法直接比較，這裡只檢查調用次數
    
    @pytest.mark.asyncio
    async def test_delete_objects_error(self, minio_manager):
        """測試批量刪除對象失敗"""
        # 配置模擬對象
        bucket_name = "test-bucket"
        object_names = ["test1.pdf", "test2.pdf"]
        
        minio_manager.client.remove_objects.side_effect = Exception("批量刪除失敗")
        
        # 執行與驗證
        with pytest.raises(HTTPException) as excinfo:
            await minio_manager.delete_objects(bucket_name, object_names)
        
        assert excinfo.value.status_code == 500
        assert "批量刪除對象" in excinfo.value.detail
        assert "失敗" in excinfo.value.detail


if __name__ == "__main__":
    pytest.main(["-xvs", __file__]) 