"""
WebSocket 訊息推送客戶端
提供簡化的介面來從 Celery 任務推送 WebSocket 訊息
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from uuid import UUID

from app.core.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)
ws_manager = WebSocketManager()


async def push_file_processing_progress(
    file_uuid: Union[UUID, str],
    event_type: str,
    progress: Optional[int] = None,
    current: Optional[int] = None,
    total: Optional[int] = None,
    status: str = "processing",
    sentences: Optional[List[Dict[str, Any]]] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    將檔案處理進度推送到相關的 WebSocket 連接
    
    Args:
        file_uuid: 檔案 UUID
        event_type: 事件類型 (如 processing_started, pdf_extraction_progress 等)
        progress: 進度百分比 (0-100)
        current: 當前處理的項目數量
        total: 項目總數
        status: 處理狀態
        sentences: 處理的句子列表 (僅適用於某些事件類型)
        error_message: 錯誤訊息 (僅適用於 processing_failed 事件)
    """
    # 確保 UUID 是字符串
    file_uuid_str = str(file_uuid)
    
    # 構建訊息
    message = {
        "event": event_type,
        "file_uuid": file_uuid_str,
        "status": status,
        "timestamp": datetime.now().isoformat()
    }
    
    # 添加可選字段
    if progress is not None:
        message["progress"] = progress
    
    if current is not None:
        message["current"] = current
    
    if total is not None:
        message["total"] = total
    
    if sentences is not None:
        message["sentences"] = sentences
    
    if error_message is not None:
        message["error_message"] = error_message
    
    # 發送訊息到主題
    topic = f"file_processing:{file_uuid_str}"
    await ws_manager.send_to_topic(topic, message)


async def push_query_processing_progress(
    query_uuid: Union[UUID, str],
    event_type: str,
    keywords: Optional[List[str]] = None,
    progress: Optional[int] = None,
    current_step: Optional[str] = None,
    found_definitions: Optional[Dict[str, int]] = None,
    found_sentences: Optional[List[Dict[str, Any]]] = None,
    referenced_sentences: Optional[List[Dict[str, Any]]] = None,
    status: str = "processing",
    error_message: Optional[str] = None,
) -> None:
    """
    將查詢處理進度推送到相關的 WebSocket 連接
    
    Args:
        query_uuid: 查詢 UUID
        event_type: 事件類型
        keywords: 提取的關鍵字列表
        progress: 進度百分比 (0-100)
        current_step: 當前處理步驟描述
        found_definitions: 找到的定義數量 (按類型分類)
        found_sentences: 找到的句子列表
        referenced_sentences: 參考的句子列表
        status: 處理狀態
        error_message: 錯誤訊息
    """
    # 確保 UUID 是字符串
    query_uuid_str = str(query_uuid)
    
    # 構建訊息
    message = {
        "event": event_type,
        "query_uuid": query_uuid_str,
        "status": status,
        "timestamp": datetime.now().isoformat()
    }
    
    # 添加可選字段
    if keywords is not None:
        message["keywords"] = keywords
    
    if progress is not None:
        message["progress"] = progress
    
    if current_step is not None:
        message["current_step"] = current_step
    
    if found_definitions is not None:
        message["found_definitions"] = found_definitions
    
    if found_sentences is not None:
        message["found_sentences"] = found_sentences
    
    if referenced_sentences is not None:
        message["referenced_sentences"] = referenced_sentences
    
    if error_message is not None:
        message["error_message"] = error_message
    
    # 發送訊息到主題
    topic = f"query_processing:{query_uuid_str}"
    await ws_manager.send_to_topic(topic, message)


def send_file_progress_event(
    file_uuid: Union[UUID, str],
    event_type: str,
    **kwargs
) -> None:
    """
    同步函數，從 Celery 任務調用，啟動異步函數來推送檔案進度事件。
    
    Args:
        file_uuid: 檔案 UUID
        event_type: 事件類型
        **kwargs: 額外的訊息參數
    """
    try:
        # 創建事件循環並運行 push_file_processing_progress 函數
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            push_file_processing_progress(file_uuid, event_type, **kwargs)
        )
        loop.close()
    except Exception as e:
        logger.error(f"推送檔案進度事件時發生錯誤: {str(e)}")


def send_query_progress_event(
    query_uuid: Union[UUID, str],
    event_type: str,
    **kwargs
) -> None:
    """
    同步函數，從 Celery 任務調用，啟動異步函數來推送查詢進度事件。
    
    Args:
        query_uuid: 查詢 UUID
        event_type: 事件類型
        **kwargs: 額外的訊息參數
    """
    try:
        # 創建事件循環並運行 push_query_processing_progress 函數
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            push_query_processing_progress(query_uuid, event_type, **kwargs)
        )
        loop.close()
    except Exception as e:
        logger.error(f"推送查詢進度事件時發生錯誤: {str(e)}") 