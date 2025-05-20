"""
AI文件分析與互動平台 - 後端主應用程式
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.api.websockets import router as websocket_router
from app.api.websockets.listener import init_listeners
from app.core.config import settings
from app.core.events import startup_event, shutdown_event

# 創建FastAPI應用實例
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI文件分析與互動平台API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# 設置CORS中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊啟動和關閉事件處理程序
app.add_event_handler("startup", startup_event)
app.add_event_handler("shutdown", shutdown_event)

# 初始化 Redis Pub/Sub 監聽器
init_listeners(app)

# 添加API路由
app.include_router(api_router, prefix="/api")

# 添加 WebSocket 路由
app.include_router(websocket_router)

# 健康檢查端點
@app.get("/health", tags=["健康檢查"])
async def health_check():
    """
    系統健康檢查端點，用於容器健康檢查
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 