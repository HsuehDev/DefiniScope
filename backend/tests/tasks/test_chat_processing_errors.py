"""
測試聊天處理 Celery 任務的錯誤處理
"""
import uuid
import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.tasks.chat_processing import (
    process_user_query,
    extract_keywords,
    generate_answer
)

# 測試 `extract_keywords` 函數的錯誤處理
@patch("app.tasks.chat_processing.send_keyword_extraction_completed_event")
@patch("httpx.Client")
@patch("time.sleep")
def test_extract_keywords_all_retries_fail(mock_sleep, mock_client, mock_send_event):
    """測試關鍵詞提取的所有重試都失敗的情況"""
    query_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    query_text = "什麼是自適應專業知識？"
    
    # 設置所有 API 調用都超時
    mock_instance = MagicMock()
    mock_instance.__enter__.return_value.post.side_effect = httpx.TimeoutException("Timeout")
    mock_client.return_value = mock_instance
    
    # 執行函數
    keywords = extract_keywords(query_uuid, user_uuid, query_text)
    
    # 驗證結果
    assert keywords == []  # 應該返回空列表
    
    # 驗證重試邏輯
    assert mock_client.call_count == 3  # 應嘗試3次
    assert mock_sleep.call_count == 2  # 應等待2次
    
    # 驗證 WebSocket 事件發送
    mock_send_event.assert_called_once_with(query_uuid, user_uuid, [])

# 測試 `generate_answer` 函數的錯誤處理
@patch("app.tasks.chat_processing.send_answer_generation_started_event")
@patch("app.tasks.chat_processing.send_referenced_sentences_event")
@patch("httpx.Client")
@patch("time.sleep")
def test_generate_answer_all_retries_fail(mock_sleep, mock_client, mock_send_references, mock_send_started):
    """測試答案生成的所有重試都失敗的情況"""
    query_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    query_text = "什麼是自適應專業知識？"
    
    # 設置相關定義
    relevant_definitions = [
        {
            "sentence_uuid": uuid.uuid4(),
            "file_uuid": uuid.uuid4(),
            "sentence": "自適應專業知識是指...",
            "page": 1,
            "defining_type": "cd",
            "reason": "包含定義",
            "original_name": "example.pdf",
            "relevance_score": 0.9
        }
    ]
    
    # 設置所有 API 調用都失敗
    mock_instance = MagicMock()
    mock_instance.__enter__.return_value.post.side_effect = httpx.RequestError("Connection error")
    mock_client.return_value = mock_instance
    
    # 執行函數
    answer, referenced_sentences = generate_answer(query_uuid, user_uuid, query_text, relevant_definitions)
    
    # 驗證結果
    assert "抱歉，生成答案時遇到了技術問題" in answer  # 應該返回預設答案
    assert referenced_sentences == []  # 應該沒有引用句子
    
    # 驗證重試邏輯
    assert mock_client.call_count == 3  # 應嘗試3次
    assert mock_sleep.call_count == 2  # 應等待2次
    
    # 驗證事件發送
    mock_send_started.assert_called_once_with(query_uuid, user_uuid)
    mock_send_references.assert_called_once_with(query_uuid, user_uuid, relevant_definitions[:10])

# 測試 `process_user_query` 任務的錯誤處理
@patch("app.tasks.chat_processing.send_query_processing_started_event")
@patch("app.tasks.chat_processing.extract_keywords")
@patch("app.tasks.chat_processing.send_query_failed_event")
def test_process_user_query_error_handling(mock_send_failed, mock_extract_keywords, mock_send_started):
    """測試查詢處理過程中發生錯誤時的處理"""
    query_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())
    conversation_uuid = str(uuid.uuid4())
    query_text = "什麼是自適應專業知識？"
    
    # 模擬 extract_keywords 拋出異常
    mock_extract_keywords.side_effect = Exception("API error")
    
    # 調用任務，應該拋出例外
    with pytest.raises(Exception) as exc_info:
        process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
    
    # 驗證錯誤處理
    assert "API error" in str(exc_info.value)
    mock_send_started.assert_called_once_with(query_uuid, uuid.UUID(user_uuid))
    mock_send_failed.assert_called_once()  # 應該嘗試發送失敗事件

# 測試當沒有找到關鍵詞的情況
@patch("app.tasks.chat_processing.send_query_processing_started_event")
@patch("app.tasks.chat_processing.store_user_query")
@patch("app.tasks.chat_processing.extract_keywords")
@patch("app.tasks.chat_processing.store_answer")
@patch("app.tasks.chat_processing.send_query_completed_event")
def test_process_user_query_no_keywords(
    mock_send_completed, mock_store_answer, mock_extract_keywords,
    mock_store_query, mock_send_started
):
    """測試當沒有找到關鍵詞時的處理"""
    query_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())
    conversation_uuid = str(uuid.uuid4())
    query_text = "..."  # 無意義查詢
    
    # 模擬沒有找到關鍵詞
    mock_extract_keywords.return_value = []
    
    # 執行任務
    result = process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
    
    # 驗證提示消息被儲存
    assert mock_store_answer.call_count == 1
    args, _ = mock_store_answer.call_args
    assert "抱歉，我無法從您的問題中提取到關鍵詞" in args[3]
    
    # 驗證任務結果
    assert result["status"] == "success"
    assert result["keywords"] == []

# 測試當沒有找到相關定義的情況
@patch("app.tasks.chat_processing.send_query_processing_started_event")
@patch("app.tasks.chat_processing.store_user_query")
@patch("app.tasks.chat_processing.extract_keywords")
@patch("app.tasks.chat_processing.search_database")
@patch("app.tasks.chat_processing.store_answer")
@patch("app.tasks.chat_processing.send_query_completed_event")
def test_process_user_query_no_definitions(
    mock_send_completed, mock_store_answer, mock_search_database,
    mock_extract_keywords, mock_store_query, mock_send_started
):
    """測試當找到關鍵詞但沒有相關定義時的處理"""
    query_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())
    conversation_uuid = str(uuid.uuid4())
    query_text = "什麼是自適應專業知識？"
    
    # 模擬找到關鍵詞但沒有相關定義
    mock_extract_keywords.return_value = ["自適應專業知識"]
    mock_search_database.return_value = []
    
    # 執行任務
    result = process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
    
    # 驗證提示消息被儲存
    assert mock_store_answer.call_count == 1
    args, _ = mock_store_answer.call_args
    assert "找不到與" in args[3]
    assert "自適應專業知識" in args[3]
    
    # 驗證任務結果
    assert result["status"] == "success"
    assert result["keywords"] == ["自適應專業知識"]
    assert result["definitions_found"] == 0 