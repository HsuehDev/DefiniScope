"""WebSocket authentication and authorization functions"""

from typing import Optional, Tuple
from fastapi import WebSocket, WebSocketDisconnect, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import json
import datetime

from app.db.session import get_db
from app.core.auth import decode_jwt_token
from app.models.user import User
from app.models.file import File
from app.models.query import Query
from app.services.user import get_user_by_uuid


async def get_token_from_websocket(websocket: WebSocket) -> Optional[str]:
    """從 WebSocket 連接獲取認證令牌
    
    嘗試從 query 參數、cookie 或 headers 中獲取令牌
    """
    # 從查詢參數獲取
    token = websocket.query_params.get("token")
    if token:
        return token
    
    # 從 cookie 獲取
    cookies = websocket.cookies
    token = cookies.get("access_token")
    if token:
        return token
    
    # 從 headers 獲取
    headers = dict(websocket.headers)
    auth_header = headers.get("authorization") or headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "")
    
    return None


async def authenticate_websocket(websocket: WebSocket) -> Tuple[bool, Optional[User], Optional[str]]:
    """驗證 WebSocket 連接，返回 (是否通過驗證, 用戶對象, 錯誤訊息)"""
    token = await get_token_from_websocket(websocket)
    
    if not token:
        return False, None, "認證失敗：未提供有效的認證令牌"
    
    try:
        # 解析令牌
        payload = await decode_jwt_token(token)
        if not payload:
            return False, None, "認證失敗：令牌無效或已過期"
        
        user_uuid = payload.get("sub")
        if not user_uuid:
            return False, None, "認證失敗：令牌中缺少用戶標識符"
        
        # 獲取用戶資訊
        db = await get_db()
        user = await get_user_by_uuid(db, user_uuid)
        
        if not user:
            return False, None, "認證失敗：用戶不存在或已停用"
        
        return True, user, None
    
    except Exception as e:
        return False, None, f"認證失敗：{str(e)}"


async def verify_file_access(file_uuid: str, user: User, db: AsyncSession) -> bool:
    """驗證使用者是否有權訪問特定檔案"""
    file = await db.get(File, file_uuid)
    if not file:
        return False
    return file.user_uuid == user.user_uuid


async def verify_query_access(query_uuid: str, user: User, db: AsyncSession) -> bool:
    """驗證使用者是否有權訪問特定查詢"""
    query = await db.get(Query, query_uuid)
    if not query:
        return False
    return query.user_uuid == user.user_uuid


async def close_with_error(websocket: WebSocket, error_message: str, code: int = 1008):
    """發送錯誤消息並關閉 WebSocket 連接"""
    try:
        if websocket.client_state.CONNECTED:
            await websocket.send_text(json.dumps({
                "event": "error",
                "detail": error_message,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }))
        await websocket.close(code=code)
    except Exception:
        # 忽略關閉連接時的錯誤
        pass 