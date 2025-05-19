"""Redis Pub/Sub publisher utilities for WebSocket updates"""

import redis
import json
import datetime
import asyncio
import time
from loguru import logger

from app.core.config import settings


def publish_file_update(file_uuid: str, event: str, data: dict):
    """發布檔案處理更新到 Redis Pub/Sub (同步版本)
    
    Args:
        file_uuid: 檔案 UUID
        event: 事件類型，如 'processing_started', 'pdf_extraction_progress'
        data: 事件相關的數據
    """
    try:
        r = redis.from_url(settings.REDIS_URL)
        
        # 檢查必要欄位
        required_fields = {
            "processing_started": ["status"],
            "pdf_extraction_progress": ["progress", "current", "total", "status"],
            "sentence_extraction_detail": ["sentences"],
            "sentence_classification_progress": ["progress", "current", "total", "status"],
            "sentence_classification_detail": ["sentences"],
            "processing_completed": ["status"],
            "processing_failed": ["status", "error_message"],
        }
        
        # 檢查必要欄位
        if event in required_fields:
            for field in required_fields[event]:
                if field not in data and field != "file_uuid" and field != "event":
                    logger.warning(f"事件 {event} 缺少必要欄位 {field}")
        
        message = {
            "event": event,
            "file_uuid": file_uuid,
            **data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        # 存儲最近的消息，用於新連接時的初始狀態同步
        # 使用有序集合，按時間排序
        r.zadd(
            f"recent_updates:file:{file_uuid}", 
            {json.dumps(message): time.time()}
        )
        # 只保留最近的10條消息
        r.zremrangebyrank(f"recent_updates:file:{file_uuid}", 0, -11)
        
        channel = f"file_updates:{file_uuid}"
        r.publish(channel, json.dumps(message))
        logger.debug(f"已發布 {event} 事件到 {channel}")
    except Exception as e:
        logger.error(f"發布檔案更新到 Redis 失敗: {str(e)}")


def publish_query_update(query_uuid: str, event: str, data: dict):
    """發布查詢處理更新到 Redis Pub/Sub (同步版本)
    
    Args:
        query_uuid: 查詢 UUID
        event: 事件類型，如 'query_processing_started', 'database_search_progress'
        data: 事件相關的數據
    """
    try:
        r = redis.from_url(settings.REDIS_URL)
        
        # 檢查必要欄位
        required_fields = {
            "query_processing_started": ["status"],
            "keyword_extraction_completed": ["keywords"],
            "database_search_progress": ["progress", "keywords", "current_step"],
            "database_search_result": ["keyword", "found_sentences"],
            "answer_generation_started": [],
            "referenced_sentences": ["referenced_sentences"],
            "query_completed": ["status"],
            "query_failed": ["status", "error_message"],
        }
        
        # 檢查必要欄位
        if event in required_fields:
            for field in required_fields[event]:
                if field not in data and field != "query_uuid" and field != "event":
                    logger.warning(f"事件 {event} 缺少必要欄位 {field}")
        
        message = {
            "event": event,
            "query_uuid": query_uuid,
            **data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        # 存儲最近的消息，用於新連接時的初始狀態同步
        # 使用有序集合，按時間排序
        r.zadd(
            f"recent_updates:query:{query_uuid}", 
            {json.dumps(message): time.time()}
        )
        # 只保留最近的10條消息
        r.zremrangebyrank(f"recent_updates:query:{query_uuid}", 0, -11)
        
        channel = f"query_updates:{query_uuid}"
        r.publish(channel, json.dumps(message))
        logger.debug(f"已發布 {event} 事件到 {channel}")
    except Exception as e:
        logger.error(f"發布查詢更新到 Redis 失敗: {str(e)}")


async def publish_file_update_async(file_uuid: str, event: str, data: dict):
    """發布檔案處理更新到 Redis Pub/Sub (異步版本)"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None, publish_file_update, file_uuid, event, data
    )


async def publish_query_update_async(query_uuid: str, event: str, data: dict):
    """發布查詢處理更新到 Redis Pub/Sub (異步版本)"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None, publish_query_update, query_uuid, event, data
    ) 