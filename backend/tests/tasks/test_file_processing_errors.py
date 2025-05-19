"""
測試檔案處理 Celery 任務的錯誤處理
"""
import uuid
import pytest
from unittest.mock import patch, MagicMock, call
import httpx

from app.tasks.file_processing import (
    process_uploaded_file,
    extract_text_from_pdf,
    classify_batch_with_retry
)
from app.models.sentence import DefiningType

# 測試 `extract_text_from_pdf` 重試邏輯
@patch("app.tasks.file_processing.download_file")
@patch("app.tasks.file_processing.send_pdf_extraction_progress_event")
@patch("httpx.Client")
@patch("time.sleep")  # 防止測試中實際等待
def test_extract_text_from_pdf_retry_success(mock_sleep, mock_client, mock_send_progress, mock_download):
    """測試網絡錯誤後的重試成功情況"""
    file_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    file_info = {
        "minio_bucket_name": "test-bucket",
        "minio_object_key": "test-object",
        "original_name": "test.pdf"
    }
    
    # 模擬 PDF 下載
    mock_download.return_value = b"PDF content"
    
    # 模擬首次請求失敗，第二次成功
    mock_response_success = MagicMock()
    mock_response_success.status_code = 200
    mock_response_success.json.return_value = {
        "sentences": [{"sentence": "Test sentence", "page": 1}]
    }
    
    # 設置第一次呼叫拋出異常，第二次呼叫成功
    mock_client_instance = MagicMock()
    mock_client_instance.__enter__.return_value.post.side_effect = [
        httpx.RequestError("Connection error"),
        mock_response_success
    ]
    mock_client.return_value = mock_client_instance
    
    # 執行函數
    result = extract_text_from_pdf(file_uuid, file_info, user_uuid)
    
    # 驗證結果
    assert len(result) == 1
    assert result[0]["sentence"] == "Test sentence"
    assert result[0]["page"] == 1
    
    # 驗證重試邏輯
    assert mock_client.call_count == 2
    assert mock_sleep.call_count == 1  # 應該等待一次

# 測試 `classify_batch_with_retry` 的容錯處理
@patch("httpx.Client")
@patch("time.sleep")
def test_classify_batch_with_retry_all_retries_fail(mock_sleep, mock_client):
    """測試當所有重試都失敗時，應返回預設分類值"""
    batch = [
        {"sentence": "Test sentence 1", "page": 1},
        {"sentence": "Test sentence 2", "page": 2}
    ]
    batch_uuids = [uuid.uuid4(), uuid.uuid4()]
    
    # 設置所有呼叫都失敗
    mock_client_instance = MagicMock()
    mock_client_instance.__enter__.return_value.post.side_effect = httpx.TimeoutException("Timeout")
    mock_client.return_value = mock_client_instance
    
    # 執行函數
    result = classify_batch_with_retry(batch, batch_uuids)
    
    # 驗證結果
    assert len(result) == 2
    assert result[0]["sentence_uuid"] == batch_uuids[0]
    assert result[0]["defining_type"] == DefiningType.NONE.value
    assert "分類失敗" in result[0]["reason"]
    assert result[0]["page"] == 1
    
    # 驗證重試邏輯
    assert mock_client.call_count == 3  # 應嘗試3次
    assert mock_sleep.call_count == 2  # 應等待2次

# 測試 `process_uploaded_file` 任務的錯誤處理
@patch("app.tasks.file_processing.get_file_info")
@patch("app.tasks.file_processing.update_file_status")
@patch("app.tasks.file_processing.send_processing_failed_event")
def test_process_uploaded_file_error_handling(mock_send_failed, mock_update_status, mock_get_info):
    """測試處理過程中發生錯誤時的錯誤處理"""
    file_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    
    # 模擬獲取檔案信息
    mock_get_info.return_value = ({"test": "info"}, user_uuid)
    
    # 模擬更新狀態時發生錯誤
    mock_update_status.side_effect = Exception("Database error")
    
    # 調用任務，應該拋出例外
    with pytest.raises(Exception) as exc_info:
        process_uploaded_file(file_uuid)
    
    # 驗證錯誤處理
    assert "Database error" in str(exc_info.value)
    mock_send_failed.assert_called_once()  # 應該嘗試發送失敗事件 