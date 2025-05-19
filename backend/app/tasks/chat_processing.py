"""
聊天處理任務
包含用戶查詢處理相關的 Celery 任務，如關鍵詞提取、資料庫搜尋、答案生成等
"""
import logging
import time
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union, Set
from uuid import UUID
import uuid

import httpx
from sqlalchemy import select, update, insert, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.worker import celery
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.db.session import SessionLocal
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.message_reference import MessageReference
from app.models.sentence import Sentence, DefiningType
from app.schemas.websocket import (
    QueryProcessingStartedEvent,
    KeywordExtractionCompletedEvent,
    DatabaseSearchProgressEvent,
    DatabaseSearchResultEvent,
    AnswerGenerationStartedEvent,
    ReferencedSentencesEvent,
    QueryCompletedEvent,
    QueryFailedEvent
)

# 設定日誌
logger = logging.getLogger(__name__)

# WebSocket 管理器實例
ws_manager = WebSocketManager()

@celery.task(
    name="process_user_query",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True
)
def process_user_query(self, query_uuid: str, conversation_uuid: Optional[str], user_uuid: str, query_text: str) -> Dict[str, Any]:
    """
    處理用戶查詢的 Celery 任務。
    
    處理流程包括：
    1. 關鍵詞提取：調用 n8n API 提取查詢中的關鍵詞
    2. 資料庫搜尋：根據關鍵詞搜尋相關的概念定義句子
    3. 答案生成：調用 n8n API 根據相關句子生成回答
    4. 儲存回答及引用：將系統回答和相關引用保存到資料庫
    
    每個主要步驟都會通過 WebSocket 向前端發送進度更新。
    
    Args:
        query_uuid: 查詢 UUID
        conversation_uuid: 對話 UUID (可選，如果沒有則創建新對話)
        user_uuid: 使用者 UUID
        query_text: 使用者查詢內容
        
    Returns:
        包含處理結果的字典
    """
    try:
        # 將字符串轉換為 UUID 物件
        user_uuid_obj = UUID(user_uuid)
        query_uuid_obj = UUID(query_uuid)
        conversation_uuid_obj = UUID(conversation_uuid) if conversation_uuid else None
        
        # 發送處理開始事件
        send_query_processing_started_event(query_uuid, user_uuid_obj)
        
        # 如果沒有提供對話 ID，則創建新對話
        if not conversation_uuid_obj:
            conversation_uuid_obj = create_new_conversation(user_uuid_obj, query_text)
            conversation_uuid = str(conversation_uuid_obj)
        
        # 儲存使用者查詢到資料庫
        store_user_query(query_uuid_obj, user_uuid_obj, conversation_uuid_obj, query_text)
        
        # 步驟 1: 關鍵詞提取 (調用 n8n API)
        keywords = extract_keywords(query_uuid, user_uuid_obj, query_text)
        
        # 如果沒有有效關鍵詞，返回適當提示
        if not keywords:
            answer = "抱歉，我無法從您的問題中提取到關鍵詞。請嘗試用更具體的術語或概念來提問。"
            store_answer(query_uuid_obj, user_uuid_obj, conversation_uuid_obj, answer, [])
            send_query_completed_event(query_uuid, user_uuid_obj)
            return {
                "status": "success",
                "query_uuid": query_uuid,
                "conversation_uuid": conversation_uuid,
                "keywords": []
            }
        
        # 步驟 2: 資料庫搜尋
        relevant_definitions = search_database(query_uuid, user_uuid_obj, keywords)
        
        # 如果沒有找到相關定義，返回適當提示
        if not relevant_definitions:
            answer = f"抱歉，我在資料庫中找不到與 {', '.join(keywords)} 相關的概念定義。請嘗試使用其他關鍵詞或上傳包含這些概念的文檔。"
            store_answer(query_uuid_obj, user_uuid_obj, conversation_uuid_obj, answer, [])
            send_query_completed_event(query_uuid, user_uuid_obj)
            return {
                "status": "success",
                "query_uuid": query_uuid,
                "conversation_uuid": conversation_uuid,
                "keywords": keywords,
                "definitions_found": 0
            }
        
        # 步驟 3: 答案生成 (調用 n8n API)
        answer, referenced_sentences = generate_answer(query_uuid, user_uuid_obj, query_text, relevant_definitions)
        
        # 步驟 4: 儲存回答及引用
        message_uuid = store_answer(query_uuid_obj, user_uuid_obj, conversation_uuid_obj, answer, referenced_sentences)
        
        # 更新對話的最後活動時間和標題
        update_conversation(conversation_uuid_obj, query_text)
        
        # 發送處理完成事件
        send_query_completed_event(query_uuid, user_uuid_obj)
        
        return {
            "status": "success",
            "query_uuid": query_uuid,
            "conversation_uuid": conversation_uuid,
            "message_uuid": str(message_uuid),
            "keywords": keywords,
            "definitions_found": len(relevant_definitions)
        }
        
    except Exception as e:
        # 記錄錯誤
        logger.error(f"處理查詢 {query_uuid} 時發生錯誤: {str(e)}", exc_info=True)
        
        # 嘗試發送處理失敗事件
        try:
            send_query_failed_event(query_uuid, user_uuid_obj, str(e))
        except Exception as ws_err:
            logger.error(f"發送失敗事件時發生錯誤: {str(ws_err)}")
        
        # 重新拋出異常，讓 Celery 處理重試邏輯
        raise


def send_query_processing_started_event(query_uuid: str, user_uuid: UUID) -> None:
    """
    發送查詢處理開始的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
    """
    event = QueryProcessingStartedEvent(
        event="query_processing_started",
        query_uuid=query_uuid,
        status="processing",
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.info(f"已發送查詢處理開始事件: {event.dict()}")


def create_new_conversation(user_uuid: UUID, query_text: str) -> UUID:
    """
    創建新的對話。
    
    Args:
        user_uuid: 使用者 UUID
        query_text: 使用者查詢內容
    
    Returns:
        對話 UUID
    """
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 從查詢中提取適合作為標題的部分
        title = query_text[:50] + "..." if len(query_text) > 50 else query_text
        
        # 創建新對話
        conversation = Conversation(
            user_uuid=user_uuid,
            title=title,
            last_message_at=datetime.utcnow()
        )
        
        session.add(conversation)
        session.commit()
        
        logger.info(f"已為使用者 {user_uuid} 創建新對話，UUID: {conversation.conversation_uuid}")
        
        return conversation.conversation_uuid
    except Exception as e:
        session.rollback()
        logger.error(f"創建新對話時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def store_user_query(query_uuid: UUID, user_uuid: UUID, conversation_uuid: UUID, query_text: str) -> None:
    """
    將使用者查詢儲存到資料庫。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        conversation_uuid: 對話 UUID
        query_text: 使用者查詢內容
    """
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 創建消息記錄
        message = Message(
            message_uuid=query_uuid,  # 使用查詢 UUID 作為消息 UUID
            conversation_uuid=conversation_uuid,
            user_uuid=user_uuid,
            role="user",
            content=query_text
        )
        
        session.add(message)
        session.commit()
        
        logger.info(f"已儲存使用者查詢，UUID: {query_uuid}")
    except Exception as e:
        session.rollback()
        logger.error(f"儲存使用者查詢時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def extract_keywords(query_uuid: str, user_uuid: UUID, query_text: str) -> List[str]:
    """
    從查詢中提取關鍵詞，調用 n8n API。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        query_text: 使用者查詢內容
    
    Returns:
        提取的關鍵詞列表
    """
    logger.info(f"開始從查詢 {query_uuid} 中提取關鍵詞")
    
    # 從設定檔獲取 n8n API URL
    n8n_api_url = settings.N8N_API_URL
    url = f"{n8n_api_url}/api/v1/extract-keywords"
    
    # 重試設定
    max_retries = 3
    retry_delay = 1  # 初始重試間隔（秒）
    
    for attempt in range(max_retries):
        try:
            # 準備請求資料
            payload = {"query": query_text}
            
            # 設定超時為 30 秒
            with httpx.Client(timeout=30) as client:
                response = client.post(url, json=payload)
            
            # 檢查回應
            if response.status_code == 200:
                # 獲取結果
                result = response.json()
                keywords = result.get("keywords", [])
                
                # 發送關鍵詞提取完成事件
                send_keyword_extraction_completed_event(query_uuid, user_uuid, keywords)
                
                logger.info(f"成功從查詢 {query_uuid} 中提取了 {len(keywords)} 個關鍵詞")
                return keywords
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
                logger.error("已達最大重試次數，返回空關鍵詞列表")
                
                # 發送空關鍵詞提取完成事件
                send_keyword_extraction_completed_event(query_uuid, user_uuid, [])
                
                return []
    
    # 不應該到達這裡，但以防萬一
    return []


def send_keyword_extraction_completed_event(query_uuid: str, user_uuid: UUID, keywords: List[str]) -> None:
    """
    發送關鍵詞提取完成的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        keywords: 提取的關鍵詞列表
    """
    event = KeywordExtractionCompletedEvent(
        event="keyword_extraction_completed",
        query_uuid=query_uuid,
        keywords=keywords,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.debug(f"已發送關鍵詞提取完成事件: {keywords}")


def search_database(query_uuid: str, user_uuid: UUID, keywords: List[str]) -> List[Dict[str, Any]]:
    """
    根據關鍵詞搜尋資料庫中的相關定義。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        keywords: 關鍵詞列表
    
    Returns:
        相關定義句子的列表
    """
    logger.info(f"開始使用關鍵詞 {keywords} 搜尋資料庫")
    
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        all_relevant_definitions = []
        found_definitions = {"cd": 0, "od": 0}
        total_keywords = len(keywords)
        
        # 對每個關鍵詞進行搜尋
        for idx, keyword in enumerate(keywords):
            # 更新進度
            progress = int(((idx + 0.5) / total_keywords) * 100)
            send_database_search_progress_event(
                query_uuid, 
                user_uuid,
                keywords, 
                progress, 
                f"正在搜尋與 '{keyword}' 相關的定義",
                found_definitions
            )
            
            # 使用全文搜尋和相關性排序
            from sqlalchemy import func, text
            
            # 準備全文搜尋查詢
            # 注意: 這裡假設已經在資料庫中創建了全文搜尋索引
            search_query = text("""
                SELECT s.sentence_uuid, s.file_uuid, s.sentence, s.page, s.defining_type, s.reason,
                       f.original_name,
                       ts_rank(to_tsvector('chinese', s.sentence), plainto_tsquery('chinese', :keyword)) AS relevance_score
                FROM sentences s
                JOIN files f ON s.file_uuid = f.file_uuid
                WHERE s.user_uuid = :user_uuid
                    AND s.defining_type IN ('cd', 'od')
                    AND to_tsvector('chinese', s.sentence) @@ plainto_tsquery('chinese', :keyword)
                ORDER BY relevance_score DESC
                LIMIT 20
            """)
            
            results = session.execute(search_query, {
                "user_uuid": str(user_uuid),
                "keyword": keyword
            }).fetchall()
            
            # 轉換結果為字典
            relevant_definitions = []
            for row in results:
                definition = {
                    "sentence_uuid": row.sentence_uuid,
                    "file_uuid": row.file_uuid,
                    "sentence": row.sentence,
                    "page": row.page,
                    "defining_type": row.defining_type,
                    "reason": row.reason,
                    "original_name": row.original_name,
                    "relevance_score": float(row.relevance_score)
                }
                relevant_definitions.append(definition)
            
            # 計算找到的 CD 和 OD 數量
            found_definitions["cd"] += len([d for d in relevant_definitions if d["defining_type"] == "cd"])
            found_definitions["od"] += len([d for d in relevant_definitions if d["defining_type"] == "od"])
            
            # 發送搜尋結果事件
            send_database_search_result_event(query_uuid, user_uuid, keyword, relevant_definitions)
            
            # 添加到總結果列表
            all_relevant_definitions.extend(relevant_definitions)
            
            # 更新最終進度
            progress = int(((idx + 1) / total_keywords) * 100)
            send_database_search_progress_event(
                query_uuid, 
                user_uuid,
                keywords, 
                progress, 
                f"已完成 '{keyword}' 的搜尋",
                found_definitions
            )
        
        # 去除重複項
        unique_definitions = []
        seen_uuids = set()
        
        for definition in all_relevant_definitions:
            uuid_str = str(definition["sentence_uuid"])
            if uuid_str not in seen_uuids:
                seen_uuids.add(uuid_str)
                unique_definitions.append(definition)
        
        # 按相關性排序
        unique_definitions.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        logger.info(f"成功找到 {len(unique_definitions)} 個相關定義")
        return unique_definitions
    
    except Exception as e:
        logger.error(f"搜尋資料庫時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def send_database_search_progress_event(
    query_uuid: str, 
    user_uuid: UUID,
    keywords: List[str],
    progress: int,
    current_step: str,
    found_definitions: Dict[str, int]
) -> None:
    """
    發送資料庫搜尋進度的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        keywords: 關鍵詞列表
        progress: 進度百分比
        current_step: 當前步驟描述
        found_definitions: 找到的定義統計
    """
    event = DatabaseSearchProgressEvent(
        event="database_search_progress",
        query_uuid=query_uuid,
        keywords=keywords,
        progress=progress,
        current_step=current_step,
        found_definitions=found_definitions,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.debug(f"已發送資料庫搜尋進度事件: {progress}%")


def send_database_search_result_event(
    query_uuid: str, 
    user_uuid: UUID,
    keyword: str,
    found_sentences: List[Dict[str, Any]]
) -> None:
    """
    發送資料庫搜尋結果的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        keyword: 當前關鍵詞
        found_sentences: 找到的句子列表
    """
    event = DatabaseSearchResultEvent(
        event="database_search_result",
        query_uuid=query_uuid,
        keyword=keyword,
        found_sentences=found_sentences,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.debug(f"已發送資料庫搜尋結果事件，共 {len(found_sentences)} 個句子")


def generate_answer(
    query_uuid: str, 
    user_uuid: UUID, 
    query_text: str, 
    relevant_definitions: List[Dict[str, Any]]
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    使用 n8n API 生成答案。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        query_text: 使用者查詢內容
        relevant_definitions: 相關定義列表
    
    Returns:
        (生成的答案, 被引用的句子列表)
    """
    logger.info(f"開始為查詢 {query_uuid} 生成答案")
    
    # 發送答案生成開始事件
    send_answer_generation_started_event(query_uuid, user_uuid)
    
    # 選擇最相關的定義（最多10個）
    top_definitions = relevant_definitions[:10]
    
    # 發送參考句子事件
    send_referenced_sentences_event(query_uuid, user_uuid, top_definitions)
    
    # 從設定檔獲取 n8n API URL
    n8n_api_url = settings.N8N_API_URL
    url = f"{n8n_api_url}/api/v1/generate-answer"
    
    # 重試設定
    max_retries = 3
    retry_delay = 1  # 初始重試間隔（秒）
    
    for attempt in range(max_retries):
        try:
            # 準備請求資料
            payload = {
                "query": query_text,
                "definitions": [
                    {
                        "text": definition["sentence"],
                        "type": definition["defining_type"],
                        "file": definition["original_name"],
                        "page": definition["page"]
                    }
                    for definition in top_definitions
                ]
            }
            
            # 設定超時為 60 秒（答案生成可能需要更長時間）
            with httpx.Client(timeout=60) as client:
                response = client.post(url, json=payload)
            
            # 檢查回應
            if response.status_code == 200:
                # 獲取結果
                result = response.json()
                answer = result.get("answer", "")
                references = result.get("references", [])
                
                # 將參考轉換為句子參考格式
                referenced_sentences = []
                referenced_indices = set()
                
                for ref in references:
                    idx = ref.get("index")
                    if idx is not None and 0 <= idx < len(top_definitions):
                        if idx not in referenced_indices:
                            referenced_indices.add(idx)
                            referenced_sentences.append(top_definitions[idx])
                
                logger.info(f"成功為查詢 {query_uuid} 生成答案，引用了 {len(referenced_sentences)} 個句子")
                return answer, referenced_sentences
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
                logger.error("已達最大重試次數，使用預設答案")
                
                # 如果所有重試都失敗，使用預設答案
                answer = "抱歉，生成答案時遇到了技術問題。根據您的問題，我找到了一些相關的定義，但無法組合成完整的回答。請稍後再試或重新表述您的問題。"
                return answer, []
    
    # 不應該到達這裡，但以防萬一
    return "系統處理錯誤，請稍後再試。", []


def send_answer_generation_started_event(query_uuid: str, user_uuid: UUID) -> None:
    """
    發送答案生成開始的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
    """
    event = AnswerGenerationStartedEvent(
        event="answer_generation_started",
        query_uuid=query_uuid,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.debug(f"已發送答案生成開始事件")


def send_referenced_sentences_event(
    query_uuid: str, 
    user_uuid: UUID,
    referenced_sentences: List[Dict[str, Any]]
) -> None:
    """
    發送參考句子的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        referenced_sentences: 參考句子列表
    """
    event = ReferencedSentencesEvent(
        event="referenced_sentences",
        query_uuid=query_uuid,
        referenced_sentences=referenced_sentences,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.debug(f"已發送參考句子事件，共 {len(referenced_sentences)} 個句子")


def store_answer(
    query_uuid: UUID, 
    user_uuid: UUID, 
    conversation_uuid: UUID, 
    answer: str,
    referenced_sentences: List[Dict[str, Any]]
) -> UUID:
    """
    將系統回答及引用儲存到資料庫。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        conversation_uuid: 對話 UUID
        answer: 系統生成的回答
        referenced_sentences: 被引用的句子列表
    
    Returns:
        消息 UUID
    """
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 創建系統回答消息 - 使用標準的 UUID 生成方法
        message_uuid = uuid.uuid4()
        message = Message(
            message_uuid=message_uuid,
            conversation_uuid=conversation_uuid,
            user_uuid=user_uuid,
            role="assistant",
            content=answer
        )
        
        session.add(message)
        session.flush()  # 確保獲得 message_uuid
        
        # 儲存引用關聯
        for sentence in referenced_sentences:
            reference = MessageReference(
                message_uuid=message_uuid,
                sentence_uuid=sentence["sentence_uuid"]
            )
            session.add(reference)
        
        session.commit()
        
        logger.info(f"已儲存系統回答及 {len(referenced_sentences)} 個引用")
        return message_uuid
    
    except Exception as e:
        session.rollback()
        logger.error(f"儲存回答時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def update_conversation(conversation_uuid: UUID, query_text: str) -> None:
    """
    更新對話的最後活動時間和標題。
    
    Args:
        conversation_uuid: 對話 UUID
        query_text: 使用者查詢內容，用於更新標題
    """
    # 創建資料庫會話
    session = SessionLocal()
    
    try:
        # 查詢對話 - 使用同步模式
        conversation = session.query(Conversation).filter(
            Conversation.conversation_uuid == conversation_uuid
        ).first()
        
        if conversation:
            # 只在對話沒有自定義標題時更新標題
            if conversation.title == "新對話":
                # 從查詢中提取適合作為標題的部分
                title = query_text[:50] + "..." if len(query_text) > 50 else query_text
                conversation.title = title
            
            # 始終更新最後消息時間
            conversation.last_message_at = datetime.utcnow()
            session.commit()
            logger.info(f"已更新對話 {conversation_uuid} 的信息")
    
    except Exception as e:
        session.rollback()
        logger.error(f"更新對話信息時發生錯誤: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def send_query_completed_event(query_uuid: str, user_uuid: UUID) -> None:
    """
    發送查詢處理完成的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
    """
    event = QueryCompletedEvent(
        event="query_completed",
        query_uuid=query_uuid,
        status="completed",
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.info(f"已發送查詢處理完成事件")


def send_query_failed_event(query_uuid: str, user_uuid: UUID, error_message: str) -> None:
    """
    發送查詢處理失敗的 WebSocket 事件。
    
    Args:
        query_uuid: 查詢 UUID
        user_uuid: 使用者 UUID
        error_message: 錯誤訊息
    """
    event = QueryFailedEvent(
        event="query_failed",
        query_uuid=query_uuid,
        status="failed",
        error=error_message,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # 發送到特定使用者的 WebSocket 連接
    ws_manager.send_message_to_user(str(user_uuid), f"chat/{query_uuid}", event.dict())
    logger.info(f"已發送查詢處理失敗事件: {error_message}") 