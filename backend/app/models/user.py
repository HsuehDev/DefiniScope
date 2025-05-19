"""
用戶資料庫模型
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from pydantic import EmailStr


class User(SQLModel, table=True):
    """
    使用者資料表模型
    """
    __tablename__ = "users"
    
    # 主鍵，使用UUID代替自增ID
    uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 用戶認證資訊
    email: EmailStr = Field(index=True, unique=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    
    # 用戶個人資訊
    full_name: Optional[str] = Field(default=None)
    
    # 狀態資訊
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_login: Optional[datetime] = Field(default=None)
    
    # 關聯與索引
    __table_args__ = {
        'comment': '使用者資料表'
    } 