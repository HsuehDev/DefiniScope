import pytest
import io
import time
from unittest.mock import patch, MagicMock
from minio.error import S3Error

from app.core.minio_client import (
    get_minio_client, ensure_bucket_exists, upload_file, download_file,
    delete_file, generate_presigned_url, check_upload_timeout
)


@pytest.fixture
def mock_minio_client():
    """提供模擬的 MinIO 客戶端"""
    client = MagicMock()
    with patch('app.core.minio_client.get_minio_client', return_value=client):
        yield client


class TestMinIOClient:
    """MinIO 客戶端測試類"""
    
    def test_get_minio_client_singleton(self, monkeypatch):
        """測試 MinIO 客戶端單例模式"""
        # 模擬 Minio 類
        mock_minio = MagicMock()
        monkeypatch.setattr('app.core.minio_client.Minio', mock_minio)
        
        # 模擬設定
        monkeypatch.setattr('app.core.minio_client.settings.MINIO_URL', 'localhost:9000')
        monkeypatch.setattr('app.core.minio_client.settings.MINIO_ACCESS_KEY', 'access_key')
        monkeypatch.setattr('app.core.minio_client.settings.MINIO_SECRET_KEY', 'secret_key')
        monkeypatch.setattr('app.core.minio_client.settings.MINIO_SECURE', False)
        
        # 確保全局變量為 None
        import app.core.minio_client
        app.core.minio_client._minio_client = None
        
        # 首次調用
        client1 = get_minio_client()
        
        # 第二次調用
        client2 = get_minio_client()
        
        # 斷言 mock_minio 只被調用一次
        assert mock_minio.call_count == 1
        # 斷言獲取的是同一個客戶端實例
        assert client1 is client2
    
    def test_ensure_bucket_exists_bucket_exists(self, mock_minio_client):
        """測試確保桶存在功能 - 桶已存在"""
        # 模擬桶已存在
        mock_minio_client.bucket_exists.return_value = True
        
        # 執行
        result = ensure_bucket_exists("test-bucket")
        
        # 斷言
        assert result is True
        mock_minio_client.bucket_exists.assert_called_once_with("test-bucket")
        mock_minio_client.make_bucket.assert_not_called()
    
    def test_ensure_bucket_exists_create_bucket(self, mock_minio_client):
        """測試確保桶存在功能 - 創建新桶"""
        # 模擬桶不存在
        mock_minio_client.bucket_exists.return_value = False
        
        # 執行
        result = ensure_bucket_exists("test-bucket")
        
        # 斷言
        assert result is True
        mock_minio_client.bucket_exists.assert_called_once_with("test-bucket")
        mock_minio_client.make_bucket.assert_called_once_with("test-bucket")
    
    def test_ensure_bucket_exists_error(self, mock_minio_client):
        """測試確保桶存在功能 - 發生錯誤"""
        # 模擬拋出異常
        mock_minio_client.bucket_exists.side_effect = S3Error(
            "ServerError", "Internal server error", "", "", "", ""
        )
        
        # 執行
        result = ensure_bucket_exists("test-bucket")
        
        # 斷言
        assert result is False
        mock_minio_client.bucket_exists.assert_called_once_with("test-bucket")
        mock_minio_client.make_bucket.assert_not_called()
    
    def test_upload_file_success(self, mock_minio_client):
        """測試上傳檔案功能 - 成功"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_data = io.BytesIO(b"test file data")
        content_type = "application/pdf"
        
        # 模擬確保桶存在功能
        with patch('app.core.minio_client.ensure_bucket_exists', return_value=True) as mock_ensure_bucket:
            # 執行
            result = upload_file(bucket_name, object_name, file_data, content_type)
            
            # 斷言
            assert result is True
            mock_ensure_bucket.assert_called_once_with(bucket_name)
            mock_minio_client.put_object.assert_called_once_with(
                bucket_name=bucket_name,
                object_name=object_name,
                data=file_data,
                length=-1,
                content_type=content_type
            )
    
    def test_upload_file_bucket_creation_fails(self, mock_minio_client):
        """測試上傳檔案功能 - 創建桶失敗"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_data = io.BytesIO(b"test file data")
        
        # 模擬確保桶存在功能失敗
        with patch('app.core.minio_client.ensure_bucket_exists', return_value=False) as mock_ensure_bucket:
            # 執行
            result = upload_file(bucket_name, object_name, file_data)
            
            # 斷言
            assert result is False
            mock_ensure_bucket.assert_called_once_with(bucket_name)
            mock_minio_client.put_object.assert_not_called()
    
    def test_upload_file_error(self, mock_minio_client):
        """測試上傳檔案功能 - 上傳發生錯誤"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_data = io.BytesIO(b"test file data")
        
        # 模擬確保桶存在功能成功但上傳失敗
        with patch('app.core.minio_client.ensure_bucket_exists', return_value=True) as mock_ensure_bucket:
            # 模擬拋出異常
            mock_minio_client.put_object.side_effect = S3Error(
                "UploadError", "Upload failed", "", "", "", ""
            )
            
            # 執行
            result = upload_file(bucket_name, object_name, file_data)
            
            # 斷言
            assert result is False
            mock_ensure_bucket.assert_called_once_with(bucket_name)
            mock_minio_client.put_object.assert_called_once()
    
    def test_download_file_success(self, mock_minio_client):
        """測試下載檔案功能 - 成功"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        file_content = b"test file data"
        
        # 模擬物件內容
        mock_response = MagicMock()
        mock_response.read.return_value = file_content
        mock_response.__enter__.return_value = mock_response
        mock_minio_client.get_object.return_value = mock_response
        
        # 執行
        result = download_file(bucket_name, object_name)
        
        # 斷言
        assert result == file_content
        mock_minio_client.get_object.assert_called_once_with(bucket_name, object_name)
    
    def test_download_file_error(self, mock_minio_client):
        """測試下載檔案功能 - 發生錯誤"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        # 模擬拋出異常
        mock_minio_client.get_object.side_effect = S3Error(
            "NoSuchKey", "The specified key does not exist", "", "", "", ""
        )
        
        # 執行
        result = download_file(bucket_name, object_name)
        
        # 斷言
        assert result is None
        mock_minio_client.get_object.assert_called_once_with(bucket_name, object_name)
    
    def test_delete_file_success(self, mock_minio_client):
        """測試刪除檔案功能 - 成功"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        # 執行
        result = delete_file(bucket_name, object_name)
        
        # 斷言
        assert result is True
        mock_minio_client.remove_object.assert_called_once_with(bucket_name, object_name)
    
    def test_delete_file_error(self, mock_minio_client):
        """測試刪除檔案功能 - 發生錯誤"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        # 模擬拋出異常
        mock_minio_client.remove_object.side_effect = S3Error(
            "DeleteError", "Delete failed", "", "", "", ""
        )
        
        # 執行
        result = delete_file(bucket_name, object_name)
        
        # 斷言
        assert result is False
        mock_minio_client.remove_object.assert_called_once_with(bucket_name, object_name)
    
    def test_generate_presigned_url_success(self, mock_minio_client):
        """測試生成預簽名 URL 功能 - 成功"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        expires = 900  # 15分鐘
        expected_url = "https://minio.example.com/test-bucket/test.pdf?token=xyz"
        
        # 模擬返回預簽名 URL
        mock_minio_client.presigned_get_object.return_value = expected_url
        
        # 執行
        result = generate_presigned_url(bucket_name, object_name, expires)
        
        # 斷言
        assert result == expected_url
        mock_minio_client.presigned_get_object.assert_called_once_with(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=expires,
            response_headers=None
        )
    
    def test_generate_presigned_url_default_expiry(self, mock_minio_client):
        """測試生成預簽名 URL 功能 - 使用默認過期時間"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        expected_url = "https://minio.example.com/test-bucket/test.pdf?token=xyz"
        
        # 模擬返回預簽名 URL
        mock_minio_client.presigned_get_object.return_value = expected_url
        
        # 執行
        result = generate_presigned_url(bucket_name, object_name)
        
        # 斷言
        assert result == expected_url
        mock_minio_client.presigned_get_object.assert_called_once_with(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=900,  # 默認15分鐘 (900秒)
            response_headers=None
        )
    
    def test_generate_presigned_url_error(self, mock_minio_client):
        """測試生成預簽名 URL 功能 - 發生錯誤"""
        # 模擬參數
        bucket_name = "test-bucket"
        object_name = "test.pdf"
        
        # 模擬拋出異常
        mock_minio_client.presigned_get_object.side_effect = S3Error(
            "SignatureError", "Signature generation failed", "", "", "", ""
        )
        
        # 執行
        result = generate_presigned_url(bucket_name, object_name)
        
        # 斷言
        assert result is None
        mock_minio_client.presigned_get_object.assert_called_once()
    
    def test_check_upload_timeout_not_timeout(self):
        """測試上傳超時檢查功能 - 未超時"""
        # 模擬參數
        file_id = "test-file-id"
        start_time = time.time() - 300  # 5分鐘前
        
        # 執行
        result = check_upload_timeout(file_id, start_time)
        
        # 斷言
        assert result is False
    
    def test_check_upload_timeout_timeout(self):
        """測試上傳超時檢查功能 - 已超時"""
        # 模擬參數
        file_id = "test-file-id"
        start_time = time.time() - 601  # 10分鐘+1秒前
        
        # 執行
        result = check_upload_timeout(file_id, start_time)
        
        # 斷言
        assert result is True 