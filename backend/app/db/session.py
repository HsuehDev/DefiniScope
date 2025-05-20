"""
資料庫連接管理
"""
from typing import AsyncGenerator
import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# 建立非同步引擎
if os.getenv("TESTING") == "1":
    # 測試環境使用 SQLite
    engine = create_async_engine(
        str(settings.DATABASE_URI),
        echo=False,
        future=True,
    )
else:
    # 生產環境使用 PostgreSQL
    engine = create_async_engine(
        str(settings.DATABASE_URI).replace("postgresql://", "postgresql+asyncpg://"),
        echo=False,
        future=True,
        pool_size=5,
        max_overflow=10,
    )

# 建立非同步會話工廠
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    獲取資料庫會話的依賴項
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close() 