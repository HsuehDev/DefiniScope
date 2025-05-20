"""
文本提取功能測試
這個測試文件專注於測試文件處理中的核心功能：文本提取
"""
import os
import tempfile
import uuid
import pytest
from unittest.mock import patch, MagicMock, mock_open

# 模擬相關依賴
import sys

# 模擬 config
class MockSettings:
    """模擬配置對象"""
    PDF_SPLITTER_URL = "http://test-splitter:8000"

# 創建 Mock 對象
mock_ws_manager = MagicMock()
mock_download_file = MagicMock()

# 1. 提取待測試的函數
def extract_text_from_pdf_for_test(file_uuid, file_info, user_uuid, 
                                  download_func=mock_download_file, 
                                  ws_manager=mock_ws_manager,
                                  settings=MockSettings()):
    """
    從 PDF 中提取文本的測試版本
    
    這個函數是 app.tasks.file_processing.extract_text_from_pdf 的測試版本，
    移除了對其他模組的依賴
    """
    import tempfile
    import httpx
    import os
    import logging
    
    # 設置 logger
    logger = logging.getLogger(__name__)
    
    # 1. 創建進度通知
    progress_channel = f"processing/{file_uuid}"
    ws_manager.send_message_to_user(
        str(user_uuid), 
        progress_channel, 
        {
            "event": "extracting_text",
            "status": "processing",
            "file_uuid": str(file_uuid),
            "message": "正在從 PDF 中提取文本...",
            "progress": 30
        }
    )
    
    try:
        # 2. 從 MinIO 下載 PDF 文件
        local_pdf_path = download_func(file_uuid)
        
        # 3. 發送到文本提取服務
        url = f"{settings.PDF_SPLITTER_URL}/api/process-pdf"
        
        with httpx.Client(timeout=300) as client:
            with open(local_pdf_path, "rb") as pdf_file:
                files = {"file": (file_info.original_name, pdf_file, "application/pdf")}
                response = client.post(url, files=files)
            
            if response.status_code != 200:
                error_msg = f"PDF 文本提取失敗: {response.status_code} - {response.text}"
                logger.error(error_msg)
                
                # 發送錯誤通知
                ws_manager.send_message_to_user(
                    str(user_uuid), 
                    progress_channel, 
                    {
                        "event": "extraction_failed",
                        "status": "failed",
                        "file_uuid": str(file_uuid),
                        "message": f"文本提取失敗: {response.status_code}",
                        "error": error_msg
                    }
                )
                
                raise Exception(error_msg)
            
            # 4. 處理提取結果
            data = response.json()
            sentences_with_pages = data.get("sentences", [])
            
            # 5. 發送進度通知
            ws_manager.send_message_to_user(
                str(user_uuid), 
                progress_channel, 
                {
                    "event": "text_extracted",
                    "status": "processing",
                    "file_uuid": str(file_uuid),
                    "message": f"成功提取 {len(sentences_with_pages)} 個句子",
                    "progress": 40
                }
            )
            
            return sentences_with_pages
            
    except Exception as e:
        logger.exception(f"提取文本時發生錯誤: {str(e)}")
        
        # 發送錯誤通知
        ws_manager.send_message_to_user(
            str(user_uuid), 
            progress_channel, 
            {
                "event": "extraction_failed",
                "status": "failed",
                "file_uuid": str(file_uuid),
                "message": f"文本提取失敗: {str(e)}",
                "error": str(e)
            }
        )
        
        raise


# 測試文本提取功能
class TestTextExtraction:
    """文本提取功能測試"""
    
    def setup_method(self):
        """設置測試環境"""
        # 創建臨時PDF文件用於測試
        self.temp_pdf = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        self.temp_pdf.write(b'Mock PDF Content')
        self.temp_pdf.close()
        
        # 設置測試數據
        self.file_uuid = str(uuid.uuid4())
        self.user_uuid = str(uuid.uuid4())
        
        # 模擬文件對象
        self.mock_file = MagicMock()
        self.mock_file.file_uuid = uuid.UUID(self.file_uuid)
        self.mock_file.user_uuid = uuid.UUID(self.user_uuid)
        self.mock_file.original_name = "test.pdf"
        self.mock_file.status = "processing"
        
        # 重置 mock 對象
        mock_download_file.reset_mock()
        mock_ws_manager.reset_mock()
    
    def teardown_method(self):
        """清理測試環境"""
        # 刪除臨時文件
        if os.path.exists(self.temp_pdf.name):
            os.unlink(self.temp_pdf.name)
    
    @patch('httpx.Client')
    def test_extract_text_from_pdf_success(self, mock_httpx):
        """測試成功從PDF中提取文本"""
        # 模擬從 MinIO 下載的 PDF 內容
        mock_download_file.return_value = self.temp_pdf.name
        
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
        result = extract_text_from_pdf_for_test(
            self.file_uuid, 
            self.mock_file, 
            self.user_uuid
        )
        
        # 驗證結果
        assert len(result) == 3
        assert result[0]["sentence"] == "這是第一個句子"
        assert result[0]["page"] == 1
        
        # 驗證 API 調用
        mock_client.post.assert_called_once()
        
        # 驗證 WebSocket 訊息
        mock_ws_manager.send_message_to_user.assert_called()
    
    @patch('httpx.Client')
    def test_extract_text_api_error(self, mock_httpx):
        """測試 API 調用失敗的情況"""
        # 模擬從 MinIO 下載的 PDF 內容
        mock_download_file.return_value = self.temp_pdf.name
        
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
            extract_text_from_pdf_for_test(
                self.file_uuid, 
                self.mock_file, 
                self.user_uuid
            )
        
        # 驗證錯誤處理
        assert "500" in str(excinfo.value) or "提取失敗" in str(excinfo.value)
        
        # 驗證 WebSocket 錯誤通知
        mock_ws_manager.send_message_to_user.assert_called()
    
    def test_extract_text_file_not_found(self):
        """測試文件下載失敗的情況"""
        # 模擬文件下載失敗
        mock_download_file.side_effect = FileNotFoundError("文件不存在")
        
        # 執行函數，預期會拋出異常
        with pytest.raises(Exception) as excinfo:
            extract_text_from_pdf_for_test(
                self.file_uuid, 
                self.mock_file, 
                self.user_uuid
            )
        
        # 驗證錯誤處理
        assert "文件不存在" in str(excinfo.value)
        
        # 驗證 WebSocket 錯誤通知
        mock_ws_manager.send_message_to_user.assert_called() 