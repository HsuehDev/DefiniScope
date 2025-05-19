"""
WebSocket 與 Redis Pub/Sub 整合適配器

這個模組提供了現有 WebSocketManager 與新的 Redis Pub/Sub 功能之間的橋接。
它允許從 Redis 頻道接收的訊息能夠正確地轉發給相應的 WebSocket 客戶端。
"""

import json
import asyncio
from typing import Dict, Any
from loguru import logger

from app.core.websocket_manager import WebSocketManager


class WebSocketRedisAdapter:
    """WebSocket 與 Redis Pub/Sub 整合適配器"""
    
    def __init__(self):
        self.ws_manager = WebSocketManager()
    
    async def handle_file_update(self, file_uuid: str, event: str, data: Dict[str, Any]):
        """處理從 Redis 接收的檔案更新訊息
        
        Args:
            file_uuid: 檔案 UUID
            event: 事件類型
            data: 事件資料
        """
        logger.debug(f"處理檔案 {file_uuid} 的 {event} 事件")
        
        # 構建完整訊息
        message = {
            "event": event,
            "file_uuid": file_uuid,
            **data
        }
        
        # 確定訊息的廣播目標主題
        topic = f"file_processing:{file_uuid}"
        
        # 廣播訊息給訂閱該主題的連接
        sent_count = await self.ws_manager.send_to_topic(topic, message)
        logger.debug(f"已向 {sent_count} 個訂閱者發送檔案更新訊息")
    
    async def handle_query_update(self, query_uuid: str, event: str, data: Dict[str, Any]):
        """處理從 Redis 接收的查詢更新訊息
        
        Args:
            query_uuid: 查詢 UUID
            event: 事件類型
            data: 事件資料
        """
        logger.debug(f"處理查詢 {query_uuid} 的 {event} 事件")
        
        # 構建完整訊息
        message = {
            "event": event,
            "query_uuid": query_uuid,
            **data
        }
        
        # 確定訊息的廣播目標主題
        topic = f"query_processing:{query_uuid}"
        
        # 廣播訊息給訂閱該主題的連接
        sent_count = await self.ws_manager.send_to_topic(topic, message)
        logger.debug(f"已向 {sent_count} 個訂閱者發送查詢更新訊息")


# 全局 WebSocket Redis 適配器實例
adapter = WebSocketRedisAdapter() 