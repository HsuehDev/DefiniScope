"""
資料庫初始化
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.core.config import settings
from app.models.user import User
from app.utils.security import hash_password

logger = logging.getLogger(__name__)


async def init_db(db: AsyncSession) -> None:
    """
    初始化數據庫，創建必要的初始數據
    
    Args:
        db: 數據庫會話
    """
    logger.info("數據庫初始化完成")


async def create_default_admin(db: AsyncSession) -> None:
    """
    創建默認管理員用戶（如果不存在）
    
    Args:
        db: 數據庫會話
    """
    # 檢查默認管理員是否已存在
    result = await db.execute(
        "SELECT 1 FROM users WHERE email = :email",
        {"email": settings.DEFAULT_ADMIN_EMAIL}
    )
    admin_exists = result.scalar_one_or_none() is not None

    if not admin_exists:
        # 創建默認管理員
        hashed_password = hash_password(settings.DEFAULT_ADMIN_PASSWORD)
        
        # 使用原生SQL插入
        await db.execute(
            """
            INSERT INTO users (email, password_hash, is_active, is_admin)
            VALUES (:email, :password_hash, TRUE, TRUE)
            """,
            {
                "email": settings.DEFAULT_ADMIN_EMAIL,
                "password_hash": hashed_password
            }
        )
        
        await db.commit()
        logger.info(f"已創建默認管理員用戶: {settings.DEFAULT_ADMIN_EMAIL}")
    else:
        logger.info("默認管理員用戶已存在，跳過創建")


async def create_initial_data(db: AsyncSession) -> None:
    """
    創建初始數據
    """
    # 檢查是否已有初始數據
    try:
        # 如果沒有初始數據，這裡可以插入必要的初始記錄
        # 例如：建立管理員用戶、預設角色等
        pass
    except Exception as e:
        logger.error(f"創建初始數據錯誤: {str(e)}")
        raise 