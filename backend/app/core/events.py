"""
應用啟動和關閉事件處理程序
"""
import logging
from typing import Callable

from fastapi import FastAPI

from app.db.session import engine, SessionLocal
from app.db.init_db import init_db
from app.core.config import settings

logger = logging.getLogger(__name__)


async def startup_event():
    """
    應用啟動時執行的操作
    """
    logger.info("應用啟動中...")
    
    # 初始化資料庫
    try:
        # 建立資料庫連接並初始化
        db = SessionLocal()
        await init_db(db)
    except Exception as e:
        logger.error(f"資料庫初始化失敗: {str(e)}")
        raise e
    finally:
        await db.close()
    
    # 初始化MinIO連接
    try:
        # 在這裡初始化MinIO連接
        pass
    except Exception as e:
        logger.error(f"MinIO初始化失敗: {str(e)}")
    
    logger.info("應用啟動完成")


async def shutdown_event():
    """
    應用關閉時執行的操作
    """
    logger.info("應用關閉中...")
    
    # 關閉資料庫連接
    try:
        await engine.dispose()
    except Exception as e:
        logger.error(f"資料庫連接關閉失敗: {str(e)}")
    
    logger.info("應用關閉完成") 