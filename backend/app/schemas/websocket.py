"""
WebSocket 事件模型
用於 WebSocket 訊息的格式化和驗證
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class BaseEvent(BaseModel):
    """
    WebSocket 事件基礎模型
    """
    event: str
    timestamp: str


class ProcessingStartedEvent(BaseEvent):
    """
    處理開始事件
    """
    event: str = "processing_started"
    file_uuid: str
    status: str = "processing"


class PdfExtractionProgressEvent(BaseEvent):
    """
    PDF 提取進度事件
    """
    event: str = "pdf_extraction_progress"
    file_uuid: str
    progress: int  # 百分比 0-100
    status: str


class SentenceExtractionDetailEvent(BaseEvent):
    """
    句子提取詳情事件
    """
    event: str = "sentence_extraction_detail"
    file_uuid: str
    sentences: List[Dict[str, Any]]  # [{sentence: "...", page: 1}, ...]


class SentenceClassificationProgressEvent(BaseEvent):
    """
    句子分類進度事件
    """
    event: str = "sentence_classification_progress"
    file_uuid: str
    progress: int  # 百分比 0-100
    current: int
    total: int
    status: str


class SentenceClassificationDetailEvent(BaseEvent):
    """
    句子分類詳情事件
    """
    event: str = "sentence_classification_detail"
    file_uuid: str
    sentences: List[Dict[str, Any]]  # [{sentence_uuid: "...", sentence: "...", defining_type: "cd", reason: "...", page: 1}, ...]


class ProcessingCompletedEvent(BaseEvent):
    """
    處理完成事件
    """
    event: str = "processing_completed"
    file_uuid: str
    status: str = "completed"


class ProcessingFailedEvent(BaseEvent):
    """
    處理失敗事件
    """
    event: str = "processing_failed"
    file_uuid: str
    status: str = "failed"
    error: str


# 聊天相關事件
class QueryProcessingStartedEvent(BaseEvent):
    """
    查詢處理開始事件
    """
    event: str = "query_processing_started"
    query_uuid: str
    status: str = "processing"


class KeywordExtractionCompletedEvent(BaseEvent):
    """
    關鍵詞提取完成事件
    """
    event: str = "keyword_extraction_completed"
    query_uuid: str
    keywords: List[str]


class DatabaseSearchProgressEvent(BaseEvent):
    """
    資料庫搜尋進度事件
    """
    event: str = "database_search_progress"
    query_uuid: str
    keywords: List[str]
    progress: int
    current_step: str
    found_definitions: Dict[str, int]  # {"cd": 3, "od": 2}


class DatabaseSearchResultEvent(BaseEvent):
    """
    資料庫搜尋結果事件
    """
    event: str = "database_search_result"
    query_uuid: str
    keyword: str
    found_sentences: List[Dict[str, Any]]


class AnswerGenerationStartedEvent(BaseEvent):
    """
    答案生成開始事件
    """
    event: str = "answer_generation_started"
    query_uuid: str


class ReferencedSentencesEvent(BaseEvent):
    """
    參考句子事件
    """
    event: str = "referenced_sentences"
    query_uuid: str
    referenced_sentences: List[Dict[str, Any]]


class QueryCompletedEvent(BaseEvent):
    """
    查詢處理完成事件
    """
    event: str = "query_completed"
    query_uuid: str
    status: str = "completed"


class QueryFailedEvent(BaseEvent):
    """
    查詢處理失敗事件
    """
    event: str = "query_failed"
    query_uuid: str
    status: str = "failed"
    error: str 