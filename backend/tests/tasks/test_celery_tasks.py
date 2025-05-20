"""
測試 Celery 任務
此測試文件專注於測試 Celery 任務的核心邏輯，使用模擬的依賴項
"""
import uuid
import tempfile
import pytest
from unittest.mock import patch, MagicMock, call, ANY
from datetime import datetime
import os
import sys

# 模擬依賴模組
sys.modules['minio.select.options'] = MagicMock()
sys.modules['app.core.minio_client'] = MagicMock()
sys.modules['app.core.minio_client.download_file'] = MagicMock()
sys.modules['app.utils.redis_publisher'] = MagicMock()

from app.core.config import settings

# 單元測試：模擬文件處理任務的組件
class TestFileProcessing:
    """文件處理任務組件測試"""
    
    @patch("app.tasks.file_processing.update_file_processing_status")
    @patch("app.tasks.file_processing.extract_text_from_pdf")
    @patch("app.tasks.file_processing.process_sentences")
    @patch("app.tasks.file_processing.ws_manager")
    @patch("app.tasks.file_processing.SessionLocal")
    def test_process_uploaded_file_success(
        self, mock_session_local, mock_ws_manager, mock_process_sentences, 
        mock_extract_text, mock_update_status
    ):
        """測試文件處理任務成功的情況"""
        # 手動導入以避免初始化問題
        from app.tasks.file_processing import process_uploaded_file
        
        # 設置測試數據
        file_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        
        # 模擬資料庫會話和檔案記錄
        mock_session = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        # 模擬數據庫中的檔案
        mock_file = MagicMock()
        mock_file.file_uuid = uuid.UUID(file_uuid)
        mock_file.user_uuid = uuid.UUID(user_uuid)
        mock_file.original_name = "test.pdf"
        mock_file.status = "pending"
        
        # 模擬資料庫查詢
        mock_session.query.return_value.filter.return_value.first.return_value = mock_file
        
        # 模擬 PDF 文本提取結果
        mock_sentences = [
            {"sentence": "這是第一個句子", "page": 1},
            {"sentence": "這是第二個句子", "page": 1},
            {"sentence": "這是第三個句子", "page": 2}
        ]
        mock_extract_text.return_value = mock_sentences
        
        # 模擬句子處理結果
        mock_process_sentences.return_value = 3
        
        # 執行任務
        result = process_uploaded_file(file_uuid)
        
        # 驗證結果
        assert result["status"] == "success"
        assert result["file_uuid"] == file_uuid
        assert result["sentence_count"] == 3
        
        # 驗證子函數調用
        mock_extract_text.assert_called_once_with(file_uuid, mock_file, ANY)
        mock_process_sentences.assert_called_once_with(file_uuid, mock_sentences, mock_file.user_uuid, mock_session)
        
        # 驗證處理狀態更新
        mock_update_status.assert_called()
        
        # 驗證 WebSocket 進度通知
        assert mock_ws_manager.send_message_to_user.call_count >= 2
    
    @patch("app.tasks.file_processing.update_file_processing_status")
    @patch("app.tasks.file_processing.extract_text_from_pdf")
    @patch("app.tasks.file_processing.ws_manager")
    @patch("app.tasks.file_processing.SessionLocal")
    def test_process_uploaded_file_extraction_error(
        self, mock_session_local, mock_ws_manager, mock_extract_text, mock_update_status
    ):
        """測試文本提取失敗的情況"""
        # 手動導入以避免初始化問題
        from app.tasks.file_processing import process_uploaded_file
        
        # 設置測試數據
        file_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        
        # 模擬資料庫會話和檔案記錄
        mock_session = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        # 模擬數據庫中的檔案
        mock_file = MagicMock()
        mock_file.file_uuid = uuid.UUID(file_uuid)
        mock_file.user_uuid = uuid.UUID(user_uuid)
        mock_file.original_name = "test.pdf"
        mock_file.status = "pending"
        
        # 模擬資料庫查詢
        mock_session.query.return_value.filter.return_value.first.return_value = mock_file
        
        # 模擬 PDF 文本提取失敗
        mock_extract_text.side_effect = Exception("PDF 文本提取失敗")
        
        # 執行任務，預期會失敗並被正確處理
        result = process_uploaded_file(file_uuid)
        
        # 驗證結果
        assert result["status"] == "failed"
        assert result["file_uuid"] == file_uuid
        assert "error" in result
        
        # 驗證錯誤處理
        mock_update_status.assert_called_with(ANY, "failed", ANY)
        
        # 驗證 WebSocket 錯誤通知
        mock_ws_manager.send_message_to_user.assert_called()


# 單元測試：文本提取功能
class TestTextExtraction:
    """文本提取功能測試"""
    
    @patch("app.tasks.file_processing.ws_manager")
    @patch("app.tasks.file_processing.download_file")
    @patch("httpx.Client")
    def test_extract_text_successful(self, mock_httpx, mock_download_file, mock_ws_manager):
        """測試成功從 PDF 中提取文本"""
        # 手動導入以避免初始化問題
        from app.tasks.file_processing import extract_text_from_pdf
        
        # 設置測試數據
        file_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        
        # 模擬檔案信息
        mock_file = MagicMock()
        mock_file.file_uuid = uuid.UUID(file_uuid)
        mock_file.user_uuid = uuid.UUID(user_uuid)
        mock_file.original_name = "test.pdf"
        
        # 模擬從 MinIO 下載的 PDF 內容
        mock_download_file.return_value = b"Mock PDF content"
        
        # 模擬 split_sentences 服務的響應
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sentences": [
                {"sentence": "這是第一個句子", "page": 1},
                {"sentence": "這是第二個句子", "page": 1},
                {"sentence": "這是第三個句子", "page": 2}
            ]
        }
        
        # 設置 httpx 客戶端模擬
        mock_client = MagicMock()
        mock_httpx.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = mock_response
        
        # 執行函數
        result = extract_text_from_pdf(file_uuid, mock_file, user_uuid)
        
        # 驗證結果
        assert len(result) == 3
        assert result[0]["sentence"] == "這是第一個句子"
        assert result[0]["page"] == 1
        
        # 驗證 API 調用
        mock_client.post.assert_called_once()
        _, kwargs = mock_client.post.call_args
        assert 'files' in kwargs
        
        # 驗證 WebSocket 進度通知
        mock_ws_manager.send_message_to_user.assert_called()
    
    @patch("app.tasks.file_processing.ws_manager")
    @patch("app.tasks.file_processing.download_file")
    @patch("httpx.Client")
    def test_extract_text_api_error(self, mock_httpx, mock_download_file, mock_ws_manager):
        """測試文本提取 API 調用失敗"""
        # 手動導入以避免初始化問題
        from app.tasks.file_processing import extract_text_from_pdf
        
        # 設置測試數據
        file_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        
        # 模擬檔案信息
        mock_file = MagicMock()
        mock_file.file_uuid = uuid.UUID(file_uuid)
        mock_file.user_uuid = uuid.UUID(user_uuid)
        mock_file.original_name = "test.pdf"
        
        # 模擬從 MinIO 下載的 PDF 內容
        mock_download_file.return_value = b"Mock PDF content"
        
        # 模擬 split_sentences 服務失敗
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        
        # 設置 httpx 客戶端模擬
        mock_client = MagicMock()
        mock_httpx.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = mock_response
        
        # 執行函數，預期會拋出異常
        with pytest.raises(Exception) as excinfo:
            extract_text_from_pdf(file_uuid, mock_file, user_uuid)
        
        # 驗證錯誤處理
        assert "500" in str(excinfo.value) or "提取失敗" in str(excinfo.value)
        
        # 驗證 WebSocket 錯誤通知
        mock_ws_manager.send_message_to_user.assert_called()


# 單元測試：聊天處理任務組件
class TestChatProcessing:
    """聊天處理任務組件測試"""
    
    @patch("app.tasks.chat_processing.update_query_status")
    @patch("app.tasks.chat_processing.extract_keywords")
    @patch("app.tasks.chat_processing.find_relevant_sentences")
    @patch("app.tasks.chat_processing.generate_answer")
    @patch("app.tasks.chat_processing.ws_manager")
    @patch("app.tasks.chat_processing.SessionLocal")
    def test_process_user_query_success(
        self, mock_session_local, mock_ws_manager, mock_generate_answer,
        mock_find_sentences, mock_extract_keywords, mock_update_status
    ):
        """測試成功處理用戶查詢的流程"""
        # 手動導入以避免初始化問題
        from app.tasks.chat_processing import process_user_query
        
        # 設置測試數據
        query_uuid = str(uuid.uuid4())
        conversation_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        query_text = "什麼是自適應專業知識？"
        
        # 模擬資料庫會話
        mock_session = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        # 模擬關鍵詞提取結果
        mock_extract_keywords.return_value = ["自適應專業知識", "專業知識"]
        
        # 模擬找到的相關句子
        mock_sentences = [
            {
                "sentence_uuid": str(uuid.uuid4()),
                "file_uuid": str(uuid.uuid4()),
                "sentence": "自適應專業知識是指...",
                "page": 1,
                "defining_type": "cd"
            }
        ]
        mock_find_sentences.return_value = mock_sentences
        
        # 模擬答案生成結果
        mock_answer = {
            "answer": "自適應專業知識是一種能夠根據環境變化調整的專業知識體系...",
            "references": [{"index": 0, "sentence_uuid": mock_sentences[0]["sentence_uuid"]}]
        }
        mock_generate_answer.return_value = mock_answer
        
        # 執行任務
        result = process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
        
        # 驗證結果
        assert result["status"] == "success"
        assert result["query_uuid"] == query_uuid
        assert result["conversation_uuid"] == conversation_uuid
        assert "message_uuid" in result
        
        # 驗證子函數調用
        mock_extract_keywords.assert_called_once_with(query_text)
        mock_find_sentences.assert_called_once_with(
            ["自適應專業知識", "專業知識"], mock_session
        )
        mock_generate_answer.assert_called_once_with(
            query_text, mock_sentences, mock_session
        )
        
        # 驗證 WebSocket 進度通知
        assert mock_ws_manager.send_message_to_user.call_count >= 2
    
    @patch("app.tasks.chat_processing.update_query_status")
    @patch("app.tasks.chat_processing.extract_keywords")
    @patch("app.tasks.chat_processing.find_relevant_sentences")
    @patch("app.tasks.chat_processing.generate_answer")
    @patch("app.tasks.chat_processing.ws_manager")
    @patch("app.tasks.chat_processing.SessionLocal")
    def test_process_user_query_no_results(
        self, mock_session_local, mock_ws_manager, mock_generate_answer,
        mock_find_sentences, mock_extract_keywords, mock_update_status
    ):
        """測試找不到相關定義的情況"""
        # 手動導入以避免初始化問題
        from app.tasks.chat_processing import process_user_query
        
        # 設置測試數據
        query_uuid = str(uuid.uuid4())
        conversation_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        query_text = "什麼是不存在的概念？"
        
        # 模擬資料庫會話
        mock_session = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        # 模擬關鍵詞提取結果
        mock_extract_keywords.return_value = ["不存在的概念"]
        
        # 模擬沒有找到相關句子
        mock_find_sentences.return_value = []
        
        # 執行任務
        result = process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
        
        # 驗證結果
        assert result["status"] == "success"
        assert result["query_uuid"] == query_uuid
        assert result["conversation_uuid"] == conversation_uuid
        assert result["definitions_found"] == 0
        
        # 驗證 WebSocket 進度通知
        assert mock_ws_manager.send_message_to_user.call_count >= 2
        
        # 確認沒有調用答案生成
        mock_generate_answer.assert_not_called()
    
    @patch("app.tasks.chat_processing.update_query_status")
    @patch("app.tasks.chat_processing.extract_keywords")
    @patch("app.tasks.chat_processing.ws_manager")
    @patch("app.tasks.chat_processing.SessionLocal")
    def test_process_user_query_keyword_extraction_error(
        self, mock_session_local, mock_ws_manager, mock_extract_keywords, mock_update_status
    ):
        """測試關鍵詞提取失敗的情況"""
        # 手動導入以避免初始化問題
        from app.tasks.chat_processing import process_user_query
        
        # 設置測試數據
        query_uuid = str(uuid.uuid4())
        conversation_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())
        query_text = "什麼是自適應專業知識？"
        
        # 模擬資料庫會話
        mock_session = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        # 模擬關鍵詞提取失敗
        mock_extract_keywords.side_effect = Exception("關鍵詞提取失敗")
        
        # 執行任務，預期會失敗並被正確處理
        result = process_user_query(query_uuid, conversation_uuid, user_uuid, query_text)
        
        # 驗證結果
        assert result["status"] == "failed"
        assert result["query_uuid"] == query_uuid
        assert "error" in result
        
        # 驗證錯誤處理
        mock_update_status.assert_called_with(ANY, "failed", ANY)
        
        # 驗證 WebSocket 錯誤通知
        mock_ws_manager.send_message_to_user.assert_called() 