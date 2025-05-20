"""
用戶服務模塊
提供用戶相關的業務邏輯
"""
from typing import Optional
from uuid import UUID
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


async def get_user_by_uuid(db: AsyncSession, user_uuid: str) -> Optional[User]:
    """
    根據UUID獲取用戶
    
    Args:
        db: 數據庫會話
        user_uuid: 用戶UUID
        
    Returns:
        查詢到的用戶，如果不存在則返回None
    """
    statement = select(User).where(User.user_uuid == user_uuid)
    results = await db.execute(statement)
    return results.first() 