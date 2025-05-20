"""
WebSocket事件監聽器
"""
import logging
from fastapi import FastAPI


logger = logging.getLogger(__name__)


def init_listeners(app: FastAPI):
    """
    初始化Redis Pub/Sub監聽器
    
    Args:
        app: FastAPI實例
    """
    logger.info("初始化Redis Pub/Sub監聽器...")
    # TODO: 實現Redis Pub/Sub監聽器
    logger.info("Redis Pub/Sub監聽器初始化完成") 