"""
測試聊天處理 Celery 任務
"""
import uuid
import pytest
from unittest.mock import patch, MagicMock, call
from datetime import datetime

from app.tasks.chat_processing import (
    process_user_query, 
    extract_keywords,
    search_database,
    generate_answer
)

# 模擬資料庫會話和 WebSocket 管理器
@pytest.fixture
def mock_session():
    with patch("app.tasks.chat_processing.SessionLocal") as mock_session_factory:
        mock_session = MagicMock()
        mock_session_factory.return_value = mock_session
        yield mock_session

@pytest.fixture
def mock_ws_manager():
    with patch("app.tasks.chat_processing.ws_manager") as mock_ws:
        yield mock_ws

# 模擬 httpx 客戶端的響應
@pytest.fixture
def mock_httpx_client():
    with patch("httpx.Client") as mock_client:
        mock_instance = MagicMock()
        # 創建一個預設成功響應
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}  # 預設回傳空字典，將在測試中具體設置
        
        # 設置客戶端實例返回這個響應
        mock_instance.__enter__.return_value.post.return_value = mock_response
        mock_client.return_value = mock_instance
        
        yield mock_client, mock_response

# 測試 `extract_keywords` 函數
@patch("app.tasks.chat_processing.send_keyword_extraction_completed_event")
@patch("time.sleep")
def test_extract_keywords_success(mock_sleep, mock_send_event, mock_httpx_client):
    """測試成功提取關鍵詞"""
    mock_client, mock_response = mock_httpx_client
    query_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    query_text = "什麼是自適應專業知識？"
    
    # 設置模擬返回值
    mock_response.json.return_value = {
        "keywords": ["自適應專業知識", "專業知識"]
    }
    
    # 執行函數
    keywords = extract_keywords(query_uuid, user_uuid, query_text)
    
    # 驗證結果
    assert len(keywords) == 2
    assert "自適應專業知識" in keywords
    assert "專業知識" in keywords
    
    # 驗證 WebSocket 事件發送
    mock_send_event.assert_called_once_with(query_uuid, user_uuid, keywords)

# 測試 `search_database` 函數
@patch("app.tasks.chat_processing.send_database_search_progress_event")
@patch("app.tasks.chat_processing.send_database_search_result_event")
def test_search_database(mock_send_result, mock_send_progress, mock_session):
    """測試資料庫搜尋功能"""
    query_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    keywords = ["自適應專業知識"]
    
    # 模擬資料庫查詢結果
    mock_sentence = MagicMock()
    mock_sentence.sentence_uuid = uuid.uuid4()
    mock_sentence.file_uuid = uuid.uuid4()
    mock_sentence.sentence = "自適應專業知識是指..."
    mock_sentence.page = 1
    mock_sentence.defining_type = "cd"
    mock_sentence.reason = "包含明確定義"
    
    # 模擬檔案名查詢結果
    file_name_result = "example.pdf"
    
    # 設置模擬返回值
    mock_session.execute.return_value.scalars.return_value.all.return_value = [mock_sentence]
    mock_session.execute.return_value.scalar_one_or_none.return_value = file_name_result
    
    # 執行函數
    with patch("app.tasks.chat_processing.select") as mock_select:
        result = search_database(query_uuid, user_uuid, keywords)
    
    # 驗證結果
    assert len(result) == 1
    assert result[0]["sentence"] == "自適應專業知識是指..."
    assert result[0]["defining_type"] == "cd"
    assert result[0]["original_name"] == "example.pdf"
    
    # 驗證進度和結果事件發送
    assert mock_send_progress.call_count >= 2  # 至少調用了兩次（中間和最終進度）
    mock_send_result.assert_called_once()  # 應該發送了一次結果事件

# 測試 `generate_answer` 函數
@patch("app.tasks.chat_processing.send_answer_generation_started_event")
@patch("app.tasks.chat_processing.send_referenced_sentences_event")
@patch("time.sleep")
def test_generate_answer_success(mock_sleep, mock_send_references, mock_send_started, mock_httpx_client):
    """測試成功生成答案"""
    mock_client, mock_response = mock_httpx_client
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
    
    # 設置模擬返回值
    mock_response.json.return_value = {
        "answer": "自適應專業知識是一種...",
        "references": [{"index": 0}]
    }
    
    # 執行函數
    answer, referenced_sentences = generate_answer(query_uuid, user_uuid, query_text, relevant_definitions)
    
    # 驗證結果
    assert answer == "自適應專業知識是一種..."
    assert len(referenced_sentences) == 1
    assert referenced_sentences[0] == relevant_definitions[0]
    
    # 驗證事件發送
    mock_send_started.assert_called_once_with(query_uuid, user_uuid)
    mock_send_references.assert_called_once_with(query_uuid, user_uuid, relevant_definitions[:10])

# 測試 `process_user_query` 任務
@patch("app.tasks.chat_processing.send_query_processing_started_event")
@patch("app.tasks.chat_processing.create_new_conversation")
@patch("app.tasks.chat_processing.store_user_query")
@patch("app.tasks.chat_processing.extract_keywords")
@patch("app.tasks.chat_processing.search_database")
@patch("app.tasks.chat_processing.generate_answer")
@patch("app.tasks.chat_processing.store_answer")
@patch("app.tasks.chat_processing.update_conversation")
@patch("app.tasks.chat_processing.send_query_completed_event")
def test_process_user_query_success(
    mock_send_completed, mock_update_conversation, mock_store_answer,
    mock_generate_answer, mock_search_database, mock_extract_keywords,
    mock_store_query, mock_create_conversation, mock_send_started
):
    """測試查詢處理任務的完整流程"""
    # 設置測試數據
    query_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())
    conversation_uuid = str(uuid.uuid4())
    query_text = "什麼是自適應專業知識？"
    
    # 設置模擬回傳值
    mock_extract_keywords.return_value = ["自適應專業知識"]
    
    relevant_definitions = [{
        "sentence_uuid": uuid.uuid4(),
        "sentence": "自適應專業知識是指...",
        "defining_type": "cd"
    }]
    mock_search_database.return_value = relevant_definitions
    
    mock_generate_answer.return_value = ("這是答案", relevant_definitions)
    
    message_uuid = uuid.uuid4()
    mock_store_answer.return_value = message_uuid
    
    # 執行任務
    result = process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
    
    # 驗證流程
    mock_send_started.assert_called_once_with(query_uuid, uuid.UUID(user_uuid))
    mock_store_query.assert_called_once()
    mock_extract_keywords.assert_called_once_with(query_uuid, uuid.UUID(user_uuid), query_text)
    mock_search_database.assert_called_once_with(query_uuid, uuid.UUID(user_uuid), ["自適應專業知識"])
    mock_generate_answer.assert_called_once_with(query_uuid, uuid.UUID(user_uuid), query_text, relevant_definitions)
    mock_store_answer.assert_called_once_with(
        uuid.UUID(query_uuid), 
        uuid.UUID(user_uuid), 
        uuid.UUID(conversation_uuid), 
        "這是答案", 
        relevant_definitions
    )
    mock_update_conversation.assert_called_once_with(uuid.UUID(conversation_uuid), query_text)
    mock_send_completed.assert_called_once_with(query_uuid, uuid.UUID(user_uuid))
    
    # 驗證任務結果
    assert result["status"] == "success"
    assert result["query_uuid"] == query_uuid
    assert result["conversation_uuid"] == conversation_uuid
    assert result["message_uuid"] == str(message_uuid)
    assert result["keywords"] == ["自適應專業知識"]
    assert result["definitions_found"] == len(relevant_definitions) 