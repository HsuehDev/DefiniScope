"""
資料庫連接管理
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# 建立非同步引擎
engine = create_async_engine(
    str(settings.DATABASE_URL).replace("postgresql://", "postgresql+asyncpg://"),
    echo=False,
    future=True,
    pool_size=settings.MAX_WORKERS,
    max_overflow=settings.MAX_WORKERS * 2,
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