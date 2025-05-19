"""
測試檔案處理 Celery 任務
"""
import uuid
import pytest
from unittest.mock import patch, MagicMock, call
from datetime import datetime

from app.tasks.file_processing import (
    process_uploaded_file, 
    get_file_info,
    extract_text_from_pdf,
    store_sentences_to_db,
    classify_sentences,
    store_classification_results,
    update_file_statistics
)
from app.models.file import File, ProcessingStatus
from app.models.sentence import Sentence, DefiningType

# 模擬資料庫會話和 WebSocket 管理器
@pytest.fixture
def mock_session():
    with patch("app.tasks.file_processing.SessionLocal") as mock_session_factory:
        mock_session = MagicMock()
        mock_session_factory.return_value = mock_session
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        yield mock_session

@pytest.fixture
def mock_ws_manager():
    with patch("app.tasks.file_processing.ws_manager") as mock_ws:
        yield mock_ws

# 模擬 MinIO 客戶端
@pytest.fixture
def mock_minio_client():
    with patch("app.tasks.file_processing.download_file") as mock_download:
        mock_download.return_value = b"PDF content"
        yield mock_download

# 模擬 httpx 客戶端
@pytest.fixture
def mock_httpx_client():
    with patch("httpx.Client") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sentences": [
                {"sentence": "Test sentence 1", "page": 1},
                {"sentence": "Test sentence 2", "page": 1}
            ]
        }
        mock_client.return_value.__enter__.return_value.post.return_value = mock_response
        yield mock_client

# 測試 `get_file_info` 函數
def test_get_file_info_file_not_found(mock_session):
    """當找不到檔案時，應該拋出 ValueError 例外"""
    file_uuid = uuid.uuid4()
    
    with pytest.raises(ValueError) as exc_info:
        get_file_info(file_uuid)
    
    assert f"找不到 UUID 為 {file_uuid}" in str(exc_info.value)
    mock_session.close.assert_called_once()

def test_get_file_info_success(mock_session):
    """成功找到檔案時，應該返回檔案信息和使用者 UUID"""
    file_uuid = uuid.uuid4()
    user_uuid = uuid.uuid4()
    
    # 模擬檔案記錄
    mock_file = MagicMock()
    mock_file.file_uuid = file_uuid
    mock_file.user_uuid = user_uuid
    mock_file.original_name = "test.pdf"
    mock_file.minio_bucket_name = f"user-{user_uuid}"
    mock_file.minio_object_key = f"{file_uuid}.pdf"
    
    mock_session.execute.return_value.scalar_one_or_none.return_value = mock_file
    
    file_info, returned_user_uuid = get_file_info(file_uuid)
    
    assert file_info["file_uuid"] == file_uuid
    assert file_info["user_uuid"] == user_uuid
    assert file_info["original_name"] == "test.pdf"
    assert returned_user_uuid == user_uuid
    mock_session.close.assert_called_once()

# 測試 `extract_text_from_pdf` 函數
def test_extract_text_from_pdf(mock_minio_client, mock_httpx_client, mock_ws_manager):
    """測試 PDF 文本提取功能"""
    file_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    file_info = {
        "minio_bucket_name": f"user-{user_uuid}",
        "minio_object_key": f"{file_uuid}.pdf",
        "original_name": "test.pdf"
    }
    
    result = extract_text_from_pdf(file_uuid, file_info, user_uuid)
    
    assert len(result) == 2
    assert result[0]["sentence"] == "Test sentence 1"
    assert result[0]["page"] == 1
    assert result[1]["sentence"] == "Test sentence 2"
    assert result[1]["page"] == 1
    
    # 確認 WebSocket 進度更新被調用
    assert mock_ws_manager.send_message_to_user.call_count >= 1

# 測試 `process_uploaded_file` 任務 (集成多個模擬)
@patch("app.tasks.file_processing.get_file_info")
@patch("app.tasks.file_processing.update_file_status")
@patch("app.tasks.file_processing.extract_text_from_pdf")
@patch("app.tasks.file_processing.store_sentences_to_db")
@patch("app.tasks.file_processing.classify_sentences")
@patch("app.tasks.file_processing.store_classification_results")
@patch("app.tasks.file_processing.update_file_statistics")
@patch("app.tasks.file_processing.send_processing_started_event")
@patch("app.tasks.file_processing.send_processing_completed_event")
def test_process_uploaded_file_success(
    mock_send_completed, mock_send_started, mock_update_stats,
    mock_store_results, mock_classify, mock_store_sentences,
    mock_extract, mock_update_status, mock_get_info
):
    """測試檔案處理任務的完整流程"""
    # 設置模擬回傳值
    file_uuid = str(uuid.uuid4())
    file_uuid_obj = uuid.UUID(file_uuid)
    user_uuid = uuid.uuid4()
    
    mock_get_info.return_value = ({"test": "info"}, user_uuid)
    mock_extract.return_value = [{"sentence": "Test", "page": 1}]
    mock_store_sentences.return_value = [uuid.uuid4()]
    mock_classify.return_value = [{"sentence_uuid": mock_store_sentences.return_value[0], "defining_type": "cd"}]
    
    # 調用任務
    result = process_uploaded_file(file_uuid)
    
    # 驗證流程
    mock_get_info.assert_called_once_with(file_uuid_obj)
    mock_send_started.assert_called_once_with(file_uuid, user_uuid)
    mock_update_status.assert_any_call(file_uuid_obj, "processing")
    mock_extract.assert_called_once_with(file_uuid, {"test": "info"}, user_uuid)
    mock_store_sentences.assert_called_once()
    mock_classify.assert_called_once()
    mock_store_results.assert_called_once_with(file_uuid_obj, mock_classify.return_value)
    mock_update_stats.assert_called_once_with(file_uuid_obj)
    mock_send_completed.assert_called_once_with(file_uuid, user_uuid)
    mock_update_status.assert_any_call(file_uuid_obj, "completed")
    
    assert result["status"] == "success"
    assert result["file_uuid"] == file_uuid 