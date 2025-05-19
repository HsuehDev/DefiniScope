"""
資料庫初始化
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.core.config import settings

logger = logging.getLogger(__name__)


async def init_db(db: AsyncSession) -> None:
    """
    初始化資料庫
    """
    try:
        # 創建所有表格
        await db.run_sync(SQLModel.metadata.create_all, bind=db.get_bind())
        logger.info("已成功創建所有資料表")
        
        # 檢查是否需要創建初始數據
        await create_initial_data(db)
        
    except Exception as e:
        logger.error(f"資料庫初始化錯誤: {str(e)}")
        raise


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