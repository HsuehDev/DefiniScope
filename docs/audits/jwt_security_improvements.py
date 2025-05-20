"""
JWT安全管理模組改進建議
針對審計中發現的問題提供改進實現
"""
import uuid
import logging
import threading
from datetime import datetime, timedelta
from typing import Optional, Any, Union, Dict
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import redis
import jwt
from fastapi import HTTPException, status

# 使用模擬配置
from docs.audits.mock_config import settings

logger = logging.getLogger(__name__)

# 全局變數
redis_client = None
redis_pool = None
redis_client_lock = threading.Lock()

# 添加指數退避重試裝飾器
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(redis.RedisError),
    reraise=True
)
def get_redis_client_with_retry():
    """
    獲取 Redis 客戶端，使用連接池優化性能
    包含指數退避重試機制，處理臨時連接問題

    Returns:
        redis.Redis: Redis 客戶端實例
    
    Raises:
        RuntimeError: 無法連接到 Redis 服務時引發
    """
    global redis_client, redis_pool
    
    # 如果已存在客戶端，先檢查連接是否有效
    if redis_client is not None:
        try:
            # 嘗試 ping 檢查連接是否有效
            redis_client.ping()
            return redis_client
        except redis.RedisError as e:
            logger.warning(f"現有 Redis 連接無效，將重新建立: {str(e)}")
            redis_client = None
            redis_pool = None
    
    # 使用鎖來確保線程安全
    if redis_client_lock:
        redis_client_lock.acquire()
    
    try:
        # 雙重檢查
        if redis_client is not None:
            try:
                redis_client.ping()
                return redis_client
            except redis.RedisError:
                redis_client = None
                redis_pool = None
        
        # 創建連接池
        redis_pool = redis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            socket_timeout=5.0,  # 設置超時避免長時間阻塞
            socket_connect_timeout=5.0,
            retry_on_timeout=True  # 超時時自動重試
        )
        
        # 創建客戶端
        redis_client = redis.Redis(connection_pool=redis_pool)
        
        # 測試連接
        redis_client.ping()
        
        logger.info(f"成功連接到 Redis 服務: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        return redis_client
    except Exception as e:
        logger.error(f"無法連接到 Redis 服務: {str(e)}")
        raise RuntimeError(f"無法連接到 Redis 服務: {str(e)}")
    finally:
        # 釋放鎖
        if redis_client_lock and redis_client_lock.locked():
            redis_client_lock.release()


def create_access_token_improved(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    生成 JWT 訪問令牌，改進版本
    
    Args:
        subject: 令牌主題 (通常是用戶 ID)
        expires_delta: 過期時間增量，可選
        
    Returns:
        JWT 訪問令牌字符串
        
    Raises:
        RuntimeError: 如果無法正確存儲 JTI 到 Redis
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # 創建 JTI (JWT ID)
    jti = str(uuid.uuid4())
    
    # 添加 JTI 到 Redis，如果失敗則拋出異常
    try:
        redis_client = get_redis_client_with_retry()
        redis_client.set(
            f"token_jti:{jti}", 
            "1", 
            nx=True, 
            ex=int(expires_delta.total_seconds() if expires_delta else settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        )
    except Exception as e:
        logger.error(f"無法將 JTI 添加到 Redis: {str(e)}")
        raise RuntimeError(f"無法創建有效令牌: {str(e)}")
    
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


def add_token_to_blacklist_improved(jti: str, expires_at: int) -> bool:
    """
    將令牌添加到黑名單，改進版本
    
    Args:
        jti: JWT ID
        expires_at: 過期時間戳 (Unix 時間戳)
        
    Returns:
        如果添加成功返回 True，否則返回 False
        
    Raises:
        ValueError: 如果提供的過期時間已經過期
    """
    try:
        # 計算過期時間 (從現在到令牌過期的秒數)
        now = int(datetime.utcnow().timestamp())
        ttl = expires_at - now
        
        # 檢查是否已過期
        if ttl <= 0:
            logger.warning(f"嘗試添加已過期的令牌到黑名單: jti={jti}, expires_at={expires_at}, now={now}")
            return False
        
        # 使用重試機制獲取 Redis 客戶端
        redis_client = get_redis_client_with_retry()
        
        # 添加到黑名單，設置同樣的過期時間
        result = redis_client.set(f"token_blacklist:{jti}", "1", nx=True, ex=ttl)
        
        # 記錄黑名單統計
        if result:
            # 增加計數器，用於監控
            redis_client.incr("stats:tokens_blacklisted")
            redis_client.sadd("monitoring:recent_blacklisted", jti)
            # 設置集合過期時間為 1 天
            redis_client.expire("monitoring:recent_blacklisted", 86400)
            
            logger.info(f"成功將令牌添加到黑名單: jti={jti}, ttl={ttl}秒")
        
        return bool(result)
    except Exception as e:
        logger.error(f"將令牌添加到黑名單時發生錯誤: {str(e)}")
        return False


async def decode_access_token_improved(token: str) -> Dict[str, Any]:
    """
    解碼 JWT 訪問令牌，改進版本
    
    Args:
        token: JWT 訪問令牌字符串
        
    Returns:
        令牌中的載荷（字典）
        
    Raises:
        HTTPException: 如果令牌無效、已過期或被撤銷
    """
    try:
        # 解碼令牌
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 確保是訪問令牌
        if payload.get("type") != "access":
            logger.warning(f"非訪問令牌被用於授權: type={payload.get('type')}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="不是有效的訪問令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 獲取 JTI
        jti = payload.get("jti")
        if not jti:
            logger.warning("令牌缺少 JTI")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌格式無效",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # 檢查令牌是否在黑名單中
        try:
            redis_client = get_redis_client_with_retry()
            if redis_client.exists(f"token_blacklist:{jti}"):
                logger.warning(f"已撤銷的令牌被用於授權: jti={jti}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="令牌已被撤銷",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
            # 驗證 JTI 是否有效
            if not redis_client.exists(f"token_jti:{jti}"):
                logger.warning(f"未知的 JTI 被用於授權: jti={jti}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="無效的令牌",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
            # 記錄令牌使用情況
            redis_client.incr("stats:token_usages")
            
        except redis.RedisError as e:
            # Redis 錯誤時記錄但不阻止請求
            logger.error(f"驗證令牌時 Redis 錯誤: {str(e)}")
            
        return payload
        
    except jwt.ExpiredSignatureError as e:
        # 記錄過期令牌使用情況
        logger.warning(f"過期令牌被用於授權: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌已過期",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        # 詳細記錄其他 JWT 錯誤
        logger.error(f"JWT 解碼錯誤: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"令牌無效: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) 