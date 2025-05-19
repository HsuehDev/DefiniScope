"""
認證相關的API端點
包含註冊、登入、登出和令牌刷新功能
"""
import uuid
from datetime import datetime, timedelta
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import ValidationError

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegisterRequest, 
    UserRegisterResponse, 
    UserLoginRequest, 
    UserLoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse
)
from app.utils.security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    create_refresh_token, 
    get_current_user
)
from app.core.config import settings

router = APIRouter()


@router.post(
    "/register", 
    response_model=UserRegisterResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="用戶註冊",
    description="註冊新用戶，需提供有效的電子郵件和符合規則的密碼"
)
async def register(
    request: Request,
    user_data: UserRegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    註冊新用戶
    
    Args:
        request: 請求物件
        user_data: 用戶註冊資料，包含電子郵件和密碼
        db: 資料庫會話
        
    Returns:
        UserRegisterResponse: 包含用戶UUID、電子郵件和創建時間
        
    Raises:
        HTTPException: 如果電子郵件已存在或資料驗證失敗
    """
    # 檢查電子郵件是否已存在
    statement = select(User).where(User.email == user_data.email)
    results = await db.exec(statement)
    existing_user = results.first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="使用者已存在"
        )
    
    # 創建新用戶
    hashed_password = hash_password(user_data.password)
    
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        is_active=True
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # 在MinIO中為用戶創建專屬的bucket (通常會在後續實現)
    # TODO: 實現MinIO bucket創建
    
    return UserRegisterResponse(
        user_uuid=new_user.user_uuid,
        email=new_user.email,
        created_at=new_user.created_at
    )


@router.post(
    "/login", 
    response_model=UserLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="用戶登入",
    description="使用電子郵件和密碼登入系統，獲取訪問令牌"
)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    用戶登入
    
    Args:
        request: 請求物件
        form_data: OAuth2登入表單，包含username(電子郵件)和password
        db: 資料庫會話
        
    Returns:
        UserLoginResponse: 包含用戶UUID、訪問令牌、刷新令牌和令牌類型
        
    Raises:
        HTTPException: 如果認證失敗
    """
    # 查詢用戶
    statement = select(User).where(User.email == form_data.username)
    results = await db.exec(statement)
    user = results.first()
    
    # 驗證用戶和密碼
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號或密碼錯誤",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="帳號已被停用",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 更新最後登入時間
    user.last_login_at = datetime.utcnow()
    await db.commit()
    
    # 創建令牌
    access_token = create_access_token(subject=user.user_uuid)
    refresh_token = create_refresh_token(subject=user.user_uuid)
    
    return UserLoginResponse(
        user_uuid=user.user_uuid,
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="刷新令牌",
    description="使用有效的刷新令牌獲取新的訪問令牌"
)
async def refresh_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    刷新訪問令牌
    
    Args:
        request: 請求物件
        refresh_data: 包含刷新令牌的請求資料
        db: 資料庫會話
        
    Returns:
        RefreshTokenResponse: 包含新的訪問令牌和令牌類型
        
    Raises:
        HTTPException: 如果刷新令牌無效或已過期
    """
    try:
        # 解析刷新令牌
        payload = jwt.decode(
            refresh_data.refresh_token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 確保是刷新令牌
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的刷新令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 獲取用戶ID
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的令牌載荷",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 創建新的訪問令牌
        access_token = create_access_token(subject=user_id)
        
        return RefreshTokenResponse(
            access_token=access_token,
            token_type="bearer"
        )
    
    except (jwt.PyJWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效或過期的刷新令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="用戶登出",
    description="登出用戶並使當前的refresh_token失效"
)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    用戶登出
    
    Args:
        request: 請求物件
        current_user: 當前認證的用戶
        db: 資料庫會話
        
    Returns:
        dict: 包含成功訊息的字典
        
    Note:
        實際實現中可能需要將refresh token加入黑名單
        這通常使用Redis實現，此示例僅為簡化版本
    """
    # TODO: 將用戶的refresh token加入Redis黑名單
    
    return {"detail": "成功登出"} 