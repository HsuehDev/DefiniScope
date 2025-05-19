"""
API路由註冊
"""
from fastapi import APIRouter

from app.api.endpoints import auth, files, chat, ws

# 創建主API路由器
api_router = APIRouter()

# 註冊各模塊的路由
api_router.include_router(auth.router, prefix="/auth", tags=["認證"])
api_router.include_router(files.router, prefix="/files", tags=["檔案管理"])
api_router.include_router(chat.router, prefix="/chat", tags=["聊天與問答"])
api_router.include_router(ws.router, prefix="/ws", tags=["WebSocket"]) 