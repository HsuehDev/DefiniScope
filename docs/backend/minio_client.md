# MinIO 客戶端和連接池文檔

本文檔詳細介紹了 AI 文件分析與互動平台中使用的 MinIO 客戶端及其連接池實現。

## 目錄
1. [概述](#概述)
2. [連接池設計](#連接池設計)
3. [客戶端管理器](#客戶端管理器)
4. [主要功能與 API](#主要功能與-api)
5. [錯誤處理機制](#錯誤處理機制)
6. [使用示例](#使用示例)

## 概述

MinIO 是一個高性能的對象存儲系統，在本平台中用於存儲用戶上傳的文件、處理結果以及系統生成的各類資源。為了優化性能並提供更強大的功能，我們實現了以下組件：

1. **MinIO 連接池 (MinioConnectionPool)**：管理和重用 MinIO 客戶端連接，減少連接創建開銷
2. **MinIO 客戶端管理器 (MinioClientManager)**：提供豐富的 API 接口，封裝 MinIO 操作並增強錯誤處理

## 連接池設計

### 單例模式

連接池採用單例模式，確保整個應用只有一個連接池實例：

```python
class MinioConnectionPool:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MinioConnectionPool, cls).__new__(cls)
            cls._initialize_pool()
        return cls._instance
```

### 連接管理

連接池管理固定數量的客戶端連接，通過背景執行緒池來控制資源使用：

```python
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
```

### 客戶端獲取與歸還

連接池實現了客戶端的獲取與自動歸還機制：

```python
@classmethod
def get_client(cls) -> Minio:
    """獲取一個 Minio 客戶端實例"""
    if cls._instance is None:
        cls._instance = MinioConnectionPool()
    
    # 從列表中取出一個客戶端
    client = cls._clients.pop()
    
    # 用完後自動放回客戶端列表
    def return_client(client):
        cls._clients.append(client)
        return True
    
    # 為使用後返回客戶端註冊回調
    cls._pool.submit(lambda: return_client(client))
    
    return client
```

## 客戶端管理器

客戶端管理器封裝了 MinIO 的所有操作，並提供了豐富的功能擴展。

### 初始化

```python
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
```

### 錯誤處理機制

管理器實現了統一的錯誤處理機制，將各種 MinIO 錯誤轉換為 HTTP 異常：

```python
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
        # 處理不同類型的S3錯誤
        if error.code == "NoSuchBucket":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"存儲桶不存在: {error_message}"
            )
        # ... 其他錯誤類型 ...
```

## 主要功能與 API

### 基本存儲桶操作

```python
async def ensure_bucket_exists(self, bucket_name: str) -> bool:
    """確保存儲桶存在，不存在則創建"""
    
async def get_bucket_versioning(self, bucket_name: str) -> Dict:
    """獲取存儲桶的版本控制狀態"""
    
async def set_bucket_versioning(self, bucket_name: str, enabled: bool) -> bool:
    """設置存儲桶的版本控制狀態"""
```

### 文件上傳與下載

```python
async def upload_file(self, bucket_name: str, object_name: str, file_path: str, ...) -> str:
    """上傳文件到 MinIO"""
    
async def upload_large_file(self, bucket_name: str, object_name: str, file_path: str, ...) -> str:
    """分片上傳大文件到 MinIO"""
    
async def upload_bytes(self, bucket_name: str, object_name: str, data: bytes, ...) -> str:
    """上傳二進制數據到 MinIO"""
    
async def download_file(self, bucket_name: str, object_name: str, file_path: str) -> str:
    """從 MinIO 下載文件"""
    
async def download_bytes(self, bucket_name: str, object_name: str) -> bytes:
    """從 MinIO 下載二進制數據"""
```

### 預簽名 URL

```python
async def get_presigned_url(self, bucket_name: str, object_name: str, ...) -> str:
    """獲取對象的預簽名 URL（用於下載）"""
    
async def get_upload_presigned_url(self, bucket_name: str, object_name: str, ...) -> str:
    """獲取上傳對象的預簽名 URL"""
```

### 對象管理

```python
async def list_objects(self, bucket_name: str, prefix: Optional[str] = None, ...) -> List[Dict]:
    """列出存儲桶中的對象"""
    
async def get_object_stat(self, bucket_name: str, object_name: str) -> Dict:
    """獲取對象的統計信息"""
    
async def delete_object(self, bucket_name: str, object_name: str) -> bool:
    """刪除對象"""
    
async def delete_objects(self, bucket_name: str, object_names: List[str]) -> bool:
    """批量刪除對象"""
    
async def copy_object(self, source_bucket: str, source_object: str, ...) -> str:
    """複製對象"""
    
async def compose_objects(self, bucket_name: str, sources: List[Dict[str, str]], ...) -> str:
    """合成多個對象為一個新對象"""
```

### 進階功能

```python
async def select_object_content(self, bucket_name: str, object_name: str, ...) -> bytes:
    """使用 SQL 查詢對象內容"""
    
async def get_object_tags(self, bucket_name: str, object_name: str) -> Dict:
    """獲取對象的標籤"""
    
async def set_object_tags(self, bucket_name: str, object_name: str, tags: Dict) -> bool:
    """設置對象的標籤"""
```

## 錯誤處理機制

客戶端管理器對所有 MinIO 操作實現了統一的錯誤處理：

1. **自動轉換**：將 MinIO 錯誤轉換為適當的 HTTP 異常
2. **錯誤分類**：根據錯誤類型返回不同的狀態碼
   - 404 - 對象或桶不存在
   - 403 - 權限不足
   - 409 - 資源衝突
   - 502 - 無效響應
   - 503 - 服務不可用
   - 500 - 其他錯誤
3. **詳細日誌**：記錄操作失敗的詳細原因，便於排查問題

## 使用示例

### 上傳文件

```python
async def upload_document(file_path: str, user_id: str) -> str:
    # 獲取 MinIO 客戶端單例
    minio_client = MinioClientManager()
    
    # 生成對象名稱
    object_name = f"{user_id}/{uuid.uuid4()}-{os.path.basename(file_path)}"
    
    # 上傳文件
    await minio_client.upload_file(
        bucket_name=settings.DEFAULT_BUCKET_DOCUMENTS,
        object_name=object_name,
        file_path=file_path,
        content_type="application/pdf"
    )
    
    # 獲取預簽名 URL
    url = await minio_client.get_presigned_url(
        bucket_name=settings.DEFAULT_BUCKET_DOCUMENTS,
        object_name=object_name,
        expires=timedelta(hours=1)
    )
    
    return url
```

### 列出用戶文件

```python
async def list_user_files(user_id: str) -> List[Dict]:
    # 獲取 MinIO 客戶端單例
    minio_client = MinioClientManager()
    
    # 列出用戶的所有文件
    objects = await minio_client.list_objects(
        bucket_name=settings.DEFAULT_BUCKET_DOCUMENTS,
        prefix=f"{user_id}/"
    )
    
    # 為每個對象生成預簽名 URL
    result = []
    for obj in objects:
        url = await minio_client.get_presigned_url(
            bucket_name=settings.DEFAULT_BUCKET_DOCUMENTS,
            object_name=obj["name"],
            expires=timedelta(minutes=30)
        )
        result.append({
            "name": os.path.basename(obj["name"]),
            "size": obj["size"],
            "last_modified": obj["last_modified"],
            "url": url
        })
    
    return result
```

### 分片上傳大文件

```python
async def upload_large_video(file_path: str, user_id: str) -> str:
    # 獲取 MinIO 客戶端單例
    minio_client = MinioClientManager()
    
    # 生成對象名稱
    object_name = f"{user_id}/videos/{uuid.uuid4()}-{os.path.basename(file_path)}"
    
    # 使用分片上傳大文件
    await minio_client.upload_large_file(
        bucket_name=settings.DEFAULT_BUCKET_DOCUMENTS,
        object_name=object_name,
        file_path=file_path,
        content_type="video/mp4"
    )
    
    # 獲取預簽名 URL
    url = await minio_client.get_presigned_url(
        bucket_name=settings.DEFAULT_BUCKET_DOCUMENTS,
        object_name=object_name,
        expires=timedelta(days=1)
    )
    
    return url
``` 