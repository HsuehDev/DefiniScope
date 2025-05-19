"""
檔案處理任務
包含檔案處理相關的 Celery 任務，如 PDF 提取、句子分類等
"""
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from uuid import UUID

import httpx
from sqlalchemy import select, update, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy.future import select

from app.worker import celery
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.core.minio_client import get_minio_client, download_file
from app.db.session import SessionLocal
from app.models.file import File, ProcessingStatus
from app.models.sentence import Sentence, DefiningType
from app.schemas.websocket import (
    ProcessingStartedEvent, 
    PdfExtractionProgressEvent,
    SentenceExtractionDetailEvent,
    SentenceClassificationProgressEvent,
    SentenceClassificationDetailEvent,
    ProcessingCompletedEvent,
    ProcessingFailedEvent
)
from app.utils.redis_publisher import publish_file_update

# 設定日誌
logger = logging.getLogger(__name__)

# WebSocket 管理器實例
ws_manager = WebSocketManager()

@celery.task(
    name="process_uploaded_file",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True
)
def process_uploaded_file(self, file_uuid: str) -> Dict[str, Any]:
    """
    處理上傳的 PDF 檔案的 Celery 任務。
    
    處理流程包括：
    1. PDF 文本提取：調用 split_sentences 服務
    2. 句子儲存：將提取的句子保存到資料庫
    3. 句子分類：調用 n8n API 進行 CD/OD 分類
    4. 結果儲存：更新資料庫中的句子分類結果
    
    每個主要步驟都會通過 WebSocket 向前端發送進度更新。
    
    Args:
        file_uuid: 要處理的檔案 UUID
        
    Returns:
        包含處理結果的字典
    """
    try:
        # 將 file_uuid 字符串轉換為 UUID 物件
        file_uuid_obj = UUID(file_uuid)
        
        # 獲取檔案記錄與相關資訊
        file_info, user_uuid = get_file_info(file_uuid_obj)
        if not file_info:
            raise ValueError(f"找不到 UUID 為 {file_uuid} 的檔案記錄")
        
        # 發送處理開始事件
        send_processing_started_event(file_uuid, user_uuid)
        
        # 更新檔案處理狀態為 "processing"
        update_file_status(file_uuid_obj, "processing")
        
        # 步驟 1: PDF 文本提取 (調用 split_sentences 服務)
        sentences_with_pages = extract_text_from_pdf(file_uuid, file_info, user_uuid)
        
        # 步驟 2: 句子儲存到資料庫
        sentence_uuids = store_sentences_to_db(file_uuid_obj, user_uuid, sentences_with_pages)
        
        # 步驟 3: 句子分類：調用 n8n API 進行 CD/OD 分類
        classification_results = classify_sentences(file_uuid, user_uuid, sentence_uuids, sentences_with_pages)
        
        # 步驟 4: 儲存分類結果
        store_classification_results(file_uuid_obj, classification_results)
        
        # 步驟 5: 更新檔案統計資訊
        update_file_statistics(file_uuid_obj)
        
        # 發送處理完成事件
        send_processing_completed_event(file_uuid, user_uuid)
        
        # 更新檔案處理狀態為 "completed"
        update_file_status(file_uuid_obj, "completed")
        
        return {
            "status": "success",
            "file_uuid": file_uuid,
            "sentence_count": len(sentences_with_pages)
        }
        
    except Exception as e:
        # 記錄錯誤
        logger.error(f"處理檔案 {file_uuid} 時發生錯誤: {str(e)}", exc_info=True)
        
        # 嘗試發送處理失敗事件
        try:
            send_processing_failed_event(file_uuid, user_uuid, str(e))
        except Exception as ws_err:
            logger.error(f"發送失敗事件時發生錯誤: {str(ws_err)}")
        
        # 嘗試更新檔案處理狀態為 "failed"
        try:
            update_file_status(file_uuid_obj, "failed", error_message=str(e))
        except Exception as db_err:
            logger.error(f"更新檔案狀態時發生錯誤: {str(db_err)}")
        
        # 重新拋出異常，讓 Celery 處理重試邏輯
        raise


def get_file_info(file_uuid: UUID) -> Tuple[Dict[str, Any], UUID]:
    """
    從資料庫獲取檔案資訊。
    
    Args:
        file_uuid: 檔案 UUID
        
    Returns:
        (檔案信息字典, 使用者 UUID)
        
    Raises:
        ValueError: 當找不到檔案時
    """
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 查詢檔案記錄 - 使用同步查詢
        result = session.query(File).filter(File.file_uuid == file_uuid).first()
        
        if not result:
            raise ValueError(f"找不到 UUID 為 {file_uuid} 的檔案記錄")
        
        # 將 SQLAlchemy 物件轉換為字典
        file_info = {
            "file_uuid": result.file_uuid,
            "user_uuid": result.user_uuid,
            "original_name": result.original_name,
            "minio_bucket_name": result.minio_bucket_name,
            "minio_object_key": result.minio_object_key
        }
        
        return file_info, result.user_uuid
    finally:
        session.close()


def update_file_status(file_uuid: UUID, status: str, error_message: Optional[str] = None) -> None:
    """
    更新檔案處理狀態。
    
    Args:
        file_uuid: 檔案 UUID
        status: 新的處理狀態 ('processing', 'completed', 'failed')
        error_message: 如果處理失敗，則包含錯誤訊息
    """
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 準備更新資料
        update_data = {
            "processing_status": status, 
            "updated_at": datetime.utcnow()
        }
        if error_message:
            update_data["error_message"] = error_message
        
        # 執行更新 - 使用同步模式
        file = session.query(File).filter(File.file_uuid == file_uuid).first()
        if file:
            for key, value in update_data.items():
                setattr(file, key, value)
            session.commit()
    finally:
        session.close()


def send_processing_started_event(file_uuid: str, user_uuid: UUID) -> None:
    """
    發送處理開始的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
    """
    event = ProcessingStartedEvent(
        event="processing_started",
        file_uuid=file_uuid,
        status="processing",
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    
    # 也使用 Redis Pub/Sub 發布
    publish_file_update(
        file_uuid,
        "processing_started",
        {
            "status": "processing"
        }
    )
    
    logger.info(f"已發送處理開始事件: {event.dict()}")


def extract_text_from_pdf(file_uuid: str, file_info: Dict[str, Any], user_uuid: UUID) -> List[Dict[str, Any]]:
    """
    從 PDF 檔案中提取文本，調用 split_sentences 服務。
    
    Args:
        file_uuid: 檔案 UUID
        file_info: 檔案資訊，包含 MinIO 位置
        user_uuid: 使用者 UUID
        
    Returns:
        包含句子和頁碼的字典列表 [{"sentence": "...", "page": 1}, ...]
    """
    logger.info(f"開始從檔案 {file_uuid} 提取文本")
    
    # 從 MinIO 獲取 PDF 檔案
    pdf_data = download_file(
        file_info["minio_bucket_name"], 
        file_info["minio_object_key"]
    )
    
    if not pdf_data:
        raise ValueError(f"無法從 MinIO 下載檔案 {file_uuid}")
    
    # 準備調用 split_sentences 服務
    url = f"{settings.PDF_SPLITTER_URL}/api/process-pdf"
    
    # 發送 PDF 檔案到 split_sentences 服務
    try:
        # 準備請求資料
        files = {"file": (file_info["original_name"], pdf_data, "application/pdf")}
        
        # 發送請求與重試機制
        max_retries = 3
        retry_delay = 1  # 初始重試間隔（秒）
        
        for attempt in range(max_retries):
            try:
                # 發送進度更新
                send_pdf_extraction_progress_event(
                    file_uuid, 
                    user_uuid, 
                    progress=10 + (attempt * 5),  # 進度增量
                    status="processing"
                )
                
                # 設定超時為 30 秒
                with httpx.Client(timeout=30) as client:
                    response = client.post(url, files=files)
                
                # 檢查回應
                if response.status_code == 200:
                    # 獲取結果
                    result = response.json()
                    sentences = result.get("sentences", [])
                    
                    # 發送處理完成進度更新
                    send_pdf_extraction_progress_event(
                        file_uuid, 
                        user_uuid, 
                        progress=100, 
                        status="completed"
                    )
                    
                    # 發送提取的句子詳情
                    for i in range(0, len(sentences), 20):
                        batch = sentences[i:i+20]
                        send_sentence_extraction_detail_event(file_uuid, user_uuid, batch)
                    
                    logger.info(f"成功從檔案 {file_uuid} 提取了 {len(sentences)} 個句子")
                    return sentences
                else:
                    error_msg = f"split_sentences 服務回應錯誤: {response.status_code}, {response.text}"
                    logger.error(error_msg)
                    raise Exception(error_msg)
                    
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.warning(f"調用 split_sentences 服務失敗 (嘗試 {attempt+1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    # 指數退避重試
                    wait_time = retry_delay * (2 ** attempt)
                    logger.info(f"等待 {wait_time} 秒後重試...")
                    time.sleep(wait_time)
                else:
                    logger.error("已達最大重試次數，放棄處理")
                    raise
        
        # 如果所有重試都失敗
        raise Exception("無法從 PDF 提取文本，所有重試都失敗")
    
    except Exception as e:
        logger.error(f"提取文本時發生錯誤: {str(e)}", exc_info=True)
        raise


def send_pdf_extraction_progress_event(
    file_uuid: str, 
    user_uuid: UUID, 
    progress: int, 
    status: str
) -> None:
    """
    發送 PDF 提取進度的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        progress: 進度百分比
        status: 狀態 ('processing', 'completed')
    """
    event = PdfExtractionProgressEvent(
        event="pdf_extraction_progress",
        file_uuid=file_uuid,
        progress=progress,
        status=status,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    logger.debug(f"已發送 PDF 提取進度事件: {progress}%")


def send_sentence_extraction_detail_event(
    file_uuid: str, 
    user_uuid: UUID, 
    sentences: List[Dict[str, Any]]
) -> None:
    """
    發送句子提取詳情的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        sentences: 提取的句子列表
    """
    event = SentenceExtractionDetailEvent(
        event="sentence_extraction_detail",
        file_uuid=file_uuid,
        sentences=sentences,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    logger.debug(f"已發送句子提取詳情事件，共 {len(sentences)} 個句子")


def store_sentences_to_db(
    file_uuid: UUID, 
    user_uuid: UUID, 
    sentences_with_pages: List[Dict[str, Any]]
) -> List[UUID]:
    """
    將提取的句子儲存到資料庫。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        sentences_with_pages: 包含句子和頁碼的字典列表
        
    Returns:
        儲存的句子 UUID 列表
    """
    logger.info(f"開始將 {len(sentences_with_pages)} 個句子儲存到資料庫")
    
    # 創建資料庫會話
    session = SessionLocal()
    sentence_uuids = []
    
    try:
        # 批次插入句子，每批 100 個
        for i in range(0, len(sentences_with_pages), 100):
            batch = sentences_with_pages[i:i+100]
            sentences_to_insert = []
            
            for item in batch:
                # 創建 Sentence 物件
                sentence = Sentence(
                    file_uuid=file_uuid,
                    user_uuid=user_uuid,
                    sentence=item["sentence"],
                    page=item["page"],
                    defining_type=DefiningType.NONE.value  # 初始設為 "none"，等待分類
                )
                sentences_to_insert.append(sentence)
            
            # 插入資料庫
            session.add_all(sentences_to_insert)
            session.flush()  # 僅獲取 UUID，尚未提交
            
            # 收集 UUID
            for sentence in sentences_to_insert:
                sentence_uuids.append(sentence.sentence_uuid)
                
        # 所有批次處理完畢後才提交事務
        session.commit()
        logger.info(f"成功儲存 {len(sentence_uuids)} 個句子到資料庫")
        
        return sentence_uuids
    except Exception as e:
        session.rollback()
        logger.error(f"儲存句子到資料庫時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def classify_sentences(
    file_uuid: str, 
    user_uuid: UUID, 
    sentence_uuids: List[UUID], 
    sentences_with_pages: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    對每個句子調用 n8n API 進行 CD/OD 分類。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        sentence_uuids: 句子 UUID 列表
        sentences_with_pages: 包含句子和頁碼的字典列表
        
    Returns:
        分類結果列表 [{"sentence_uuid": uuid, "defining_type": "cd", "reason": "..."}, ...]
    """
    logger.info(f"開始對 {len(sentences_with_pages)} 個句子進行分類")
    
    # 從設定檔獲取 n8n API URL
    n8n_api_url = settings.N8N_API_URL
    url = f"{n8n_api_url}/api/v1/classify-sentence"
    
    total_sentences = len(sentences_with_pages)
    classification_results = []
    classified_count = 0
    
    # 批次處理句子，每批 10 個
    for i in range(0, total_sentences, 10):
        batch = []
        batch_uuids = []
        
        # 準備批次
        for j in range(i, min(i + 10, total_sentences)):
            batch.append(sentences_with_pages[j])
            batch_uuids.append(sentence_uuids[j])
        
        # 更新進度
        classified_count += len(batch)
        progress = int((classified_count / total_sentences) * 100)
        
        send_sentence_classification_progress_event(
            file_uuid, 
            user_uuid, 
            progress, 
            current=classified_count, 
            total=total_sentences
        )
        
        # 調用 n8n API 進行分類，包含重試邏輯
        batch_results = classify_batch_with_retry(batch, batch_uuids)
        classification_results.extend(batch_results)
        
        # 每完成 10 個句子的分類，發送分類詳情事件
        send_sentence_classification_detail_event(file_uuid, user_uuid, batch_results)
    
    logger.info(f"成功完成 {total_sentences} 個句子的分類")
    return classification_results


def classify_batch_with_retry(
    batch: List[Dict[str, Any]], 
    batch_uuids: List[UUID]
) -> List[Dict[str, Any]]:
    """
    使用重試機制對一批句子進行分類。
    
    Args:
        batch: 包含句子和頁碼的字典列表
        batch_uuids: 對應的 UUID 列表
        
    Returns:
        分類結果列表
    """
    # 從設定檔獲取 n8n API URL
    n8n_api_url = settings.N8N_API_URL
    url = f"{n8n_api_url}/api/v1/classify-sentence"
    
    # 重試設定
    max_retries = 3
    retry_delay = 1  # 初始重試間隔（秒）
    
    for attempt in range(max_retries):
        try:
            # 準備請求資料，只傳送句子內容
            sentences = [item["sentence"] for item in batch]
            payload = {"sentences": sentences}
            
            # 設定超時為 30 秒
            with httpx.Client(timeout=30) as client:
                response = client.post(url, json=payload)
            
            # 檢查回應
            if response.status_code == 200:
                # 獲取結果
                api_results = response.json().get("results", [])
                
                # 確保結果數量匹配
                if len(api_results) != len(batch):
                    logger.warning(f"API 返回的結果數量 ({len(api_results)}) 與請求的句子數量 ({len(batch)}) 不匹配")
                
                # 組合最終結果
                results = []
                for idx, api_result in enumerate(api_results):
                    if idx < len(batch_uuids):
                        result = {
                            "sentence_uuid": batch_uuids[idx],
                            "defining_type": api_result.get("type", "none"),  # 'cd', 'od', 或 'none'
                            "reason": api_result.get("reason", ""),
                            "page": batch[idx]["page"],
                            "sentence": batch[idx]["sentence"]
                        }
                        results.append(result)
                
                return results
            else:
                error_msg = f"n8n API 回應錯誤: {response.status_code}, {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
                
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning(f"調用 n8n API 失敗 (嘗試 {attempt+1}/{max_retries}): {str(e)}")
            
            if attempt < max_retries - 1:
                # 指數退避重試
                wait_time = retry_delay * (2 ** attempt)
                logger.info(f"等待 {wait_time} 秒後重試...")
                time.sleep(wait_time)
            else:
                logger.error("已達最大重試次數，使用預設分類")
                
                # 如果所有重試都失敗，使用預設值
                results = []
                for idx, uuid in enumerate(batch_uuids):
                    result = {
                        "sentence_uuid": uuid,
                        "defining_type": DefiningType.NONE.value,
                        "reason": "分類失敗，使用預設值",
                        "page": batch[idx]["page"],
                        "sentence": batch[idx]["sentence"]
                    }
                    results.append(result)
                    
                # 記錄使用預設值的句子
                logger.warning(f"為以下句子使用預設分類值: {[s['sentence'][:50] + '...' if len(s['sentence']) > 50 else s['sentence'] for s in batch]}")
                return results
    
    # 不應該到達這裡，但以防萬一
    return []


def send_sentence_classification_progress_event(
    file_uuid: str, 
    user_uuid: UUID, 
    progress: int,
    current: int,
    total: int
) -> None:
    """
    發送句子分類進度的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        progress: 進度百分比
        current: 當前處理的句子數
        total: 總句子數
    """
    event = SentenceClassificationProgressEvent(
        event="sentence_classification_progress",
        file_uuid=file_uuid,
        progress=progress,
        current=current,
        total=total,
        status="processing",
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    logger.debug(f"已發送句子分類進度事件: {progress}%")


def send_sentence_classification_detail_event(
    file_uuid: str, 
    user_uuid: UUID, 
    sentences: List[Dict[str, Any]]
) -> None:
    """
    發送句子分類詳情的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        sentences: 已分類的句子列表，包含分類結果
    """
    event = SentenceClassificationDetailEvent(
        event="sentence_classification_detail",
        file_uuid=file_uuid,
        sentences=sentences,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    logger.debug(f"已發送句子分類詳情事件，共 {len(sentences)} 個句子")


def store_classification_results(
    file_uuid: UUID, 
    classification_results: List[Dict[str, Any]]
) -> None:
    """
    將分類結果儲存到資料庫。
    
    Args:
        file_uuid: 檔案 UUID
        classification_results: 分類結果列表
    """
    logger.info(f"開始儲存 {len(classification_results)} 個句子的分類結果")
    
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 將所有需要更新的句子 UUID 收集成列表
        sentence_uuids = [result["sentence_uuid"] for result in classification_results]
        
        # 一次性查詢所有句子，使用 IN 子句
        sentences = session.query(Sentence).filter(
            Sentence.sentence_uuid.in_(sentence_uuids)
        ).all()
        
        # 建立 UUID 到句子對象的映射
        sentence_map = {str(sentence.sentence_uuid): sentence for sentence in sentences}
        
        # 批次更新所有句子
        updated_count = 0
        for result in classification_results:
            sentence_uuid_str = str(result["sentence_uuid"])
            if sentence_uuid_str in sentence_map:
                sentence = sentence_map[sentence_uuid_str]
                sentence.defining_type = result["defining_type"]
                sentence.reason = result["reason"]
                sentence.updated_at = datetime.utcnow()
                updated_count += 1
        
        # 一次性提交所有更新
        session.commit()
        
        logger.info(f"成功儲存 {updated_count} 個分類結果到資料庫")
    except Exception as e:
        session.rollback()
        logger.error(f"儲存分類結果時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def update_file_statistics(file_uuid: UUID) -> None:
    """
    更新檔案的統計資訊，包括句子總數、CD數和OD數。
    
    Args:
        file_uuid: 檔案 UUID
    """
    logger.info(f"開始更新檔案 {file_uuid} 的統計資訊")
    
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 使用單一查詢獲取所有統計資訊
        stats = session.query(
            func.count(Sentence.sentence_uuid).label('total_count'),
            func.sum(case([(Sentence.defining_type == DefiningType.CD.value, 1)], else_=0)).label('cd_count'),
            func.sum(case([(Sentence.defining_type == DefiningType.OD.value, 1)], else_=0)).label('od_count')
        ).filter(Sentence.file_uuid == file_uuid).first()
        
        # 提取統計結果，避免None值
        total_count = stats.total_count or 0
        cd_count = stats.cd_count or 0
        od_count = stats.od_count or 0
        
        # 更新檔案統計資訊
        file = session.query(File).filter(File.file_uuid == file_uuid).first()
        if file:
            file.sentence_count = total_count
            file.cd_count = cd_count
            file.od_count = od_count
            file.updated_at = datetime.utcnow()
            session.commit()
        
        logger.info(
            f"已更新檔案統計資訊: 總句子數={total_count}, CD數={cd_count}, OD數={od_count}"
        )
    except Exception as e:
        session.rollback()
        logger.error(f"更新檔案統計資訊時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def send_processing_completed_event(file_uuid: str, user_uuid: UUID) -> None:
    """
    發送處理完成的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
    """
    event = ProcessingCompletedEvent(
        event="processing_completed",
        file_uuid=file_uuid,
        status="completed",
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    logger.info(f"已發送處理完成事件")


def send_processing_failed_event(file_uuid: str, user_uuid: UUID, error_message: str) -> None:
    """
    發送處理失敗的 WebSocket 事件。
    
    Args:
        file_uuid: 檔案 UUID
        user_uuid: 使用者 UUID
        error_message: 錯誤訊息
    """
    event = ProcessingFailedEvent(
        event="processing_failed",
        file_uuid=file_uuid,
        status="failed",
        error=error_message,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"processing/{file_uuid}", event.dict())
    logger.info(f"已發送處理失敗事件: {error_message}") 