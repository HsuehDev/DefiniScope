"""
安全相關的工具函數
包括密碼雜湊, JWT處理等
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, Any, Union

import jwt
import bcrypt
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


def hash_password(password: str) -> str:
    """
    使用bcrypt對密碼進行雜湊
    
    Args:
        password: 原始密碼
        
    Returns:
        雜湊後的密碼字串
    """
    # 生成鹽值並雜湊
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    驗證密碼
    
    Args:
        plain_password: 原始密碼
        hashed_password: 已雜湊的密碼
        
    Returns:
        驗證是否成功
    """
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def create_access_token(subject: Union[str, uuid.UUID], expires_delta: Optional[timedelta] = None) -> str:
    """
    建立JWT access token
    
    Args:
        subject: 令牌主體(通常是使用者ID)
        expires_delta: 過期時間增量(可選)
        
    Returns:
        JWT token字串
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4()),
        "type": "access"
    }
    
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: Union[str, uuid.UUID], expires_delta: Optional[timedelta] = None) -> str:
    """
    建立JWT refresh token
    
    Args:
        subject: 令牌主體(通常是使用者ID)
        expires_delta: 過期時間增量(可選)
        
    Returns:
        JWT token字串
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4()),
        "type": "refresh"
    }
    
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    從JWT token獲取當前用戶
    
    Args:
        token: JWT token
        db: 資料庫會話
        
    Returns:
        User: 用戶模型實例
        
    Raises:
        HTTPException: 如果token無效或用戶不存在
    """
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        
        # 檢查token類型
        if token_data.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 檢查是否過期
        if datetime.fromtimestamp(token_data.exp) < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token 已過期",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except (jwt.PyJWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="身份驗證失敗",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 從資料庫查詢用戶
    statement = select(User).where(User.user_uuid == token_data.sub)
    results = await db.exec(statement)
    user = results.first()
    
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