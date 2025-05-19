"""WebSocket router configuration"""

from fastapi import APIRouter

from app.api.websockets.endpoints import processing, chat

# 移除前綴，因為子路由已包含/ws/前綴
router = APIRouter()

# 添加各 WebSocket 端點
router.include_router(processing.router)
router.include_router(chat.router) 