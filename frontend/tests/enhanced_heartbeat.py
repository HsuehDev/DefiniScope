"""
增強的 WebSocket 心跳機制實現示例
"""
import asyncio
import time
import json
import datetime
from typing import Dict, Set
from fastapi import WebSocket
from loguru import logger


class HeartbeatManager:
    """管理 WebSocket 連接心跳，自動關閉長時間沒有活動的連接"""
    
    def __init__(self, timeout_seconds: int = 60):
        """
        初始化心跳管理器
        
        Args:
            timeout_seconds: 超時時間（秒），超過此時間沒有收到心跳將關閉連接
        """
        self.timeout_seconds = timeout_seconds
        # 保存連接的最後活動時間: WebSocket -> 時間戳
        self.last_activity = {}
        # 停止事件，用於關閉管理器
        self.should_stop = False
    
    def register_connection(self, websocket: WebSocket):
        """註冊新連接"""
        self.last_activity[websocket] = time.time()
        logger.debug(f"註冊新連接的心跳跟踪")
    
    def unregister_connection(self, websocket: WebSocket):
        """註銷連接"""
        if websocket in self.last_activity:
            del self.last_activity[websocket]
            logger.debug(f"取消註冊連接的心跳跟踪")
    
    def update_activity(self, websocket: WebSocket):
        """更新連接的活動時間"""
        self.last_activity[websocket] = time.time()
    
    async def handle_ping(self, websocket: WebSocket, message: Dict):
        """處理 ping 消息"""
        # 更新活動時間
        self.update_activity(websocket)
        
        # 回應 pong
        await websocket.send_text(json.dumps({
            "event": "pong",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "server_time": time.time(),
            "client_time": message.get("time", 0),
            "latency": message.get("time", 0) and time.time() - message.get("time", 0) or None
        }))
    
    async def check_timeouts(self):
        """定期檢查超時連接並關閉它們"""
        while not self.should_stop:
            try:
                current_time = time.time()
                to_close = []
                
                # 找出所有超時的連接
                for ws, last_time in self.last_activity.items():
                    if current_time - last_time > self.timeout_seconds:
                        to_close.append(ws)
                
                # 關閉超時連接
                for ws in to_close:
                    try:
                        logger.warning(f"連接超時 ({self.timeout_seconds}s 無活動)，正在關閉")
                        await ws.close(code=1000, reason="Heartbeat timeout")
                        self.unregister_connection(ws)
                    except Exception as e:
                        logger.error(f"關閉超時連接失敗: {str(e)}")
                
                # 每 5 秒檢查一次
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"檢查連接超時時出錯: {str(e)}")
                await asyncio.sleep(5)
    
    def stop(self):
        """停止心跳管理器"""
        self.should_stop = True


# 使用示例 - 在 FastAPI 端點中集成
async def enhanced_websocket_endpoint(websocket: WebSocket):
    # 創建心跳管理器
    heartbeat_manager = HeartbeatManager(timeout_seconds=60)
    
    # 啟動定期檢查任務
    check_task = asyncio.create_task(heartbeat_manager.check_timeouts())
    
    try:
        # 接受連接
        await websocket.accept()
        
        # 註冊連接
        heartbeat_manager.register_connection(websocket)
        
        # 發送歡迎訊息
        await websocket.send_text(json.dumps({
            "event": "connection_established",
            "message": "已成功連接",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }))
        
        # 處理訊息
        while True:
            try:
                data = await websocket.receive_text()
                # 更新活動時間
                heartbeat_manager.update_activity(websocket)
                
                try:
                    message = json.loads(data)
                    
                    # 處理 ping 消息
                    if message.get("type") == "ping":
                        await heartbeat_manager.handle_ping(websocket, message)
                    # 處理其他消息...
                    
                except json.JSONDecodeError:
                    # 忽略非 JSON 格式的消息
                    pass
            except Exception as e:
                logger.error(f"處理 WebSocket 消息時發生錯誤: {str(e)}")
                break
    except Exception as e:
        logger.error(f"WebSocket 連接出錯: {str(e)}")
    finally:
        # 取消定期檢查任務
        check_task.cancel()
        try:
            await check_task
        except asyncio.CancelledError:
            pass
        
        # 註銷連接
        heartbeat_manager.unregister_connection(websocket)
        
        # 關閉連接
        try:
            await websocket.close()
        except:
            pass 