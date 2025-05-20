# AI文件分析與互動平台 - 核心業務邏輯驗證報告

## 一、JWT安全管理模組分析

### 1.1 功能完整性與PRD符合性分析

#### 符合PRD要求的部分
- JWT令牌生成與驗證功能完整，支援access_token和refresh_token
- 已實現合適的過期時間設置（access_token 30分鐘，refresh_token 7天）
- 使用JTI（JWT ID）確保令牌唯一性
- 使用Redis實現令牌黑名單功能
- 實現了登入嘗試次數限制功能（5次失敗後鎖定15分鐘）
- 所有令牌都含有必要資訊（如過期時間、發行時間、類型）

#### 潛在問題與缺陷
1. **Redis連接失敗處理**：在`create_access_token`和`create_refresh_token`函數中，Redis連接失敗只是記錄錯誤但不影響令牌生成。這可能導致令牌有效性驗證問題，因為JTI未能成功存儲。

2. **異常捕獲過於寬泛**：多處使用`try-except Exception`捕獲所有異常，難以區分不同類型的錯誤。

3. **同步與非同步混用**：部分函數如`get_current_user`使用async，但內部呼叫的`is_token_blacklisted`和`verify_jti`是同步函數。

4. **令牌黑名單過期時間計算**：`add_token_to_blacklist`中計算TTL時未考慮時區問題，可能導致黑名單過早失效。

5. **缺乏單元測試覆蓋**：現有測試主要集中在基本功能，但缺少錯誤條件和邊界情況的測試。

### 1.2 修改建議

#### 1.2.1 改進Redis連接失敗處理
```python
def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # 創建 JTI (JWT ID)
    jti = str(uuid.uuid4())
    
    # 添加 JTI 到 Redis
    redis_success = False
    try:
        redis_client = get_redis_client()
        redis_success = redis_client.set(
            f"token_jti:{jti}", 
            "1", 
            nx=True, 
            ex=int(expires_delta.total_seconds() if expires_delta else settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        )
    except Exception as e:
        logger.error(f"無法將 JTI 添加到 Redis: {str(e)}")
    
    # 如果無法連接Redis，生成新的JTI並再次嘗試，或使用回退機制
    if not redis_success:
        logger.warning("使用本地JTI驗證回退機制")
        # 這裡可以實現本地JTI緩存作為備用
    
    to_encode = {
        "exp": expire,
        "iat": datetime.utcnow(),
        "sub": str(subject),
        "type": "access",
        "jti": jti
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        settings.JWT_ALGORITHM
    )
    
    return encoded_jwt
```

#### 1.2.2 改進令牌黑名單過期時間計算
```python
def add_token_to_blacklist(jti: str, expires_at: int) -> bool:
    try:
        redis_client = get_redis_client()
        
        # 計算過期時間 (從現在到令牌過期的秒數)
        now = int(datetime.utcnow().timestamp())
        ttl = max(expires_at - now, 0)
        
        # 添加到黑名單，設置同樣的過期時間，如果TTL過短，至少保存1分鐘
        if ttl < 60:
            logger.warning(f"Token TTL過短 ({ttl}秒)，將設置為最小值60秒")
            ttl = 60
            
        success = redis_client.set(f"token_blacklist:{jti}", "1", nx=True, ex=ttl)
        return success
    except Exception as e:
        logger.error(f"將令牌添加到黑名單時發生錯誤: {str(e)}")
        return False
```

#### 1.2.3 將同步函數轉為非同步
```python
async def verify_jti(jti: str) -> bool:
    """
    驗證 JTI 是否有效
    
    Args:
        jti: JWT ID
        
    Returns:
        如果 JTI 有效返回 True，否則返回 False
    """
    try:
        redis_client = get_redis_client()
        exists = redis_client.exists(f"token_jti:{jti}")
        return exists > 0
    except Exception as e:
        logger.error(f"驗證 JTI 時發生錯誤: {str(e)}")
        return False

async def is_token_blacklisted(jti: str) -> bool:
    """
    檢查令牌是否在黑名單中
    
    Args:
        jti: JWT ID
        
    Returns:
        如果令牌在黑名單中返回 True，否則返回 False
    """
    try:
        redis_client = get_redis_client()
        exists = redis_client.exists(f"token_blacklist:{jti}")
        return exists > 0
    except Exception as e:
        logger.error(f"檢查令牌黑名單時發生錯誤: {str(e)}")
        return False
```

## 二、MinIO客戶端分析

### 2.1 功能完整性與PRD符合性分析

#### 符合PRD要求的部分
- 實現了與MinIO對象存儲的完整交互功能
- 支持文件上傳（包括大文件分片上傳）、下載、刪除操作
- 提供預簽名URL生成功能，支持臨時訪問
- 實現連接池管理，優化性能
- 異常處理機制將MinIO錯誤轉換為適當的HTTP異常
- 支持桶管理、對象列表等進階功能

#### 潛在問題與缺陷
1. **連接池實現過於複雜**：`MinioConnectionPool`的實現使用自定義的線程管理，可能存在資源泄漏風險。

2. **缺少檔案上傳超時機制**：根據PRD要求，上傳應支持10分鐘的超時機制，但未在代碼中實現。

3. **大檔案上傳的進度通知不完整**：大檔案分片上傳時僅在日誌中記錄進度，未提供通過WebSocket實時通知的機制。

4. **錯誤處理中的不一致**：部分方法使用HTTP異常，部分方法返回None或False，處理方式不一致。

5. **預簽名URL過期時間設置**：預設過期時間是1小時，但PRD要求臨時URL有效期為15分鐘。

### 2.2 修改建議

#### 2.2.1 簡化連接池實現
```python
class MinioConnectionPool:
    """
    簡化的Minio連接池，使用內建的連接池機制
    """
    _instance = None
    _client = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(MinioConnectionPool, cls).__new__(cls)
                    cls._initialize_client()
        return cls._instance
    
    @classmethod
    def _initialize_client(cls):
        """初始化Minio客戶端"""
        cls._client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
    
    @classmethod
    def get_client(cls) -> Minio:
        """獲取Minio客戶端實例"""
        if cls._instance is None:
            cls._instance = MinioConnectionPool()
        
        return cls._client
```

#### 2.2.2 實現檔案上傳超時機制
```python
async def upload_file_with_timeout(
    self, 
    bucket_name: str, 
    object_name: str, 
    file_path: str,
    content_type: Optional[str] = None,
    metadata: Optional[dict] = None,
    timeout_minutes: int = 10
) -> str:
    """
    上傳文件到MinIO，帶超時機制
    
    Args:
        bucket_name: 存儲桶名稱
        object_name: 對象名稱
        file_path: 文件路徑
        content_type: 內容類型
        metadata: 元數據字典
        timeout_minutes: 上傳超時時間(分鐘)
            
    Returns:
        str: 對象名稱
            
    Raises:
        HTTPException: 如果上傳失敗或超時
    """
    # 記錄上傳開始時間
    start_time = time.time()
    
    # 更新元數據，添加上傳時間信息
    metadata = metadata or {}
    metadata["upload_started_at"] = str(int(start_time))
    
    try:
        # 使用並發執行上傳，設置超時
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        # 創建上傳任務
        with ThreadPoolExecutor() as executor:
            upload_task = asyncio.get_event_loop().run_in_executor(
                executor,
                lambda: self._upload_file_sync(bucket_name, object_name, file_path, content_type, metadata)
            )
            
            # 設置超時
            timeout_seconds = timeout_minutes * 60
            try:
                result = await asyncio.wait_for(upload_task, timeout=timeout_seconds)
                return result
            except asyncio.TimeoutError:
                # 上傳超時
                logger.error(f"上傳文件 {file_path} 到 {bucket_name}/{object_name} 超時 (超過 {timeout_minutes} 分鐘)")
                raise HTTPException(
                    status_code=status.HTTP_408_REQUEST_TIMEOUT,
                    detail=f"上傳超時：超過{timeout_minutes}分鐘未完成"
                )
    except HTTPException:
        raise
    except Exception as e:
        self._handle_minio_error(e, f"上傳文件 {file_path} 到 {bucket_name}/{object_name} 失敗")
    
    def _upload_file_sync(self, bucket_name, object_name, file_path, content_type, metadata):
        """同步上傳文件的內部方法"""
        # 實際的上傳邏輯
        # ...
```

#### 2.2.3 修正預簽名URL過期時間
```python
async def get_presigned_url(
    self, 
    bucket_name: str, 
    object_name: str, 
    expires: timedelta = timedelta(minutes=15),  # 修改為15分鐘
    response_headers: Optional[dict] = None
) -> str:
    """
    生成預簽名URL用於訪問對象
    
    Args:
        bucket_name: 存儲桶名稱
        object_name: 對象名稱
        expires: URL過期時間，默認15分鐘
        response_headers: 自定義響應頭
            
    Returns:
        str: 預簽名URL
            
    Raises:
        HTTPException: 如果操作失敗
    """
    try:
        url = self.client.presigned_get_object(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=int(expires.total_seconds()),
            response_headers=response_headers
        )
        
        logger.info(f"為對象 {bucket_name}/{object_name} 生成預簽名URL，有效期 {expires}")
        return url
    except Exception as e:
        self._handle_minio_error(e, f"為對象 {bucket_name}/{object_name} 生成預簽名URL失敗")
```

## 三、單元測試設計

以下提供使用 pytest 和 pytest-mock 對JWT安全管理模組和MinIO客戶端的單元測試案例。 