"""Chat query WebSocket endpoint"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Path, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
import datetime
import json
import uuid
import redis
import asyncio

from app.db.session import get_db
from app.api.websockets.manager import manager
from app.api.websockets.auth import (
    authenticate_websocket,
    verify_query_access,
    close_with_error,
)
from app.core.config import settings

router = APIRouter()


async def send_recent_query_updates(websocket: WebSocket, query_uuid: str):
    """發送最近的查詢更新消息"""
    try:
        # 使用 run_in_executor 將同步 Redis 操作轉為異步
        loop = asyncio.get_event_loop()
        r = redis.from_url(settings.REDIS_URL)
        
        # 獲取最近的更新
        def get_recent_updates():
            updates = r.zrange(f"recent_updates:query:{query_uuid}", 0, -1)
            return updates
            
        updates = await loop.run_in_executor(None, get_recent_updates)
        
        if not updates:
            logger.debug(f"沒有找到查詢 {query_uuid} 的最近更新")
            return
            
        logger.debug(f"找到 {len(updates)} 條查詢 {query_uuid} 的最近更新")
        for update_json in updates:
            try:
                await websocket.send_text(update_json.decode("utf-8"))
                await asyncio.sleep(0.01)  # 短暫暫停，避免發送過快
            except Exception as e:
                logger.error(f"發送最近更新失敗: {str(e)}")
                break
                
    except Exception as e:
        logger.error(f"獲取查詢最近更新失敗: {str(e)}")


@router.websocket("/chat/{query_uuid}")
async def chat_websocket(
    websocket: WebSocket, 
    query_uuid: str = Path(...),
    db: AsyncSession = Depends(get_db)
):
    """查詢處理進度 WebSocket 端點
    
    允許客戶端接收查詢處理過程中的實時更新
    """
    # 驗證使用者身份，不要先accept
    authenticated, user, error_message = await authenticate_websocket(websocket)
    if not authenticated:
        # 為了發送錯誤訊息，需要先建立連接
        await websocket.accept()
        logger.warning(f"WebSocket 連接認證失敗: {error_message}")
        await close_with_error(websocket, error_message)
        return
    
    # 檢查用戶是否有權限訪問該查詢
    has_access = await verify_query_access(query_uuid, user, db)
    if not has_access:
        # 為了發送錯誤訊息，需要先建立連接
        await websocket.accept()
        error_message = "權限錯誤：您沒有權限訪問該查詢"
        logger.warning(f"用戶 {user.user_uuid} 嘗試訪問無權限的查詢 {query_uuid}")
        await close_with_error(websocket, error_message)
        return
    
    # 生成連接ID
    connection_id = str(uuid.uuid4())
    
    # 建立連接
    await manager.connect_query(websocket, query_uuid, user.user_uuid)
    
    # 發送歡迎訊息
    await websocket.send_text(json.dumps({
        "event": "connection_established",
        "query_uuid": query_uuid,
        "connection_id": connection_id,  # 添加連接ID，用於斷線重連
        "server_start_time": settings.SERVER_START_TIME,  # 添加伺服器啟動時間，用於檢測系統重啟
        "message": "已成功連接到查詢處理 WebSocket",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }))
    
    # 發送最近的更新
    await send_recent_query_updates(websocket, query_uuid)
    
    # 持續監聽客戶端消息，直到斷開連接
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # 處理客戶端發來的消息
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "event": "pong",
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }))
            except json.JSONDecodeError:
                # 忽略非 JSON 格式的消息
                pass
    except WebSocketDisconnect:
        logger.info(f"用戶 {user.user_uuid} 的查詢 {query_uuid} WebSocket 連接已斷開")
    except Exception as e:
        logger.error(f"處理 WebSocket 消息時發生錯誤: {str(e)}")
    finally:
        # 清理連接
        await manager.disconnect(websocket) 