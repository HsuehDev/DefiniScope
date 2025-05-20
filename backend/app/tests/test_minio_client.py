"""
MinIO 客戶端測試
"""
import sys
import os
import io
import pytest
import tempfile
from unittest.mock import patch, MagicMock
from datetime import timedelta

# 添加父目錄到 path 以便能夠導入應用模塊
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 替換配置
from app.core.mock_config import settings
with patch('app.core.minio_client_improvements.settings', settings):
    from app.core.minio_client_improvements import (
        MinioClientManager, MinioConnectionPool, FileValidator,
        StorageException, FileValidationError
    )

# 創建臨時文件
def create_temp_file(content=b"test content", suffix=".txt"):
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_file.write(content)
    temp_file.close()
    return temp_file.name


# 創建模擬的 MinIO 客戶端
class MockMinioClient:
    def __init__(self):
        self.buckets = {}
        self.objects = {}
    
    def bucket_exists(self, bucket_name):
        return bucket_name in self.buckets
    
    def make_bucket(self, bucket_name):
        self.buckets[bucket_name] = {"creation_date": "2023-01-01T00:00:00Z"}
        self.objects[bucket_name] = {}
        return True
    
    def list_buckets(self):
        return [MagicMock(name=name, creation_date=None) for name in self.buckets.keys()]
    
    def fput_object(self, bucket_name, object_name, file_path, content_type=None, metadata=None):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        with open(file_path, 'rb') as f:
            content = f.read()
        
        self.objects[bucket_name][object_name] = {
            'content': content,
            'content_type': content_type or 'application/octet-stream',
            'metadata': metadata or {},
            'size': len(content),
            'etag': 'mock-etag'
        }
        return {'etag': 'mock-etag'}
    
    def put_object(self, bucket_name, object_name, data, length, content_type=None, metadata=None):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        content = data.read()
        
        self.objects[bucket_name][object_name] = {
            'content': content,
            'content_type': content_type or 'application/octet-stream',
            'metadata': metadata or {},
            'size': length,
            'etag': 'mock-etag'
        }
        return {'etag': 'mock-etag'}
    
    def stat_object(self, bucket_name, object_name):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        if object_name not in self.objects[bucket_name]:
            raise Exception(f"Object {object_name} does not exist in bucket {bucket_name}")
        
        obj = self.objects[bucket_name][object_name]
        return MagicMock(
            size=obj['size'],
            etag=obj['etag'],
            content_type=obj['content_type'],
            last_modified=None,
            metadata=obj['metadata']
        )
    
    def get_object(self, bucket_name, object_name):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        if object_name not in self.objects[bucket_name]:
            raise Exception(f"Object {object_name} does not exist in bucket {bucket_name}")
        
        obj = self.objects[bucket_name][object_name]
        mock_response = MagicMock()
        mock_response.read.return_value = obj['content']
        mock_response.close.return_value = None
        mock_response.release_conn.return_value = None
        return mock_response
    
    def fget_object(self, bucket_name, object_name, file_path):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        if object_name not in self.objects[bucket_name]:
            raise Exception(f"Object {object_name} does not exist in bucket {bucket_name}")
        
        obj = self.objects[bucket_name][object_name]
        with open(file_path, 'wb') as f:
            f.write(obj['content'])
        return file_path
    
    def presigned_get_object(self, bucket_name, object_name, expires=None, response_headers=None):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        if object_name not in self.objects[bucket_name]:
            raise Exception(f"Object {object_name} does not exist in bucket {bucket_name}")
        
        return f"https://example.com/{bucket_name}/{object_name}?presigned=true"
    
    def presigned_put_object(self, bucket_name, object_name, expires=None):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        return f"https://example.com/{bucket_name}/{object_name}?presigned=true&method=PUT"
    
    def remove_object(self, bucket_name, object_name):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        if object_name in self.objects[bucket_name]:
            del self.objects[bucket_name][object_name]
        return True
    
    def list_objects(self, bucket_name, prefix=None, recursive=True, start_after=None):
        if bucket_name not in self.buckets:
            raise Exception(f"Bucket {bucket_name} does not exist")
        
        objects = []
        for obj_name, obj_data in self.objects[bucket_name].items():
            if prefix is None or obj_name.startswith(prefix):
                mock_obj = MagicMock(
                    object_name=obj_name,
                    size=obj_data['size'],
                    last_modified=None,
                    etag=obj_data['etag']
                )
                objects.append(mock_obj)
        return objects


@pytest.fixture
def mock_minio():
    """設置 MinIO 模擬"""
    mock_client = MockMinioClient()
    with patch('app.core.minio_client_improvements.MinioConnectionPool.get_client', return_value=mock_client):
        yield mock_client


@pytest.fixture
def minio_manager(mock_minio):
    """創建 MinIO 客戶端管理器"""
    return MinioClientManager()


@pytest.fixture
def temp_text_file():
    """創建臨時文本文件"""
    file_path = create_temp_file(b"This is a test file content.", ".txt")
    yield file_path
    # 清理臨時文件
    if os.path.exists(file_path):
        os.unlink(file_path)


@pytest.fixture
def temp_image_file():
    """創建臨時圖像文件"""
    # 創建一個簡單的 PNG 文件頭（非真實圖像，僅模擬）
    png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    file_path = create_temp_file(png_header, ".png")
    yield file_path
    # 清理臨時文件
    if os.path.exists(file_path):
        os.unlink(file_path)


@pytest.mark.asyncio
async def test_ensure_bucket_exists(minio_manager, mock_minio):
    """測試確保存儲桶存在功能"""
    bucket_name = "test-bucket"
    
    # 測試創建新存儲桶
    result = await minio_manager.ensure_bucket_exists(bucket_name)
    assert result is True
    assert mock_minio.bucket_exists(bucket_name) is True
    
    # 測試已有存儲桶存在
    result = await minio_manager.ensure_bucket_exists(bucket_name)
    assert result is True


@pytest.mark.asyncio
async def test_upload_file(minio_manager, mock_minio, temp_text_file):
    """測試上傳文件功能"""
    bucket_name = "test-bucket"
    object_name = "test-object.txt"
    
    # 創建存儲桶
    await minio_manager.ensure_bucket_exists(bucket_name)
    
    # 上傳文件
    result = await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=temp_text_file
    )
    
    # 驗證上傳結果
    assert result['object_name'] == object_name
    assert result['etag'] == 'mock-etag'
    assert int(result['size']) > 0
    
    # 驗證對象存在
    assert object_name in mock_minio.objects[bucket_name]
    
    # 測試上傳不存在的文件
    with pytest.raises(Exception):
        await minio_manager.upload_file(
            bucket_name=bucket_name,
            object_name="non-existent.txt",
            file_path="/path/to/non-existent.txt"
        )


@pytest.mark.asyncio
async def test_upload_bytes(minio_manager, mock_minio):
    """測試上傳二進制數據功能"""
    bucket_name = "test-bucket"
    object_name = "test-bytes.bin"
    data = b"binary data for testing"
    
    # 創建存儲桶
    await minio_manager.ensure_bucket_exists(bucket_name)
    
    # 上傳數據
    result = await minio_manager.upload_bytes(
        bucket_name=bucket_name,
        object_name=object_name,
        data=data
    )
    
    # 驗證上傳結果
    assert result['object_name'] == object_name
    assert result['etag'] == 'mock-etag'
    assert int(result['size']) == len(data)
    
    # 驗證對象存在
    assert object_name in mock_minio.objects[bucket_name]
    
    # 測試上傳空數據
    with pytest.raises(Exception):
        await minio_manager.upload_bytes(
            bucket_name=bucket_name,
            object_name="empty.bin",
            data=b""
        )


@pytest.mark.asyncio
async def test_download_file(minio_manager, mock_minio, temp_text_file, tmp_path):
    """測試下載文件功能"""
    bucket_name = "test-bucket"
    object_name = "test-download.txt"
    
    # 創建存儲桶並上傳文件
    await minio_manager.ensure_bucket_exists(bucket_name)
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=temp_text_file
    )
    
    # 下載文件
    download_path = os.path.join(tmp_path, "downloaded.txt")
    result = await minio_manager.download_file(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=download_path
    )
    
    # 驗證下載結果
    assert result == download_path
    assert os.path.exists(download_path)
    
    # 驗證文件內容
    with open(download_path, 'rb') as f:
        content = f.read()
    with open(temp_text_file, 'rb') as f:
        original_content = f.read()
    assert content == original_content
    
    # 測試下載不存在的對象
    with pytest.raises(Exception):
        await minio_manager.download_file(
            bucket_name=bucket_name,
            object_name="non-existent.txt",
            file_path=os.path.join(tmp_path, "non-existent.txt")
        )


@pytest.mark.asyncio
async def test_download_bytes(minio_manager, mock_minio, temp_text_file):
    """測試下載二進制數據功能"""
    bucket_name = "test-bucket"
    object_name = "test-download-bytes.txt"
    
    # 創建存儲桶並上傳文件
    await minio_manager.ensure_bucket_exists(bucket_name)
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=temp_text_file
    )
    
    # 下載數據
    data = await minio_manager.download_bytes(
        bucket_name=bucket_name,
        object_name=object_name
    )
    
    # 驗證數據內容
    with open(temp_text_file, 'rb') as f:
        original_content = f.read()
    assert data == original_content
    
    # 測試下載不存在的對象
    with pytest.raises(Exception):
        await minio_manager.download_bytes(
            bucket_name=bucket_name,
            object_name="non-existent.txt"
        )


@pytest.mark.asyncio
async def test_get_presigned_url(minio_manager, mock_minio, temp_text_file):
    """測試獲取預簽名URL功能"""
    bucket_name = "test-bucket"
    object_name = "test-presigned.txt"
    
    # 創建存儲桶並上傳文件
    await minio_manager.ensure_bucket_exists(bucket_name)
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=temp_text_file
    )
    
    # 獲取預簽名URL
    url = await minio_manager.get_presigned_url(
        bucket_name=bucket_name,
        object_name=object_name,
        expires=timedelta(minutes=30)
    )
    
    # 驗證URL格式
    assert isinstance(url, str)
    assert "presigned=true" in url
    assert bucket_name in url
    assert object_name in url
    
    # 測試獲取不存在對象的預簽名URL
    with pytest.raises(Exception):
        await minio_manager.get_presigned_url(
            bucket_name=bucket_name,
            object_name="non-existent.txt"
        )


@pytest.mark.asyncio
async def test_delete_object(minio_manager, mock_minio, temp_text_file):
    """測試刪除對象功能"""
    bucket_name = "test-bucket"
    object_name = "test-delete.txt"
    
    # 創建存儲桶並上傳文件
    await minio_manager.ensure_bucket_exists(bucket_name)
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=temp_text_file
    )
    
    # 驗證對象存在
    assert object_name in mock_minio.objects[bucket_name]
    
    # 刪除對象
    result = await minio_manager.delete_object(
        bucket_name=bucket_name,
        object_name=object_name
    )
    
    # 驗證刪除結果
    assert result is True
    assert object_name not in mock_minio.objects[bucket_name]
    
    # 測試刪除不存在的對象 (應該返回 False 而非異常)
    result = await minio_manager.delete_object(
        bucket_name=bucket_name,
        object_name="non-existent.txt"
    )
    assert result is False


@pytest.mark.asyncio
async def test_list_objects(minio_manager, mock_minio, temp_text_file):
    """測試列出對象功能"""
    bucket_name = "test-bucket"
    
    # 創建存儲桶
    await minio_manager.ensure_bucket_exists(bucket_name)
    
    # 上傳多個文件
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name="dir1/file1.txt",
        file_path=temp_text_file
    )
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name="dir1/file2.txt",
        file_path=temp_text_file
    )
    await minio_manager.upload_file(
        bucket_name=bucket_name,
        object_name="dir2/file3.txt",
        file_path=temp_text_file
    )
    
    # 列出所有對象
    objects = await minio_manager.list_objects(
        bucket_name=bucket_name,
        recursive=True
    )
    
    # 驗證結果
    assert len(objects) == 3
    assert all('object_name' in obj for obj in objects)
    assert all('size' in obj for obj in objects)
    assert all('etag' in obj for obj in objects)
    
    # 使用前綴過濾
    objects = await minio_manager.list_objects(
        bucket_name=bucket_name,
        prefix="dir1/",
        recursive=True
    )
    
    # 驗證過濾結果
    assert len(objects) == 2
    assert all(obj['object_name'].startswith("dir1/") for obj in objects)


@pytest.mark.asyncio
async def test_file_validation(temp_text_file, temp_image_file):
    """測試文件驗證功能"""
    # 測試有效的文件類型
    assert FileValidator.validate_file_type(temp_text_file) is True
    assert FileValidator.validate_file_type(temp_image_file) is True
    
    # 測試文件大小驗證
    assert FileValidator.validate_file_size(temp_text_file) is True
    
    # 測試限制文件類型
    allowed_types = {'text/plain'}
    assert FileValidator.validate_file_type(temp_text_file, allowed_types) is True
    
    # 測試不允許的文件類型
    with pytest.raises(FileValidationError):
        FileValidator.validate_file_type(temp_image_file, allowed_types)
    
    # 測試文件大小限制
    small_limit = 5  # 5 bytes
    with pytest.raises(FileValidationError):
        FileValidator.validate_file_size(temp_text_file, small_limit)


if __name__ == "__main__":
    pytest.main(["-xvs", __file__]) 