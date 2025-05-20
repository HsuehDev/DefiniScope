# MinIO 儲存服務模組

本文檔描述了系統中用於與 MinIO 物件儲存服務交互的封裝模組。該模組提供了一套統一的 API，用於檔案上傳、下載、分片上傳、預簽名 URL 生成等功能。

## 1. 概述

MinIOClient 類提供了與 MinIO 物件儲存服務交互的所有必要功能，根據 PRD III 中的設計要求實現。它支援：

- 基本的檔案上傳和下載
- 分片上傳和斷點續傳
- 儲存桶管理
- 預簽名 URL 生成
- 檔案刪除
- 過期上傳清理

## 2. 類結構

### 2.1 MinIOClient 類

```python
class MinIOClient:
    def __init__(self, redis_client: redis.Redis):
        # 初始化客戶端
        
    async def create_bucket_if_not_exists(self, bucket_name: str) -> bool:
        # 確保儲存桶存在
        
    async def upload_object(self, bucket_name: str, object_key: str, file_data: Union[BinaryIO, bytes], content_type: str = "application/octet-stream") -> Dict:
        # 上傳單個檔案
        
    async def download_object(self, bucket_name: str, object_key: str) -> bytes:
        # 下載檔案
        
    async def get_presigned_download_url(self, bucket_name: str, object_key: str, expires_in: int = 900) -> str:
        # 生成預簽名下載 URL
        
    async def delete_object(self, bucket_name: str, object_key: str) -> bool:
        # 刪除檔案
        
    async def init_multipart_upload(self, bucket_name: str, object_key: str, file_id: str, file_name: str, total_size: int, chunk_total: int, content_type: str = "application/octet-stream") -> Dict:
        # 初始化分片上傳
        
    async def upload_part(self, bucket_name: str, object_key: str, upload_id: str, part_number: int, file_id: str, body: Union[BinaryIO, bytes]) -> Dict:
        # 上傳單個分片
        
    async def complete_multipart_upload(self, file_id: str, upload_id: str) -> Dict:
        # 完成分片上傳
        
    async def abort_multipart_upload(self, file_id: str, upload_id: str) -> bool:
        # 中止分片上傳
        
    async def get_upload_status(self, file_id: str, upload_id: str) -> Dict:
        # 獲取上傳狀態
        
    async def list_objects(self, bucket_name: str, prefix: str = "", max_keys: int = 1000) -> List[Dict]:
        # 列出儲存桶中的物件
        
    async def clean_expired_uploads(self, older_than_days: int = 1) -> int:
        # 清理過期的未完成上傳
```

### 2.2 輔助模型

分片上傳使用了以下 Pydantic 模型來管理元數據：

```python
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
```

## 3. 使用方式

### 3.1 依賴注入

在 FastAPI 應用中，可以通過依賴注入來獲取 MinIOClient 實例：

```python
from fastapi import APIRouter, Depends, UploadFile, File
from app.core.deps import get_minio_client
from app.services.storage_client import MinIOClient

router = APIRouter()

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    minio_client: MinIOClient = Depends(get_minio_client)
):
    # 使用 minio_client 上傳檔案
    result = await minio_client.upload_object(
        bucket_name="my-bucket",
        object_key="my-file.pdf",
        file_data=await file.read(),
        content_type=file.content_type
    )
    return result
```

### 3.2 分片上傳流程

分片上傳的完整流程包括以下步驟：

1. **初始化上傳**
   ```python
   result = await minio_client.init_multipart_upload(
       bucket_name="my-bucket",
       object_key="my-file.pdf",
       file_id="unique-file-id",
       file_name="original-filename.pdf",
       total_size=file_size,
       chunk_total=10,
       content_type="application/pdf"
   )
   upload_id = result["upload_id"]
   ```

2. **上傳各個分片**
   ```python
   for part_number in range(1, chunk_total + 1):
       chunk_data = get_chunk_data(part_number)  # 獲取指定分片的數據
       result = await minio_client.upload_part(
           bucket_name="my-bucket",
           object_key="my-file.pdf",
           upload_id=upload_id,
           part_number=part_number,
           file_id="unique-file-id",
           body=chunk_data
       )
   ```

3. **完成上傳**
   ```python
   result = await minio_client.complete_multipart_upload(
       file_id="unique-file-id",
       upload_id=upload_id
   )
   ```

4. **中止上傳** (如果需要)
   ```python
   await minio_client.abort_multipart_upload(
       file_id="unique-file-id",
       upload_id=upload_id
   )
   ```

5. **獲取上傳狀態** (用於實現斷點續傳)
   ```python
   status = await minio_client.get_upload_status(
       file_id="unique-file-id",
       upload_id=upload_id
   )
   # 檢查哪些分片已經上傳，只上傳缺失的分片
   ```

## 4. 錯誤處理

該模組使用了裝飾器來統一處理 MinIO 操作中可能出現的各種異常：

```python
@handle_minio_exceptions
async def some_method(self):
    # 方法實現
```

裝飾器 `handle_minio_exceptions` 捕獲各種類型的 S3/MinIO 錯誤，並將其轉換為適當的 HTTP 異常，包括：

- 404 Not Found (當儲存桶或物件不存在時)
- 403 Forbidden (當存取被拒絕時)
- 500 Internal Server Error (其他未處理的錯誤)

## 5. 配置

MinIOClient 從環境變數讀取配置：

- `MINIO_URL`: MinIO 服務的 URL (預設: "http://minio:9000")
- `MINIO_ACCESS_KEY`: 存取金鑰
- `MINIO_SECRET_KEY`: 密鑰
- `MINIO_REGION`: 區域 (預設: "us-east-1")

## 6. 清理機制

對於分片上傳，系統實現了以下清理機制：

1. **Redis TTL**: 分片上傳的元數據在 Redis 中有 24 小時的 TTL
2. **顯式清理**: 成功完成或中止上傳時，立即從 Redis 中刪除元數據
3. **過期清理**: `clean_expired_uploads` 方法可以定期清理過期的未完成上傳

## 7. 性能與可靠性

- 所有操作都是非同步的，支援 FastAPI 的事件循環
- 使用 Redis 追蹤上傳狀態，確保可靠的斷點續傳
- 錯誤時提供詳細的日誌記錄，便於問題排查
- 對 MinIO 操作進行了封裝和重試，提高可靠性

## 8. 安全考量

- 使用預簽名 URL 提供臨時存取權限，預設有效期為 15 分鐘
- 從環境變數讀取敏感配置，而不是硬編碼
- 實現按用戶隔離的儲存桶策略 (user-{user_uuid})
- 對 Redis 中的元數據設置了合理的 TTL，防止資訊洩露 