"""
安全相關的工具函數
包括密碼雜湊, JWT處理等
"""
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Any, Union

import jwt
import bcrypt
import redis
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import ValidationError

from app.core.config import settings
from app.db.session import get_db
from app.schemas.auth import TokenPayload
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
logger = logging.getLogger(__name__)

# 初始化 Redis 客戶端 (單例)
redis_client = None
redis_pool = None
redis_client_lock = None

try:
    import threading
    redis_client_lock = threading.Lock()
except ImportError:
    # 在某些環境中可能沒有 threading 模組
    pass


def get_redis_client():
    """
    獲取 Redis 客戶端，使用連接池優化性能
    
    Returns:
        redis.Redis: Redis 客戶端實例
    
    Raises:
        RuntimeError: 無法連接到 Redis 服務時引發
    """
    global redis_client, redis_pool
    
    # 如果已存在客戶端，直接返回
    if redis_client is not None:
        return redis_client
    
    # 使用鎖來確保線程安全
    if redis_client_lock:
        redis_client_lock.acquire()
    
    try:
        # 雙重檢查
        if redis_client is not None:
            return redis_client
        
        # 創建連接池
        redis_pool = redis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            decode_responses=True
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


def hash_password(password: str) -> str:
    """
    對密碼進行雜湊處理
    
    Args:
        password: 原始密碼
        
    Returns:
        雜湊後的密碼 (UTF-8 編碼的字符串)
    """
    # 生成隨機鹽值並雜湊密碼
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    驗證密碼是否正確
    
    Args:
        plain_password: 原始密碼
        hashed_password: 已雜湊的密碼
        
    Returns:
        如果密碼正確返回 True，否則返回 False
    """
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    生成 JWT 訪問令牌
    
    Args:
        subject: 令牌主題 (通常是用戶 ID)
        expires_delta: 過期時間增量，可選
        
    Returns:
        JWT 訪問令牌字符串
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # 創建 JTI (JWT ID)
    jti = str(uuid.uuid4())
    
    # 添加 JTI 到 Redis
    try:
        redis_client = get_redis_client()
        redis_client.set(f"token_jti:{jti}", "1", nx=True, ex=int(expires_delta.total_seconds() if expires_delta else settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60))
    except Exception as e:
        logger.error(f"無法將 JTI 添加到 Redis: {str(e)}")
    
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


def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    生成 JWT 刷新令牌
    
    Args:
        subject: 令牌主題 (通常是用戶 ID)
        expires_delta: 過期時間增量，可選
        
    Returns:
        JWT 刷新令牌字符串
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )
    
    # 創建 JTI (JWT ID)
    jti = str(uuid.uuid4())
    
    # 添加 JTI 到 Redis
    try:
        redis_client = get_redis_client()
        redis_client.set(f"token_jti:{jti}", "1", nx=True, ex=int(expires_delta.total_seconds() if expires_delta else settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60))
    except Exception as e:
        logger.error(f"無法將 JTI 添加到 Redis: {str(e)}")
    
    to_encode = {
        "exp": expire,
        "iat": datetime.utcnow(),
        "sub": str(subject),
        "type": "refresh",
        "jti": jti
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def verify_jti(jti: str) -> bool:
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


def add_token_to_blacklist(jti: str, expires_at: int) -> bool:
    """
    將令牌添加到黑名單
    
    Args:
        jti: JWT ID
        expires_at: 過期時間戳 (Unix 時間戳)
        
    Returns:
        如果添加成功返回 True，否則返回 False
    """
    try:
        redis_client = get_redis_client()
        
        # 計算過期時間 (從現在到令牌過期的秒數)
        now = int(datetime.utcnow().timestamp())
        ttl = max(expires_at - now, 0)
        
        # 添加到黑名單，設置同樣的過期時間
        redis_client.set(f"token_blacklist:{jti}", "1", nx=True, ex=ttl)
        return True
    except Exception as e:
        logger.error(f"將令牌添加到黑名單時發生錯誤: {str(e)}")
        return False


def is_token_blacklisted(jti: str) -> bool:
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


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    獲取當前登入用戶
    
    Args:
        token: JWT 令牌
        db: 數據庫會話
        
    Returns:
        當前用戶對象
        
    Raises:
        HTTPException: 如果令牌無效、用戶不存在等錯誤
    """
    try:
        # 解碼令牌
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 解析令牌載荷
        token_data = TokenPayload(**payload)
        
        # 檢查令牌類型
        if token_data.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 檢查令牌是否在黑名單中
        if is_token_blacklisted(token_data.jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token 已被撤銷",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 驗證 JTI 是否有效
        if not verify_jti(token_data.jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的 Token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
    except jwt.PyJWTError as e:
        # JWT 解碼錯誤
        if isinstance(e, jwt.ExpiredSignatureError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token 已過期",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="身份驗證失敗",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValidationError:
        # Pydantic 驗證錯誤
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的 Token 格式",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 從數據庫獲取用戶
    user = (
        await db.exec(
            select(User).where(User.user_uuid == token_data.sub)
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="用戶不存在"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="用戶已被停用"
        )
    
    return user


async def check_login_attempts(email: str) -> None:
    """
    檢查登入嘗試次數，如果超過限制則阻止登入
    
    Args:
        email: 用戶郵箱
        
    Raises:
        HTTPException: 如果登入嘗試次數過多
    """
    try:
        redis_client = get_redis_client()
        attempts = redis_client.get(f"login_attempts:{email}")
        
        if attempts is None:
            return
        
        attempts = int(attempts)
        if attempts >= settings.MAX_LOGIN_ATTEMPTS:
            # 檢查是否還在鎖定期內
            ttl = redis_client.ttl(f"login_attempts:{email}")
            if ttl > 0:
                minutes = ttl // 60
                seconds = ttl % 60
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"登入嘗試次數過多，帳戶已被鎖定 {minutes} 分 {seconds} 秒"
                )
    except Exception as e:
        if not isinstance(e, HTTPException):
            logger.error(f"檢查登入嘗試次數時發生錯誤: {str(e)}")


async def increment_login_attempts(email: str) -> None:
    """
    增加登入嘗試次數
    
    Args:
        email: 用戶郵箱
    """
    try:
        redis_client = get_redis_client()
        attempts = redis_client.incr(f"login_attempts:{email}")
        
        if attempts == 1:
            # 第一次失敗，設置初始過期時間 (嘗試窗口期)
            redis_client.expire(f"login_attempts:{email}", settings.LOGIN_ATTEMPTS_WINDOW)
        elif attempts >= settings.MAX_LOGIN_ATTEMPTS:
            # 達到最大嘗試次數，延長過期時間 (帳戶鎖定時間)
            redis_client.expire(f"login_attempts:{email}", settings.ACCOUNT_LOCKOUT_TIME)
    except Exception as e:
        logger.error(f"增加登入嘗試次數時發生錯誤: {str(e)}")


async def reset_login_attempts(email: str) -> None:
    """
    重置登入嘗試次數
    
    Args:
        email: 用戶郵箱
    """
    try:
        redis_client = get_redis_client()
        redis_client.delete(f"login_attempts:{email}")
    except Exception as e:
        logger.error(f"重置登入嘗試次數時發生錯誤: {str(e)}") 