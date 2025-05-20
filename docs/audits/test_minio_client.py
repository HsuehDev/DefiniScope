"""
MinIO客戶端封裝單元測試
使用pytest和pytest-mock測試MinIO功能
"""
import os
import io
import pytest
import time
from unittest.mock import MagicMock, patch, ANY
from minio.error import S3Error, InvalidResponseError, MinioException
from fastapi import HTTPException, status
from pathlib import Path
from datetime import timedelta

# 導入要測試的模組
from docs.audits.minio_client_improvements import (
    MinioClient,
    validate_file_type,
    validate_file_size,
    handle_minio_error
)


# 創建共用的fixture
@pytest.fixture
def mock_settings():
    """模擬設置對象"""
    with patch("docs.audits.minio_client_improvements.settings") as mock_settings:
        mock_settings.MINIO_ENDPOINT = "localhost:9000"
        mock_settings.MINIO_ACCESS_KEY = "minio_access_key"
        mock_settings.MINIO_SECRET_KEY = "minio_secret_key"
        mock_settings.MINIO_SECURE = False
        mock_settings.MINIO_DEFAULT_BUCKET = "documents"
        mock_settings.DEFAULT_PRESIGNED_URL_EXPIRY = 3600
        mock_settings.MAX_UPLOAD_FILE_SIZE = 50 * 1024 * 1024  # 50MB
        mock_settings.ALLOWED_FILE_TYPES = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        yield mock_settings


@pytest.fixture
def mock_minio_client():
    """模擬MinIO客戶端"""
    with patch("docs.audits.minio_client_improvements.Minio") as minio_mock:
        client_mock = MagicMock()
        minio_mock.return_value = client_mock
        
        # 配置模擬行為
        client_mock.bucket_exists.return_value = True
        client_mock.make_bucket.return_value = None
        client_mock.put_object.return_value = MagicMock(object_name="test_object", etag="test_etag")
        client_mock.get_object.return_value = MagicMock(data=io.BytesIO(b"test data"))
        client_mock.presigned_get_object.return_value = "https://minio-server/test-bucket/test-object?signature=xxx"
        client_mock.remove_object.return_value = None
        
        yield client_mock


class TestFileValidation:
    """測試文件驗證函數"""
    
    def test_validate_file_type_valid(self):
        """測試有效的文件類型"""
        # 設置測試數據
        file_path = "test.pdf"
        allowed_types = ["application/pdf", "text/plain"]
        
        # 模擬mimetypes模組
        with patch("docs.audits.minio_client_improvements.mimetypes.guess_type", return_value=("application/pdf", None)):
            result = validate_file_type(file_path, allowed_types)
        
        # 驗證結果
        assert result is True
    
    def test_validate_file_type_invalid(self):
        """測試無效的文件類型"""
        # 設置測試數據
        file_path = "test.jpg"
        allowed_types = ["application/pdf", "text/plain"]
        
        # 模擬mimetypes模組
        with patch("docs.audits.minio_client_improvements.mimetypes.guess_type", return_value=("image/jpeg", None)):
            result = validate_file_type(file_path, allowed_types)
        
        # 驗證結果
        assert result is False
    
    def test_validate_file_size_valid(self):
        """測試有效的文件大小"""
        # 設置測試數據
        file_path = "test.pdf"
        max_size = 5 * 1024 * 1024  # 5MB
        
        # 模擬os.path.getsize
        with patch("docs.audits.minio_client_improvements.os.path.getsize", return_value=1024 * 1024):  # 1MB
            result = validate_file_size(file_path, max_size)
        
        # 驗證結果
        assert result is True
    
    def test_validate_file_size_invalid(self):
        """測試無效的文件大小"""
        # 設置測試數據
        file_path = "test.pdf"
        max_size = 1 * 1024 * 1024  # 1MB
        
        # 模擬os.path.getsize
        with patch("docs.audits.minio_client_improvements.os.path.getsize", return_value=2 * 1024 * 1024):  # 2MB
            result = validate_file_size(file_path, max_size)
        
        # 驗證結果
        assert result is False
    
    def test_handle_minio_error_s3error(self):
        """測試處理S3Error的函數"""
        # 設置測試數據
        error = S3Error("NoSuchBucket", "指定的存儲桶不存在", "test-bucket", "test-region")
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            handle_minio_error(error, "測試操作")
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "測試操作" in excinfo.value.detail
        assert "指定的存儲桶不存在" in excinfo.value.detail
    
    def test_handle_minio_error_other_exception(self):
        """測試處理一般異常的函數"""
        # 設置測試數據
        error = Exception("一般錯誤")
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            handle_minio_error(error, "測試操作")
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "測試操作" in excinfo.value.detail
        assert "一般錯誤" in excinfo.value.detail


class TestMinioClient:
    """測試MinIO客戶端類"""
    
    def test_init_create_bucket_if_not_exists(self, mock_minio_client, mock_settings):
        """測試初始化時創建存儲桶（如果不存在）"""
        # 設置模擬行為
        mock_minio_client.bucket_exists.return_value = False
        
        # 創建客戶端實例
        client = MinioClient()
        
        # 驗證結果
        mock_minio_client.bucket_exists.assert_called_once_with(mock_settings.MINIO_DEFAULT_BUCKET)
        mock_minio_client.make_bucket.assert_called_once_with(mock_settings.MINIO_DEFAULT_BUCKET)
    
    def test_init_bucket_exists(self, mock_minio_client, mock_settings):
        """測試初始化時存儲桶已存在的情況"""
        # 設置模擬行為
        mock_minio_client.bucket_exists.return_value = True
        
        # 創建客戶端實例
        client = MinioClient()
        
        # 驗證結果
        mock_minio_client.bucket_exists.assert_called_once_with(mock_settings.MINIO_DEFAULT_BUCKET)
        mock_minio_client.make_bucket.assert_not_called()
    
    def test_upload_file_success(self, mock_minio_client, mock_settings):
        """測試成功上傳文件"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        file_path = "test.pdf"
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 模擬文件操作
        with patch("docs.audits.minio_client_improvements.validate_file_type", return_value=True):
            with patch("docs.audits.minio_client_improvements.validate_file_size", return_value=True):
                with patch("builtins.open", MagicMock()):
                    with patch("os.path.exists", return_value=True):
                        with patch("pathlib.Path.stat") as mock_stat:
                            mock_stat.return_value.st_size = 1024  # 1KB
                            result = client.upload_file(file_path, object_name, bucket_name)
        
        # 驗證結果
        assert result["object_name"] == object_name
        assert result["bucket_name"] == bucket_name
        assert "etag" in result
        mock_minio_client.put_object.assert_called_once()
    
    def test_upload_file_invalid_type(self, mock_minio_client, mock_settings):
        """測試上傳無效類型的文件"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        file_path = "test.jpg"
        object_name = "documents/test.jpg"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 模擬文件操作
        with patch("docs.audits.minio_client_improvements.validate_file_type", return_value=False):
            with patch("os.path.exists", return_value=True):
                with pytest.raises(HTTPException) as excinfo:
                    client.upload_file(file_path, object_name, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "不支持的文件類型" in excinfo.value.detail
        mock_minio_client.put_object.assert_not_called()
    
    def test_upload_file_invalid_size(self, mock_minio_client, mock_settings):
        """測試上傳超出大小限制的文件"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        file_path = "test.pdf"
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 模擬文件操作
        with patch("docs.audits.minio_client_improvements.validate_file_type", return_value=True):
            with patch("docs.audits.minio_client_improvements.validate_file_size", return_value=False):
                with patch("os.path.exists", return_value=True):
                    with pytest.raises(HTTPException) as excinfo:
                        client.upload_file(file_path, object_name, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "超出最大允許大小" in excinfo.value.detail
        mock_minio_client.put_object.assert_not_called()
    
    def test_upload_file_not_found(self, mock_minio_client, mock_settings):
        """測試上傳不存在的文件"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        file_path = "nonexistent.pdf"
        object_name = "documents/nonexistent.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 模擬文件操作
        with patch("os.path.exists", return_value=False):
            with pytest.raises(HTTPException) as excinfo:
                client.upload_file(file_path, object_name, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_404_NOT_FOUND
        assert "文件不存在" in excinfo.value.detail
        mock_minio_client.put_object.assert_not_called()
    
    def test_upload_file_minio_error(self, mock_minio_client, mock_settings):
        """測試上傳文件時發生MinIO錯誤"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        file_path = "test.pdf"
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 設置錯誤行為
        mock_minio_client.put_object.side_effect = S3Error("InternalError", "內部服務器錯誤", bucket_name, "test-region")
        
        # 模擬文件操作
        with patch("docs.audits.minio_client_improvements.validate_file_type", return_value=True):
            with patch("docs.audits.minio_client_improvements.validate_file_size", return_value=True):
                with patch("builtins.open", MagicMock()):
                    with patch("os.path.exists", return_value=True):
                        with patch("pathlib.Path.stat") as mock_stat:
                            mock_stat.return_value.st_size = 1024  # 1KB
                            with pytest.raises(HTTPException) as excinfo:
                                client.upload_file(file_path, object_name, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "上傳文件" in excinfo.value.detail
        assert "內部服務器錯誤" in excinfo.value.detail
    
    def test_download_file_success(self, mock_minio_client, mock_settings):
        """測試成功下載文件"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        object_name = "documents/test.pdf"
        output_path = "/tmp/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 模擬文件操作
        with patch("builtins.open", MagicMock()):
            with patch("os.makedirs") as mock_makedirs:
                result = client.download_file(object_name, output_path, bucket_name)
        
        # 驗證結果
        assert result == output_path
        mock_minio_client.get_object.assert_called_once_with(bucket_name, object_name)
        mock_makedirs.assert_called_once()
    
    def test_download_file_minio_error(self, mock_minio_client, mock_settings):
        """測試下載文件時發生MinIO錯誤"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        object_name = "documents/test.pdf"
        output_path = "/tmp/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 設置錯誤行為
        mock_minio_client.get_object.side_effect = S3Error("NoSuchKey", "指定的對象不存在", bucket_name, "test-region")
        
        # 模擬文件操作
        with patch("builtins.open", MagicMock()):
            with patch("os.makedirs"):
                with pytest.raises(HTTPException) as excinfo:
                    client.download_file(object_name, output_path, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "下載文件" in excinfo.value.detail
        assert "指定的對象不存在" in excinfo.value.detail
    
    def test_get_file_url_success(self, mock_minio_client, mock_settings):
        """測試成功獲取文件URL"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        expires = timedelta(hours=2)
        
        # 執行函數
        result = client.get_file_url(object_name, bucket_name, expires)
        
        # 驗證結果
        assert result == "https://minio-server/test-bucket/test-object?signature=xxx"
        mock_minio_client.presigned_get_object.assert_called_once_with(
            bucket_name, 
            object_name, 
            expires=int(expires.total_seconds())
        )
    
    def test_get_file_url_minio_error(self, mock_minio_client, mock_settings):
        """測試獲取文件URL時發生MinIO錯誤"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 設置錯誤行為
        mock_minio_client.presigned_get_object.side_effect = S3Error("SignatureDoesNotMatch", "簽名不匹配", bucket_name, "test-region")
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            client.get_file_url(object_name, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "生成預簽名URL" in excinfo.value.detail
        assert "簽名不匹配" in excinfo.value.detail
    
    def test_delete_file_success(self, mock_minio_client, mock_settings):
        """測試成功刪除文件"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 執行函數
        result = client.delete_file(object_name, bucket_name)
        
        # 驗證結果
        assert result is True
        mock_minio_client.remove_object.assert_called_once_with(bucket_name, object_name)
    
    def test_delete_file_minio_error(self, mock_minio_client, mock_settings):
        """測試刪除文件時發生MinIO錯誤"""
        # 創建客戶端實例
        client = MinioClient()
        
        # 設置測試數據
        object_name = "documents/test.pdf"
        bucket_name = mock_settings.MINIO_DEFAULT_BUCKET
        
        # 設置錯誤行為
        mock_minio_client.remove_object.side_effect = S3Error("AccessDenied", "拒絕訪問", bucket_name, "test-region")
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            client.delete_file(object_name, bucket_name)
        
        # 驗證結果
        assert excinfo.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "刪除文件" in excinfo.value.detail
        assert "拒絕訪問" in excinfo.value.detail 