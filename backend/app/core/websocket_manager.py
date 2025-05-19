"""
WebSocket 連接管理器
處理 WebSocket 連接、用戶追踪和訊息推送
"""
import logging
from typing import Dict, Set, Any, Optional
import json
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    WebSocket 連接管理器
    
    負責維護活躍的 WebSocket 連接、用戶訂閱的主題、
    以及推送訊息到連接的客戶端。
    
    採用單例模式，確保整個應用只有一個 WebSocketManager 實例
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WebSocketManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # 活躍連接映射表: {connection_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # 用戶連接映射表: {user_id: {connection_id1, connection_id2, ...}}
        self.user_connections: Dict[str, Set[str]] = {}
        
        # 主題訂閱映射表: {topic: {connection_id1, connection_id2, ...}}
        self.topic_subscribers: Dict[str, Set[str]] = {}
        
        # 連接對用戶映射表: {connection_id: user_id}
        self.connection_to_user: Dict[str, str] = {}
        
        # 連接主題訂閱映射表: {connection_id: {topic1, topic2, ...}}
        self.connection_topics: Dict[str, Set[str]] = {}
        
        self._initialized = True
        logger.info("WebSocket 管理器初始化完成")
    
    async def connect(self, websocket: WebSocket, connection_id: str, user_id: Optional[str] = None) -> None:
        """
        處理新的 WebSocket 連接
        
        Args:
            websocket: WebSocket 連接物件
            connection_id: 連接唯一標識符
            user_id: 使用者 ID (如果已認證)
        """
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)
            self.connection_to_user[connection_id] = user_id
        
        self.connection_topics[connection_id] = set()
        logger.debug(f"已接受新的 WebSocket 連接: {connection_id}, 用戶: {user_id}")
    
    def disconnect(self, connection_id: str) -> None:
        """
        處理 WebSocket 連接斷開
        
        Args:
            connection_id: 連接唯一標識符
        """
        # 從活躍連接中移除
        self.active_connections.pop(connection_id, None)
        
        # 從用戶連接映射表中移除
        user_id = self.connection_to_user.pop(connection_id, None)
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                self.user_connections.pop(user_id)
        
        # 從所有訂閱的主題中移除
        topics = self.connection_topics.pop(connection_id, set())
        for topic in topics:
            if topic in self.topic_subscribers:
                self.topic_subscribers[topic].discard(connection_id)
                if not self.topic_subscribers[topic]:
                    self.topic_subscribers.pop(topic)
        
        logger.debug(f"WebSocket 連接斷開: {connection_id}, 用戶: {user_id}")
    
    async def subscribe(self, connection_id: str, topic: str) -> bool:
        """
        訂閱指定主題
        
        Args:
            connection_id: 連接唯一標識符
            topic: 主題名稱
            
        Returns:
            訂閱是否成功
        """
        if connection_id not in self.active_connections:
            logger.warning(f"無法訂閱主題 '{topic}': 連接 {connection_id} 不存在")
            return False
        
        if topic not in self.topic_subscribers:
            self.topic_subscribers[topic] = set()
        
        self.topic_subscribers[topic].add(connection_id)
        self.connection_topics[connection_id].add(topic)
        
        logger.debug(f"連接 {connection_id} 已訂閱主題 '{topic}'")
        return True
    
    async def unsubscribe(self, connection_id: str, topic: str) -> bool:
        """
        取消訂閱指定主題
        
        Args:
            connection_id: 連接唯一標識符
            topic: 主題名稱
            
        Returns:
            取消訂閱是否成功
        """
        if connection_id not in self.active_connections:
            logger.warning(f"無法取消訂閱主題 '{topic}': 連接 {connection_id} 不存在")
            return False
        
        # 從主題訂閱者移除
        if topic in self.topic_subscribers:
            self.topic_subscribers[topic].discard(connection_id)
            if not self.topic_subscribers[topic]:
                self.topic_subscribers.pop(topic)
        
        # 從連接訂閱列表移除
        if connection_id in self.connection_topics:
            self.connection_topics[connection_id].discard(topic)
        
        logger.debug(f"連接 {connection_id} 已取消訂閱主題 '{topic}'")
        return True
    
    async def send_message(self, connection_id: str, message: Any) -> bool:
        """
        向指定連接發送訊息
        
        Args:
            connection_id: 連接唯一標識符
            message: 要發送的訊息 (將轉換為 JSON)
            
        Returns:
            發送是否成功
        """
        if connection_id not in self.active_connections:
            logger.warning(f"無法發送訊息: 連接 {connection_id} 不存在")
            return False
        
        websocket = self.active_connections[connection_id]
        try:
            # 如果訊息不是字符串，轉換為 JSON
            if not isinstance(message, str):
                message = json.dumps(message)
            
            await websocket.send_text(message)
            return True
        except Exception as e:
            logger.error(f"發送訊息失敗: {str(e)}")
            await self._handle_connection_error(connection_id)
            return False
    
    async def broadcast(self, message: Any) -> int:
        """
        向所有活躍連接廣播訊息
        
        Args:
            message: 要發送的訊息
            
        Returns:
            成功發送的連接數量
        """
        successful_sends = 0
        
        # 如果訊息不是字符串，轉換為 JSON
        if not isinstance(message, str):
            message = json.dumps(message)
        
        # 複製 keys 以避免在迭代過程中修改字典
        connection_ids = list(self.active_connections.keys())
        
        for connection_id in connection_ids:
            if await self.send_message(connection_id, message):
                successful_sends += 1
        
        return successful_sends
    
    async def send_to_topic(self, topic: str, message: Any) -> int:
        """
        向訂閱特定主題的所有連接發送訊息
        
        Args:
            topic: 主題名稱
            message: 要發送的訊息
            
        Returns:
            成功發送的連接數量
        """
        if topic not in self.topic_subscribers:
            logger.debug(f"主題 '{topic}' 沒有訂閱者")
            return 0
        
        # 如果訊息不是字符串，轉換為 JSON
        if not isinstance(message, str):
            message = json.dumps(message)
        
        successful_sends = 0
        # 複製 subscribers 以避免在迭代過程中修改集合
        subscribers = list(self.topic_subscribers[topic])
        
        for connection_id in subscribers:
            if await self.send_message(connection_id, message):
                successful_sends += 1
        
        return successful_sends
    
    async def send_message_to_user(self, user_id: str, topic: str, message: Any) -> int:
        """
        向特定用戶的所有連接發送訊息
        
        Args:
            user_id: 使用者 ID
            topic: 主題名稱 (用於日誌和過濾)
            message: 要發送的訊息
            
        Returns:
            成功發送的連接數量
        """
        if user_id not in self.user_connections:
            logger.debug(f"使用者 '{user_id}' 沒有活躍連接")
            return 0
        
        # 如果訊息不是字符串，轉換為 JSON
        if not isinstance(message, str):
            message = json.dumps(message)
        
        successful_sends = 0
        # 複製 connections 以避免在迭代過程中修改集合
        connections = list(self.user_connections[user_id])
        
        for connection_id in connections:
            # 檢查連接是否訂閱了指定主題
            # 如果沒有訂閱限制，或者已訂閱該主題，則發送訊息
            if (not topic) or (connection_id in self.connection_topics and 
                              topic in self.connection_topics[connection_id]):
                if await self.send_message(connection_id, message):
                    successful_sends += 1
        
        return successful_sends
    
    async def _handle_connection_error(self, connection_id: str) -> None:
        """
        處理連接錯誤，例如發送訊息失敗
        
        Args:
            connection_id: 連接唯一標識符
        """
        logger.info(f"處理連接錯誤: {connection_id}")
        self.disconnect(connection_id) 