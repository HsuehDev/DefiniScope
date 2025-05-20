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
    """
    JWT Token載荷
    用於解碼和驗證JWT token
    """
    sub: str = Field(..., description="主題 (通常是用戶ID)")
    exp: int = Field(..., description="過期時間 (Unix 時間戳)")
    iat: int = Field(..., description="發行時間 (Unix 時間戳)")
    jti: str = Field(..., description="JWT ID, 用於唯一標識該token")
    type: str = Field(..., description="Token類型 (access 或 refresh)")


class Token(BaseModel):
    """
    Token響應模型
    用於向客戶端返回已生成的token
    """
    access_token: str = Field(..., description="訪問令牌")
    refresh_token: str = Field(..., description="刷新令牌")
    token_type: str = Field("bearer", description="令牌類型")


class LoginRequest(BaseModel):
    """
    登入請求模型
    """
    email: EmailStr = Field(..., description="用戶電子郵件")
    password: str = Field(..., description="用戶密碼", min_length=6)


class LogoutRequest(BaseModel):
    """
    登出請求模型
    """
    refresh_token: Optional[str] = Field(None, description="刷新令牌")


class RegisterRequest(BaseModel):
    """
    用戶註冊請求模型
    """
    email: EmailStr = Field(..., description="用戶電子郵件")
    password: str = Field(..., description="用戶密碼", min_length=6)
    full_name: str = Field(..., description="用戶全名")
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "strong_password",
                "full_name": "John Doe"
            }
        }


class PasswordChangeRequest(BaseModel):
    """
    密碼修改請求模型
    """
    current_password: str = Field(..., description="當前密碼")
    new_password: str = Field(..., description="新密碼", min_length=6)
    
    class Config:
        json_schema_extra = {
            "example": {
                "current_password": "old_password",
                "new_password": "new_strong_password"
            }
        }


class PasswordResetRequest(BaseModel):
    """
    密碼重置請求模型
    """
    email: EmailStr = Field(..., description="用戶電子郵件")
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }


class PasswordResetConfirmRequest(BaseModel):
    """
    密碼重置確認請求模型
    """
    token: str = Field(..., description="重置令牌")
    new_password: str = Field(..., description="新密碼", min_length=6)
    
    class Config:
        json_schema_extra = {
            "example": {
                "token": "reset_token_here",
                "new_password": "new_strong_password"
            }
        }


class ErrorResponse(BaseModel):
    """錯誤回應模式"""
    detail: str
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    path: Optional[str] = None
    request_id: Optional[UUID] = None 