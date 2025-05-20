"""
文件處理核心邏輯測試
此測試文件專注於測試文件處理的核心功能，而非 Celery 任務整體
"""
import os
import uuid
import tempfile
import pytest
from unittest.mock import patch, MagicMock, mock_open

# 導入測試配置
from ..test_config import TestSettings, MockDependencies

# 定義測試數據
TEST_FILE_UUID = str(uuid.uuid4())
TEST_USER_UUID = str(uuid.uuid4())


class TestFileProcessingCore:
    """文件處理核心功能測試"""
    
    def setup_method(self):
        """測試前置準備"""
        # 創建一個臨時 PDF 文件
        self.temp_pdf = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        self.temp_pdf.write(b'Mock PDF Content')
        self.temp_pdf.close()
        
        # 設置測試對象
        self.mock_ws_manager = MockDependencies.get_mock_ws_manager()
        self.mock_file = MagicMock()
        self.mock_file.file_uuid = uuid.UUID(TEST_FILE_UUID)
        self.mock_file.user_uuid = uuid.UUID(TEST_USER_UUID)
        self.mock_file.original_name = "test.pdf"
        self.mock_file.status = "processing"
        
        # 設置測試配置
        self.settings = TestSettings()
    
    def teardown_method(self):
        """測試後清理"""
        # 刪除臨時文件
        if os.path.exists(self.temp_pdf.name):
            os.unlink(self.temp_pdf.name)
    
    @patch('httpx.Client')
    def test_text_extraction_success(self, mock_httpx_client):
        """測試成功從 PDF 提取文本"""
        # 從 test_file_extract.py 導入獨立測試函數
        from backend.tests.tasks.test_file_extract import extract_text_from_pdf_for_test
        
        # 模擬下載的 PDF 文件
        mock_download = MagicMock(return_value=self.temp_pdf.name)
        
        # 模擬 API 響應
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sentences": [
                {"sentence": "這是第一句", "page": 1},
                {"sentence": "這是第二句", "page": 1},
                {"sentence": "這是第三句", "page": 2}
            ]
        }
        
        # 設置 httpx 客戶端
        mock_client = MagicMock()
        mock_httpx_client.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = mock_response
        
        # 執行測試
        result = extract_text_from_pdf_for_test(
            TEST_FILE_UUID,
            self.mock_file,
            TEST_USER_UUID,
            download_func=mock_download,
            ws_manager=self.mock_ws_manager,
            settings=self.settings
        )
        
        # 驗證結果
        assert len(result) == 3
        assert result[0]["sentence"] == "這是第一句"
        assert result[0]["page"] == 1
        assert result[2]["page"] == 2
        
        # 驗證 WebSocket 事件
        self.mock_ws_manager.send_message_to_user.assert_called()
        
        # 驗證 API 調用
        mock_client.post.assert_called_once()
    
    @patch('httpx.Client')
    def test_text_extraction_api_error(self, mock_httpx_client):
        """測試 API 調用失敗情況"""
        # 從 test_file_extract.py 導入獨立測試函數
        from backend.tests.tasks.test_file_extract import extract_text_from_pdf_for_test
        
        # 模擬下載的 PDF 文件
        mock_download = MagicMock(return_value=self.temp_pdf.name)
        
        # 模擬 API 錯誤響應
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        
        # 設置 httpx 客戶端
        mock_client = MagicMock()
        mock_httpx_client.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = mock_response
        
        # 執行測試，預期會拋出異常
        with pytest.raises(Exception) as excinfo:
            extract_text_from_pdf_for_test(
                TEST_FILE_UUID,
                self.mock_file,
                TEST_USER_UUID,
                download_func=mock_download,
                ws_manager=self.mock_ws_manager,
                settings=self.settings
            )
        
        # 驗證錯誤處理
        assert "500" in str(excinfo.value) or "提取失敗" in str(excinfo.value)
        
        # 驗證錯誤通知
        error_calls = [
            call for call in self.mock_ws_manager.send_message_to_user.call_args_list
            if call[0][2].get('status') == 'failed'
        ]
        assert len(error_calls) > 0


class TestSentenceProcessing:
    """句子處理功能測試"""
    
    def setup_method(self):
        """測試前置準備"""
        # 設置測試數據
        self.file_uuid = TEST_FILE_UUID
        self.user_uuid = TEST_USER_UUID
        
        # 設置模擬對象
        self.mock_session = MockDependencies.get_mock_db_session()
        self.mock_ws_manager = MockDependencies.get_mock_ws_manager()
        
        # 測試用句子
        self.test_sentences = [
            {"sentence": "這是關於人工智能的定義性陳述", "page": 1},
            {"sentence": "這是一個普通的句子", "page": 1},
            {"sentence": "深度學習是機器學習的一個子集", "page": 2}
        ]
    
    @patch('app.tasks.file_processing.ws_manager')
    @patch('app.tasks.file_processing.classify_sentences')
    def test_process_sentences_success(self, mock_classify, mock_ws):
        """測試句子處理成功的情況"""
        # 導入測試函數
        from app.tasks.file_processing import process_sentences
        
        # 設置模擬對象
        mock_ws.send_message_to_user = self.mock_ws_manager.send_message_to_user
        
        # 模擬句子分類結果
        mock_classify.return_value = [
            {**self.test_sentences[0], "defining_type": "cd"},
            {**self.test_sentences[1], "defining_type": "nd"},
            {**self.test_sentences[2], "defining_type": "cd"}
        ]
        
        # 執行測試
        result = process_sentences(
            self.file_uuid,
            self.test_sentences,
            self.user_uuid,
            self.mock_session
        )
        
        # 驗證結果
        assert result == 3  # 應該返回句子總數
        
        # 驗證 WebSocket 進度通知
        self.mock_ws_manager.send_message_to_user.assert_called()
        
        # 驗證數據庫操作
        assert self.mock_session.add.call_count >= 3  # 每個句子應該添加到數據庫


def test_sentence_classification():
    """測試句子分類功能"""
    # 這裡應該測試實際的句子分類邏輯
    # 但由於它依賴於外部 API 或模型，可能需要更複雜的模擬
    # 所以這裡只是一個基本示例
    
    # 假設的分類函數
    def simple_classify(sentences):
        result = []
        for s in sentences:
            if "定義" in s["sentence"] or "是" in s["sentence"]:
                s["defining_type"] = "cd"  # 可能是定義句
            else:
                s["defining_type"] = "nd"  # 非定義句
            result.append(s)
        return result
    
    # 測試數據
    test_sentences = [
        {"sentence": "人工智能是一種模擬人類智能的技術", "page": 1},
        {"sentence": "這只是一個普通句子", "page": 1},
        {"sentence": "機器學習是人工智能的一個分支", "page": 2}
    ]
    
    # 執行分類
    classified = simple_classify(test_sentences)
    
    # 驗證結果
    assert classified[0]["defining_type"] == "cd"
    assert classified[1]["defining_type"] == "nd"
    assert classified[2]["defining_type"] == "cd" 