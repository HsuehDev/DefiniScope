"""
驗證相關的Pydantic模式
"""
from datetime import datetime
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, validator


class UserRegisterRequest(BaseModel):
    """註冊請求模式"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def validate_password(cls, v):
        """驗證密碼強度: 至少8個字元，包含至少一個大寫字母和一個數字"""
        if len(v) < 8:
            raise ValueError("密碼長度至少為8個字元")
        if not any(c.isupper() for c in v):
            raise ValueError("密碼必須包含至少一個大寫字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密碼必須包含至少一個數字")
        return v


class UserRegisterResponse(BaseModel):
    """註冊成功回應模式"""
    user_uuid: UUID
    email: EmailStr
    created_at: datetime


class UserLoginRequest(BaseModel):
    """登入請求模式"""
    email: EmailStr
    password: str


class UserLoginResponse(BaseModel):
    """登入成功回應模式"""
    user_uuid: UUID
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """令牌刷新請求模式"""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """令牌刷新回應模式"""
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """JWT令牌載荷"""
    sub: UUID  # 主題(使用者UUID)
    exp: int  # 過期時間(UTC時間戳)
    iat: Optional[int] = None  # 簽發時間(UTC時間戳)
    jti: Optional[UUID] = None  # JWT ID (唯一標識)
    type: str  # 令牌類型 ("access" 或 "refresh")


class ErrorResponse(BaseModel):
    """錯誤回應模式"""
    detail: str
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    path: Optional[str] = None
    request_id: Optional[UUID] = None 