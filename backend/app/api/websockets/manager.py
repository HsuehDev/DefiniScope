"""WebSocket connection manager"""

from typing import Dict, List, Set, Optional
import json
import asyncio
import datetime
from fastapi import WebSocket, WebSocketDisconnect, WebSocketState
from loguru import logger


class ConnectionManager:
    """管理 WebSocket 連接"""

    def __init__(self):
        # 檔案處理連接: file_uuid -> Set[WebSocket]
        self.file_connections: Dict[str, Set[WebSocket]] = {}
        # 查詢處理連接: query_uuid -> Set[WebSocket]
        self.query_connections: Dict[str, Set[WebSocket]] = {}
        # 用戶連接追踪: user_uuid -> Set[WebSocket]
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        # 反向映射: WebSocket -> (file_uuid 或 query_uuid, user_uuid)
        self.connection_info: Dict[WebSocket, Dict[str, str]] = {}
        # 鎖，用於同步修改集合
        self.lock = asyncio.Lock()

    async def connect_file(self, websocket: WebSocket, file_uuid: str, user_uuid: str):
        """建立檔案處理 WebSocket 連接"""
        await websocket.accept()
        
        async with self.lock:
            # 添加到檔案連接映射
            if file_uuid not in self.file_connections:
                self.file_connections[file_uuid] = set()
            self.file_connections[file_uuid].add(websocket)
            
            # 添加到用戶連接映射
            if user_uuid not in self.user_connections:
                self.user_connections[user_uuid] = set()
            self.user_connections[user_uuid].add(websocket)
            
            # 添加到反向映射
            self.connection_info[websocket] = {
                "type": "file",
                "resource_uuid": file_uuid,
                "user_uuid": user_uuid
            }
        
        logger.info(f"用戶 {user_uuid} 建立了檔案 {file_uuid} 的 WebSocket 連接")

    async def connect_query(self, websocket: WebSocket, query_uuid: str, user_uuid: str):
        """建立查詢處理 WebSocket 連接"""
        await websocket.accept()
        
        async with self.lock:
            # 添加到查詢連接映射
            if query_uuid not in self.query_connections:
                self.query_connections[query_uuid] = set()
            self.query_connections[query_uuid].add(websocket)
            
            # 添加到用戶連接映射
            if user_uuid not in self.user_connections:
                self.user_connections[user_uuid] = set()
            self.user_connections[user_uuid].add(websocket)
            
            # 添加到反向映射
            self.connection_info[websocket] = {
                "type": "query",
                "resource_uuid": query_uuid,
                "user_uuid": user_uuid
            }
        
        logger.info(f"用戶 {user_uuid} 建立了查詢 {query_uuid} 的 WebSocket 連接")

    async def disconnect(self, websocket: WebSocket):
        """處理 WebSocket 斷開連接"""
        async with self.lock:
            if websocket not in self.connection_info:
                return
                
            info = self.connection_info[websocket]
            connection_type = info["type"]
            resource_uuid = info["resource_uuid"]
            user_uuid = info["user_uuid"]
            
            # 從相應集合中移除
            if connection_type == "file" and resource_uuid in self.file_connections:
                self.file_connections[resource_uuid].discard(websocket)
                if not self.file_connections[resource_uuid]:
                    del self.file_connections[resource_uuid]
                    
            elif connection_type == "query" and resource_uuid in self.query_connections:
                self.query_connections[resource_uuid].discard(websocket)
                if not self.query_connections[resource_uuid]:
                    del self.query_connections[resource_uuid]
            
            # 從用戶連接中移除
            if user_uuid in self.user_connections:
                self.user_connections[user_uuid].discard(websocket)
                if not self.user_connections[user_uuid]:
                    del self.user_connections[user_uuid]
            
            # 從反向映射中移除
            del self.connection_info[websocket]
            
            logger.info(f"用戶 {user_uuid} 的 {connection_type} {resource_uuid} WebSocket 連接已斷開")

    async def broadcast_file_update(self, file_uuid: str, event: str, data: dict):
        """向特定檔案的所有連接廣播更新"""
        if file_uuid not in self.file_connections:
            logger.debug(f"檔案 {file_uuid} 沒有活躍的 WebSocket 連接")
            return
            
        message = {
            "event": event,
            "file_uuid": file_uuid,
            **data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        disconnected = set()
        
        async with self.lock:
            websockets = self.file_connections.get(file_uuid, set()).copy()
        
        for websocket in websockets:
            try:
                await websocket.send_text(json.dumps(message))
            except WebSocketDisconnect:
                disconnected.add(websocket)
            except Exception as e:
                logger.error(f"發送 WebSocket 消息失敗: {str(e)}")
                disconnected.add(websocket)
        
        # 清理斷開的連接
        for ws in disconnected:
            await self.disconnect(ws)
        
        logger.debug(f"已向檔案 {file_uuid} 的 {len(websockets) - len(disconnected)} 個連接廣播 {event} 事件")

    async def broadcast_query_update(self, query_uuid: str, event: str, data: dict):
        """向特定查詢的所有連接廣播更新"""
        if query_uuid not in self.query_connections:
            logger.debug(f"查詢 {query_uuid} 沒有活躍的 WebSocket 連接")
            return
            
        message = {
            "event": event,
            "query_uuid": query_uuid,
            **data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        disconnected = set()
        
        async with self.lock:
            websockets = self.query_connections.get(query_uuid, set()).copy()
        
        for websocket in websockets:
            try:
                await websocket.send_text(json.dumps(message))
            except WebSocketDisconnect:
                disconnected.add(websocket)
            except Exception as e:
                logger.error(f"發送 WebSocket 消息失敗: {str(e)}")
                disconnected.add(websocket)
        
        # 清理斷開的連接
        for ws in disconnected:
            await self.disconnect(ws)
        
        logger.debug(f"已向查詢 {query_uuid} 的 {len(websockets) - len(disconnected)} 個連接廣播 {event} 事件")

    def get_active_connections_count(self) -> dict:
        """獲取活躍連接數量統計"""
        return {
            "file_connections": sum(len(conns) for conns in self.file_connections.values()),
            "query_connections": sum(len(conns) for conns in self.query_connections.values()),
            "unique_users": len(self.user_connections),
            "total_connections": len(self.connection_info)
        }


# 全局連接管理器實例
manager = ConnectionManager() 