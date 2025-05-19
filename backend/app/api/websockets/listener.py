"""Redis Pub/Sub listener for WebSocket updates"""

import asyncio
import json
from fastapi import FastAPI
import redis.asyncio as redis
from loguru import logger

from app.core.config import settings
from app.core.websocket_redis_adapter import adapter


async def start_redis_listeners():
    """啟動 Redis 訂閱者，監聽從 Celery 發來的更新"""
    r = redis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    
    # 訂閱所有檔案更新和查詢更新通道
    await pubsub.psubscribe("file_updates:*")
    await pubsub.psubscribe("query_updates:*")
    
    logger.info("Redis Pub/Sub 監聽器已啟動")
    
    # 持續監聽消息
    while True:
        try:
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                channel = message["channel"].decode("utf-8")
                data = json.loads(message["data"].decode("utf-8"))
                
                if channel.startswith("file_updates:"):
                    file_uuid = channel.split(":")[1]
                    event = data.pop("event", "unknown")
                    await adapter.handle_file_update(file_uuid, event, data)
                    
                elif channel.startswith("query_updates:"):
                    query_uuid = channel.split(":")[1]
                    event = data.pop("event", "unknown")
                    await adapter.handle_query_update(query_uuid, event, data)
                    
                logger.debug(f"已處理來自 {channel} 的消息: {event}")
        
        except Exception as e:
            logger.error(f"Redis 監聽器錯誤: {e}")
            await asyncio.sleep(1)  # 發生錯誤時短暫暫停
            
        await asyncio.sleep(0.01)  # 小暫停，避免 CPU 過度使用


async def setup_redis_listeners():
    """設置 Redis 監聽器"""
    asyncio.create_task(start_redis_listeners())


def init_listeners(app: FastAPI):
    """在 FastAPI 應用啟動時設置 Redis 監聽器"""
    @app.on_event("startup")
    async def startup_redis_listeners():
        await setup_redis_listeners() 