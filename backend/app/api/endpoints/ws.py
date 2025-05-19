"""
WebSocket 端點
處理 WebSocket 連接和實時更新
"""
import json
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Annotated
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_

from app.core.websocket_manager import WebSocketManager
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.file import File
from app.models.query import Query

router = APIRouter()
logger = logging.getLogger(__name__)

# 全局 WebSocket 管理器
ws_manager = WebSocketManager()

# 安全性設置
security = HTTPBearer()


async def verify_file_ownership(
    websocket: WebSocket,
    file_uuid: UUID,
    db: AsyncSession
) -> tuple[UUID, UUID]:
    """
    驗證使用者是否為檔案擁有者
    
    Args:
        websocket: WebSocket 連接物件
        file_uuid: 檔案 UUID
        db: 資料庫會話
    
    Returns:
        tuple[UUID, UUID]: 使用者 UUID 和檔案 UUID 的元組
    
    Raises:
        HTTPException: 如果驗證失敗
    """
    # 從查詢參數獲取 token
    token = websocket.query_params.get("token")
    if not token:
        # WebSocket 不支援標準 HTTP 錯誤碼，所以我們發送一個關閉碼和原因
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="缺少認證 token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少認證 token")
    
    try:
        # 解碼並驗證 token
        payload = decode_access_token(token)
        user_uuid = UUID(payload["sub"])
        
        # 查詢資料庫，檢查檔案所有權
        stmt = select(File).where(
            and_(
                File.file_uuid == file_uuid,
                File.user_uuid == user_uuid
            )
        )
        result = await db.execute(stmt)
        file = result.scalar_one_or_none()
        
        if not file:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="無權訪問此檔案")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權訪問此檔案")
        
        return user_uuid, file_uuid
    
    except Exception as e:
        logger.error(f"驗證檔案所有權錯誤: {str(e)}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="認證過程中發生錯誤")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"認證過程中發生錯誤: {str(e)}")


async def verify_query_ownership(
    websocket: WebSocket,
    query_uuid: UUID,
    db: AsyncSession
) -> tuple[UUID, UUID]:
    """
    驗證使用者是否為查詢提交者
    
    Args:
        websocket: WebSocket 連接物件
        query_uuid: 查詢 UUID
        db: 資料庫會話
    
    Returns:
        tuple[UUID, UUID]: 使用者 UUID 和查詢 UUID 的元組
    
    Raises:
        HTTPException: 如果驗證失敗
    """
    # 從查詢參數獲取 token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="缺少認證 token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少認證 token")
    
    try:
        # 解碼並驗證 token
        payload = decode_access_token(token)
        user_uuid = UUID(payload["sub"])
        
        # 查詢資料庫，檢查查詢所有權
        stmt = select(Query).where(
            and_(
                Query.query_uuid == query_uuid,
                Query.user_uuid == user_uuid
            )
        )
        result = await db.execute(stmt)
        query = result.scalar_one_or_none()
        
        if not query:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="無權訪問此查詢")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權訪問此查詢")
        
        return user_uuid, query_uuid
    
    except Exception as e:
        logger.error(f"驗證查詢所有權錯誤: {str(e)}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="認證過程中發生錯誤")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"認證過程中發生錯誤: {str(e)}")


@router.websocket("/processing/{file_uuid}")
async def websocket_processing_endpoint(
    websocket: WebSocket,
    file_uuid: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    檔案處理進度 WebSocket 端點
    
    Args:
        websocket: WebSocket 連接物件
        file_uuid: 檔案 UUID
        db: 資料庫會話
    """
    connection_id = str(uuid.uuid4())
    
    try:
        # 驗證檔案所有權
        user_uuid, _ = await verify_file_ownership(websocket, file_uuid, db)
        
        # 建立 WebSocket 連接
        await ws_manager.connect(websocket, connection_id, str(user_uuid))
        
        # 訂閱檔案處理進度主題
        file_topic = f"file_processing:{file_uuid}"
        await ws_manager.subscribe(connection_id, file_topic)
        
        # 發送初始連接成功訊息
        initial_message = {
            "event": "connection_established",
            "file_uuid": str(file_uuid),
            "status": "connected",
            "timestamp": datetime.now().isoformat()
        }
        await ws_manager.send_message(connection_id, initial_message)
        
        # 查詢檔案當前狀態，發送給客戶端
        stmt = select(File).where(File.file_uuid == file_uuid)
        result = await db.execute(stmt)
        file = result.scalar_one_or_none()
        
        if file:
            # 根據檔案當前狀態發送適當訊息
            status_message = {
                "event": f"processing_{file.processing_status}",
                "file_uuid": str(file_uuid),
                "status": file.processing_status
            }
            
            # 添加相關的進度資訊
            if file.processing_status == "completed":
                status_message["progress"] = 100
            elif file.processing_status == "failed":
                status_message["error_message"] = file.error_message or "處理失敗"
            elif file.processing_status == "processing" and file.sentence_count > 0:
                current_progress = (file.cd_count + file.od_count) * 100 // file.sentence_count
                status_message["progress"] = current_progress
                status_message["current"] = file.cd_count + file.od_count
                status_message["total"] = file.sentence_count
            
            status_message["timestamp"] = datetime.now().isoformat()
            await ws_manager.send_message(connection_id, status_message)
        
        # 保持連接開啟，等待客戶端發送訊息或斷開連接
        while True:
            data = await websocket.receive_text()
            # 簡單記錄客戶端訊息，通常不需要處理
            logger.debug(f"來自客戶端的訊息 {connection_id}: {data}")
    
    except WebSocketDisconnect:
        logger.info(f"客戶端斷開連接: {connection_id}")
    
    except Exception as e:
        logger.error(f"WebSocket 錯誤: {str(e)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=f"內部服務器錯誤: {str(e)}")
        except:
            pass
    
    finally:
        # 確保連接被正確清理
        try:
            ws_manager.disconnect(connection_id)
        except:
            pass


@router.websocket("/chat/{query_uuid}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    query_uuid: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    查詢處理進度 WebSocket 端點
    
    Args:
        websocket: WebSocket 連接物件
        query_uuid: 查詢 UUID
        db: 資料庫會話
    """
    connection_id = str(uuid.uuid4())
    
    try:
        # 驗證查詢所有權
        user_uuid, _ = await verify_query_ownership(websocket, query_uuid, db)
        
        # 建立 WebSocket 連接
        await ws_manager.connect(websocket, connection_id, str(user_uuid))
        
        # 訂閱查詢處理進度主題
        query_topic = f"query_processing:{query_uuid}"
        await ws_manager.subscribe(connection_id, query_topic)
        
        # 發送初始連接成功訊息
        initial_message = {
            "event": "connection_established",
            "query_uuid": str(query_uuid),
            "status": "connected",
            "timestamp": datetime.now().isoformat()
        }
        await ws_manager.send_message(connection_id, initial_message)
        
        # 查詢當前狀態，發送給客戶端
        stmt = select(Query).where(Query.query_uuid == query_uuid)
        result = await db.execute(stmt)
        query = result.scalar_one_or_none()
        
        if query:
            # 根據查詢當前狀態發送適當訊息
            status_message = {
                "event": f"query_{query.status}",
                "query_uuid": str(query_uuid),
                "status": query.status,
                "timestamp": datetime.now().isoformat()
            }
            
            await ws_manager.send_message(connection_id, status_message)
        
        # 保持連接開啟，等待客戶端發送訊息或斷開連接
        while True:
            data = await websocket.receive_text()
            # 簡單記錄客戶端訊息，通常不需要處理
            logger.debug(f"來自客戶端的訊息 {connection_id}: {data}")
    
    except WebSocketDisconnect:
        logger.info(f"客戶端斷開連接: {connection_id}")
    
    except Exception as e:
        logger.error(f"WebSocket 錯誤: {str(e)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=f"內部服務器錯誤: {str(e)}")
        except:
            pass
    
    finally:
        # 確保連接被正確清理
        try:
            ws_manager.disconnect(connection_id)
        except:
            pass


# 供 Celery 任務調用的進度更新函數
async def push_file_processing_progress(
    file_uuid: UUID,
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
    # 構建訊息
    message = {
        "event": event_type,
        "file_uuid": str(file_uuid),
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
    topic = f"file_processing:{file_uuid}"
    await ws_manager.send_to_topic(topic, message)


async def push_query_processing_progress(
    query_uuid: UUID,
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
    # 構建訊息
    message = {
        "event": event_type,
        "query_uuid": str(query_uuid),
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
    topic = f"query_processing:{query_uuid}"
    await ws_manager.send_to_topic(topic, message) 