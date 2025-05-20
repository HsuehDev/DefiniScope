# MinIO 儲存服務使用範例

本文檔提供了使用 MinIO 儲存服務模組的詳細程式碼範例，涵蓋了常見的使用場景。

## 1. 基本檔案操作

### 1.1 上傳檔案

```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from uuid import uuid4

from app.core.deps import get_minio_client, get_current_user
from app.services.storage_client import MinIOClient
from app.models.user import User

router = APIRouter()

@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """上傳單個檔案"""
    
    # 生成唯一檔案名
    file_id = str(uuid4())
    bucket_name = f"user-{current_user.user_uuid}"
    object_key = f"{file_id}.pdf"
    
    # 讀取檔案內容
    file_content = await file.read()
    
    # 上傳到 MinIO
    result = await minio_client.upload_object(
        bucket_name=bucket_name,
        object_key=object_key,
        file_data=file_content,
        content_type=file.content_type or "application/octet-stream"
    )
    
    # 處理上傳結果
    return {
        "file_id": file_id,
        "original_name": file.filename,
        "bucket": result["bucket"],
        "key": result["key"],
        "size": len(file_content),
        "content_type": file.content_type
    }
```

### 1.2 下載檔案

```python
@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """下載檔案"""
    
    bucket_name = f"user-{current_user.user_uuid}"
    object_key = f"{file_id}.pdf"
    
    try:
        # 獲取預簽名下載 URL
        download_url = await minio_client.get_presigned_download_url(
            bucket_name=bucket_name,
            object_key=object_key,
            expires_in=900  # 15分鐘
        )
        
        return {"download_url": download_url}
    except HTTPException as e:
        # 重新拋出 HTTP 異常
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"下載檔案時發生錯誤: {str(e)}"
        )
```

### 1.3 刪除檔案

```python
@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """刪除檔案"""
    
    bucket_name = f"user-{current_user.user_uuid}"
    object_key = f"{file_id}.pdf"
    
    try:
        # 刪除物件
        success = await minio_client.delete_object(
            bucket_name=bucket_name,
            object_key=object_key
        )
        
        if success:
            return {"status": "success", "message": "檔案已成功刪除"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="刪除檔案失敗"
            )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"刪除檔案時發生錯誤: {str(e)}"
        )
```

## 2. 分片上傳實現

### 2.1 初始化分片上傳

```python
from fastapi import APIRouter, Depends, Body, HTTPException, status
from pydantic import BaseModel
from uuid import uuid4

from app.core.deps import get_minio_client, get_current_user
from app.services.storage_client import MinIOClient
from app.models.user import User

router = APIRouter()

class InitUploadRequest(BaseModel):
    """初始化上傳請求模型"""
    file_name: str
    file_size: int
    content_type: str = "application/octet-stream"
    chunk_count: int

@router.post("/files/multipart/init")
async def init_multipart_upload(
    request: InitUploadRequest,
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """初始化分片上傳"""
    
    # 生成唯一檔案 ID
    file_id = str(uuid4())
    bucket_name = f"user-{current_user.user_uuid}"
    object_key = f"{file_id}.pdf"
    
    # 初始化分片上傳
    result = await minio_client.init_multipart_upload(
        bucket_name=bucket_name,
        object_key=object_key,
        file_id=file_id,
        file_name=request.file_name,
        total_size=request.file_size,
        chunk_total=request.chunk_count,
        content_type=request.content_type
    )
    
    return {
        "file_id": file_id,
        "upload_id": result["upload_id"],
        "bucket": result["bucket_name"],
        "key": result["object_key"]
    }
```

### 2.2 上傳分片

```python
@router.post("/files/multipart/{file_id}/{upload_id}/{part_number}")
async def upload_part(
    file_id: str,
    upload_id: str,
    part_number: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """上傳分片"""
    
    try:
        # 獲取上傳狀態
        status = await minio_client.get_upload_status(
            file_id=file_id,
            upload_id=upload_id
        )
        
        bucket_name = status["bucket"]
        object_key = status["key"]
        
        # 讀取分片內容
        chunk_data = await file.read()
        
        # 上傳分片
        result = await minio_client.upload_part(
            bucket_name=bucket_name,
            object_key=object_key,
            upload_id=upload_id,
            part_number=part_number,
            file_id=file_id,
            body=chunk_data
        )
        
        return {
            "part_number": result["part_number"],
            "etag": result["etag"],
            "progress": result["progress"]
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上傳分片時發生錯誤: {str(e)}"
        )
```

### 2.3 完成分片上傳

```python
@router.post("/files/multipart/{file_id}/{upload_id}/complete")
async def complete_multipart_upload(
    file_id: str,
    upload_id: str,
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """完成分片上傳"""
    
    try:
        # 完成分片上傳
        result = await minio_client.complete_multipart_upload(
            file_id=file_id,
            upload_id=upload_id
        )
        
        # 此處可以添加檔案記錄到資料庫的邏輯
        
        return {
            "file_id": file_id,
            "bucket": result["bucket"],
            "key": result["key"],
            "etag": result["etag"],
            "size": result["size"],
            "file_name": result["file_name"]
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"完成分片上傳時發生錯誤: {str(e)}"
        )
```

### 2.4 取消分片上傳

```python
@router.delete("/files/multipart/{file_id}/{upload_id}")
async def abort_multipart_upload(
    file_id: str,
    upload_id: str,
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """取消分片上傳"""
    
    try:
        # 中止分片上傳
        success = await minio_client.abort_multipart_upload(
            file_id=file_id,
            upload_id=upload_id
        )
        
        if success:
            return {"status": "success", "message": "分片上傳已取消"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="取消分片上傳失敗"
            )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"取消分片上傳時發生錯誤: {str(e)}"
        )
```

### 2.5 獲取上傳狀態 (用於斷點續傳)

```python
@router.get("/files/multipart/{file_id}/{upload_id}/status")
async def get_upload_status(
    file_id: str,
    upload_id: str,
    current_user: User = Depends(get_current_user),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    """獲取上傳狀態"""
    
    try:
        # 獲取上傳狀態
        status = await minio_client.get_upload_status(
            file_id=file_id,
            upload_id=upload_id
        )
        
        return status
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取上傳狀態時發生錯誤: {str(e)}"
        )
```

## 3. 後台清理任務實現

### 3.1 定期清理過期上傳

```python
# app/tasks/cleanup_tasks.py
from celery import shared_task
import logging
import redis.asyncio as redis
import asyncio

from app.core.deps import get_redis
from app.services.storage_client import MinIOClient

logger = logging.getLogger(__name__)

@shared_task(name="cleanup_expired_uploads")
def cleanup_expired_uploads():
    """清理過期的分片上傳"""
    
    logger.info("開始清理過期的分片上傳...")
    
    # 創建事件循環
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # 執行非同步清理任務
    cleaned_count = loop.run_until_complete(_do_cleanup())
    
    logger.info(f"清理完成，共清理 {cleaned_count} 個過期的分片上傳")
    return cleaned_count

async def _do_cleanup():
    """執行實際的清理工作"""
    
    # 獲取 Redis 客戶端
    redis_client = get_redis()
    
    # 創建 MinIO 客戶端
    minio_client = MinIOClient(redis_client=redis_client)
    
    # 清理過期上傳 (1天前)
    cleaned_count = await minio_client.clean_expired_uploads(older_than_days=1)
    
    return cleaned_count
```

### 3.2 在 Celery Beat 排程中註冊任務

```python
# app/core/celery_app.py
from celery import Celery
from celery.schedules import crontab

celery_app = Celery("app")

# 配置 Celery
celery_app.conf.broker_url = "redis://redis:6379/0"
celery_app.conf.result_backend = "redis://redis:6379/0"

# 配置任務
celery_app.conf.task_routes = {
    "app.tasks.cleanup_tasks.cleanup_expired_uploads": "cleanup",
}

# 配置定期任務
celery_app.conf.beat_schedule = {
    "cleanup-expired-uploads": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_uploads",
        "schedule": crontab(hour="1", minute="0"),  # 每天凌晨1點執行
        "options": {
            "queue": "cleanup",
        },
    },
}
```

## 4. 前端上傳組件整合範例

以下是一個使用 React 和 Axios 實現的前端分片上傳組件，可與後端 API 無縫整合：

```typescript
// src/components/FileUploader.tsx
import React, { useState, useCallback } from 'react';
import axios from 'axios';

interface ChunkInfo {
  start: number;
  end: number;
  index: number;
  blob: Blob;
  uploaded: boolean;
}

const FileUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [fileId, setFileId] = useState<string>('');
  const [uploadId, setUploadId] = useState<string>('');
  
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadProgress(0);
      setUploadStatus('準備上傳');
    }
  };
  
  const createChunks = (file: File): ChunkInfo[] => {
    const chunks: ChunkInfo[] = [];
    const chunkCount = Math.ceil(file.size / CHUNK_SIZE);
    
    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      
      chunks.push({
        start,
        end,
        index: i + 1, // 分片編號從 1 開始
        blob: file.slice(start, end),
        uploaded: false,
      });
    }
    
    return chunks;
  };
  
  const initUpload = async (file: File, chunks: ChunkInfo[]) => {
    try {
      const response = await axios.post('/api/files/multipart/init', {
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        chunk_count: chunks.length,
      });
      
      setFileId(response.data.file_id);
      setUploadId(response.data.upload_id);
      setUploadStatus('初始化完成，開始上傳分片');
      
      return {
        fileId: response.data.file_id,
        uploadId: response.data.upload_id,
      };
    } catch (error) {
      console.error('初始化上傳失敗:', error);
      setUploadStatus('初始化上傳失敗');
      throw error;
    }
  };
  
  const uploadChunk = async (chunk: ChunkInfo, fileId: string, uploadId: string) => {
    const formData = new FormData();
    formData.append('file', chunk.blob);
    
    try {
      const response = await axios.post(
        `/api/files/multipart/${fileId}/${uploadId}/${chunk.index}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      chunk.uploaded = true;
      return response.data;
    } catch (error) {
      console.error(`上傳分片 ${chunk.index} 失敗:`, error);
      throw error;
    }
  };
  
  const completeUpload = async (fileId: string, uploadId: string) => {
    try {
      const response = await axios.post(
        `/api/files/multipart/${fileId}/${uploadId}/complete`
      );
      
      setUploadStatus('上傳完成');
      return response.data;
    } catch (error) {
      console.error('完成上傳失敗:', error);
      setUploadStatus('完成上傳失敗');
      throw error;
    }
  };
  
  const uploadFile = async () => {
    if (!file) return;
    
    setUploadStatus('準備上傳...');
    
    try {
      // 創建分片
      const chunks = createChunks(file);
      
      // 初始化上傳
      const { fileId, uploadId } = await initUpload(file, chunks);
      
      // 檢查已上傳的分片
      try {
        const statusResponse = await axios.get(
          `/api/files/multipart/${fileId}/${uploadId}/status`
        );
        
        const uploadedParts = statusResponse.data.uploaded_parts;
        for (const part of uploadedParts) {
          const chunkIndex = part.part_number - 1;
          if (chunkIndex >= 0 && chunkIndex < chunks.length) {
            chunks[chunkIndex].uploaded = true;
          }
        }
      } catch (error) {
        console.warn('獲取上傳狀態失敗，將上傳所有分片:', error);
      }
      
      // 上傳分片
      let uploadedCount = chunks.filter(chunk => chunk.uploaded).length;
      setUploadProgress((uploadedCount / chunks.length) * 100);
      
      for (const chunk of chunks) {
        if (!chunk.uploaded) {
          setUploadStatus(`正在上傳分片 ${chunk.index}/${chunks.length}`);
          await uploadChunk(chunk, fileId, uploadId);
          uploadedCount++;
          setUploadProgress((uploadedCount / chunks.length) * 100);
        }
      }
      
      // 完成上傳
      setUploadStatus('正在完成上傳...');
      const result = await completeUpload(fileId, uploadId);
      
      setUploadStatus('上傳成功!');
      console.log('上傳結果:', result);
    } catch (error) {
      console.error('上傳過程中發生錯誤:', error);
      setUploadStatus('上傳失敗');
    }
  };
  
  return (
    <div className="file-uploader">
      <h2>檔案上傳</h2>
      <input type="file" onChange={handleFileChange} />
      <div>
        {file && (
          <>
            <p>選擇的檔案: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
            <button onClick={uploadFile}>開始上傳</button>
          </>
        )}
      </div>
      {uploadStatus && <p>狀態: {uploadStatus}</p>}
      {uploadProgress > 0 && (
        <div className="progress-bar">
          <div 
            className="progress" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
          <span>{uploadProgress.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
```

## 5. 單元測試範例

以下是對 MinIO 儲存服務的單元測試範例：

```python
# tests/services/test_storage_client.py
import pytest
import asyncio
from unittest.mock import MagicMock, patch
import io
import json

from app.services.storage_client import MinIOClient, ChunkMetadata, UploadPartInfo
from fastapi import HTTPException

# 配置測試
@pytest.fixture
def mock_redis_client():
    """模擬 Redis 客戶端"""
    mock = MagicMock()
    
    async def mock_get(key):
        if key == "upload:file-123:upload-123":
            metadata = ChunkMetadata(
                upload_id="upload-123",
                file_id="file-123",
                file_name="test.pdf",
                chunk_number=2,
                chunk_total=3,
                chunk_size=1024,
                total_size=3072,
                bucket_name="user-123",
                object_key="file-123.pdf",
                uploaded_parts=[
                    UploadPartInfo(part_number=1, etag="etag1", size=1024),
                    UploadPartInfo(part_number=2, etag="etag2", size=1024)
                ]
            )
            return metadata.json()
        return None
    
    mock.get = mock_get
    mock.set = AsyncMock()
    mock.delete = AsyncMock()
    mock.scan = AsyncMock(return_value=(0, []))
    mock.ttl = AsyncMock(return_value=10000)
    
    return mock

@pytest.fixture
def mock_s3_client():
    """模擬 S3 客戶端"""
    mock = MagicMock()
    
    # 模擬 head_bucket
    mock.head_bucket = MagicMock()
    
    # 模擬 put_object
    mock.put_object = MagicMock(return_value={"ETag": "\"test-etag\""})
    
    # 模擬 get_object
    mock_response = MagicMock()
    mock_response.__getitem__.return_value = MagicMock()
    mock_response["Body"].read.return_value = b"test content"
    mock.get_object = MagicMock(return_value=mock_response)
    
    # 模擬分片上傳
    mock.create_multipart_upload = MagicMock(return_value={"UploadId": "upload-123"})
    mock.upload_part = MagicMock(return_value={"ETag": "\"part-etag\""})
    mock.complete_multipart_upload = MagicMock(return_value={"ETag": "\"final-etag\""})
    
    return mock

@pytest.fixture
def minio_client(mock_redis_client, mock_s3_client):
    """創建 MinIOClient 實例用於測試"""
    with patch('boto3.client') as mock_boto3:
        mock_boto3.return_value = mock_s3_client
        client = MinIOClient(redis_client=mock_redis_client)
        client.s3_client = mock_s3_client
        return client

# 協助測試的類
class AsyncMock(MagicMock):
    async def __call__(self, *args, **kwargs):
        return super(AsyncMock, self).__call__(*args, **kwargs)

# 測試用例
@pytest.mark.asyncio
async def test_create_bucket_if_not_exists_success(minio_client, mock_s3_client):
    """測試創建儲存桶成功"""
    result = await minio_client.create_bucket_if_not_exists("test-bucket")
    assert result is True
    mock_s3_client.head_bucket.assert_called_once_with(Bucket="test-bucket")

@pytest.mark.asyncio
async def test_create_bucket_if_not_exists_not_found(minio_client, mock_s3_client):
    """測試儲存桶不存在時創建"""
    # 設置 head_bucket 抛出異常
    from botocore.exceptions import ClientError
    mock_s3_client.head_bucket.side_effect = ClientError(
        {"Error": {"Code": "404"}},
        "HeadBucket"
    )
    
    result = await minio_client.create_bucket_if_not_exists("test-bucket")
    assert result is True
    mock_s3_client.make_bucket.assert_called_once()

@pytest.mark.asyncio
async def test_upload_object(minio_client, mock_s3_client):
    """測試上傳物件"""
    test_data = b"test content"
    result = await minio_client.upload_object(
        bucket_name="test-bucket",
        object_key="test-key",
        file_data=test_data
    )
    
    assert result["bucket"] == "test-bucket"
    assert result["key"] == "test-key"
    assert "etag" in result
    
    mock_s3_client.put_object.assert_called_once_with(
        Bucket="test-bucket",
        Key="test-key",
        Body=test_data,
        ContentType="application/octet-stream"
    )

@pytest.mark.asyncio
async def test_download_object(minio_client, mock_s3_client):
    """測試下載物件"""
    content = await minio_client.download_object(
        bucket_name="test-bucket",
        object_key="test-key"
    )
    
    assert content == b"test content"
    mock_s3_client.get_object.assert_called_once_with(
        Bucket="test-bucket",
        Key="test-key"
    )

@pytest.mark.asyncio
async def test_init_multipart_upload(minio_client, mock_s3_client, mock_redis_client):
    """測試初始化分片上傳"""
    result = await minio_client.init_multipart_upload(
        bucket_name="test-bucket",
        object_key="test-key",
        file_id="file-123",
        file_name="test.pdf",
        total_size=1024,
        chunk_total=2
    )
    
    assert result["upload_id"] == "upload-123"
    assert result["bucket_name"] == "test-bucket"
    assert result["object_key"] == "test-key"
    
    mock_s3_client.create_multipart_upload.assert_called_once()
    mock_redis_client.set.assert_called_once()

@pytest.mark.asyncio
async def test_complete_multipart_upload(minio_client, mock_s3_client, mock_redis_client):
    """測試完成分片上傳"""
    result = await minio_client.complete_multipart_upload(
        file_id="file-123",
        upload_id="upload-123"
    )
    
    assert result["bucket"] == "user-123"
    assert result["key"] == "file-123.pdf"
    assert "etag" in result
    
    mock_s3_client.complete_multipart_upload.assert_called_once()
    mock_redis_client.delete.assert_called_once_with("upload:file-123:upload-123")

@pytest.mark.asyncio
async def test_upload_part(minio_client, mock_s3_client, mock_redis_client):
    """測試上傳分片"""
    test_data = b"chunk data"
    result = await minio_client.upload_part(
        bucket_name="user-123",
        object_key="file-123.pdf",
        upload_id="upload-123",
        part_number=3,
        file_id="file-123",
        body=test_data
    )
    
    assert result["part_number"] == 3
    assert "etag" in result
    assert result["progress"]["completed"] == 3
    assert result["progress"]["total"] == 3
    assert result["progress"]["percentage"] == 100.0
    
    mock_s3_client.upload_part.assert_called_once()
    mock_redis_client.set.assert_called_once()
```

這些範例涵蓋了 MinIO 儲存服務的主要使用場景，並展示了如何將其整合到應用程序的各個部分。