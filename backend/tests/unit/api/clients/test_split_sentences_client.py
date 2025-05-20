import pytest
import httpx
from unittest.mock import patch, MagicMock
from httpx import Response
import json
from fastapi import HTTPException
from backend.app.api.clients.split_sentences_client import SplitSentencesAPIClient

# 測試用的 PDF 內容和檔名
TEST_PDF_CONTENT = b'%PDF-1.4 test content'
TEST_FILENAME = 'test.pdf'

@pytest.fixture
def mock_httpx_client():
    with patch('httpx.AsyncClient') as mock_client:
        # 設置 mock HTTP 客戶端
        mock_instance = MagicMock()
        mock_client.return_value.__aenter__.return_value = mock_instance
        yield mock_instance

@pytest.mark.asyncio
async def test_split_pdf_sentences_success(mock_httpx_client):
    """測試成功調用 split_sentences API 的情況"""
    # 模擬 API 成功響應
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "sentences": [
                {"sentence": "這是第一個句子。", "page": 1},
                {"sentence": "這是第二個句子。", "page": 1},
                {"sentence": "這是第三個句子。", "page": 2}
            ]
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法
    client = SplitSentencesAPIClient(base_url="http://splitter:8000")
    result = await client.split_pdf_sentences(TEST_PDF_CONTENT, TEST_FILENAME)
    
    # 驗證結果
    assert len(result) == 3
    assert result[0]["sentence"] == "這是第一個句子。"
    assert result[0]["page"] == 1
    
    # 驗證 API 調用正確
    mock_httpx_client.post.assert_called_once()
    args, kwargs = mock_httpx_client.post.call_args
    assert args[0] == "http://splitter:8000/api/process-pdf"
    assert "files" in kwargs
    assert kwargs["files"]["file"][0] == TEST_FILENAME
    assert kwargs["files"]["file"][1] == TEST_PDF_CONTENT
    assert kwargs["files"]["file"][2] == "application/pdf"

@pytest.mark.asyncio
async def test_split_pdf_sentences_timeout(mock_httpx_client):
    """測試 API 調用超時的情況"""
    # 模擬超時異常
    mock_httpx_client.post.side_effect = httpx.TimeoutException("Connection timeout")
    
    # 初始化客戶端並調用方法
    client = SplitSentencesAPIClient(base_url="http://splitter:8000")
    
    # 驗證異常處理
    with pytest.raises(HTTPException) as excinfo:
        await client.split_pdf_sentences(TEST_PDF_CONTENT, TEST_FILENAME)
    
    assert excinfo.value.status_code == 504
    assert "超時" in excinfo.value.detail

@pytest.mark.asyncio
async def test_split_pdf_sentences_server_error(mock_httpx_client):
    """測試 API 返回 500 錯誤的情況"""
    # 模擬服務器錯誤
    mock_response = Response(status_code=500, content=b"Internal Server Error")
    mock_httpx_client.post.return_value = mock_response
    mock_httpx_client.post.return_value.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Server error", request=None, response=mock_response
    )
    
    # 初始化客戶端並調用方法
    client = SplitSentencesAPIClient(base_url="http://splitter:8000")
    
    # 驗證異常處理
    with pytest.raises(HTTPException) as excinfo:
        await client.split_pdf_sentences(TEST_PDF_CONTENT, TEST_FILENAME)
    
    assert excinfo.value.status_code == 500

@pytest.mark.asyncio
async def test_split_pdf_sentences_invalid_response(mock_httpx_client):
    """測試 API 返回無效格式的情況"""
    # 模擬無效格式響應
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "result": "success"  # 缺少預期的 sentences 鍵
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法
    client = SplitSentencesAPIClient(base_url="http://splitter:8000")
    
    # 驗證異常處理
    with pytest.raises(HTTPException) as excinfo:
        await client.split_pdf_sentences(TEST_PDF_CONTENT, TEST_FILENAME)
    
    assert excinfo.value.status_code == 500
    assert "格式無效" in excinfo.value.detail

@pytest.mark.asyncio
async def test_split_pdf_sentences_connection_error(mock_httpx_client):
    """測試 API 連接錯誤的情況"""
    # 模擬連接錯誤
    mock_httpx_client.post.side_effect = httpx.RequestError("Connection refused")
    
    # 初始化客戶端並調用方法
    client = SplitSentencesAPIClient(base_url="http://splitter:8000")
    
    # 驗證異常處理
    with pytest.raises(HTTPException) as excinfo:
        await client.split_pdf_sentences(TEST_PDF_CONTENT, TEST_FILENAME)
    
    assert excinfo.value.status_code == 502
    assert "無法連接" in excinfo.value.detail 