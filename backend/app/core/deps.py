"""
依賴注入模組
提供 FastAPI 依賴項函數
"""
from typing import Annotated, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import redis.asyncio as redis

from app.core.config import settings
from app.services.storage_client import MinIOClient

# Redis 客戶端
_redis_client = None

def get_redis() -> redis.Redis:
    """
    獲取 Redis 客戶端
    
    Returns:
        redis.Redis: Redis 客戶端實例
    """
    global _redis_client
    
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
    
    return _redis_client

async def get_minio_client() -> MinIOClient:
    """
    獲取 MinIO 客戶端
    
    Returns:
        MinIOClient: MinIO 客戶端實例
    """
    redis_client = get_redis()
    return MinIOClient(redis_client=redis_client) 