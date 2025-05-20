import pytest
import httpx
from unittest.mock import patch, MagicMock
from httpx import Response
import json
from fastapi import HTTPException
from backend.app.api.clients.n8n_api_client import N8nApiClient

@pytest.fixture
def mock_httpx_client():
    with patch('httpx.AsyncClient') as mock_client:
        mock_instance = MagicMock()
        mock_client.return_value.__aenter__.return_value = mock_instance
        yield mock_instance

# 測試用的句子資料
TEST_SENTENCES = [
    {"sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。", "page": 1},
    {"sentence": "研究者通過記錄參與者完成任務的時間來測量學習效果。", "page": 2},
    {"sentence": "這只是一個普通的描述性句子，不包含任何定義。", "page": 3}
]

# 測試用的查詢
TEST_QUERY = "什麼是自適應專業知識？"

@pytest.mark.asyncio
async def test_classify_sentences_success(mock_httpx_client):
    """測試成功調用句子分類 API 的情況"""
    # 模擬 API 成功響應
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "classified_sentences": [
                {
                    "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
                    "page": 1,
                    "defining_type": "cd",
                    "reason": "此句包含明確的概念定義"
                },
                {
                    "sentence": "研究者通過記錄參與者完成任務的時間來測量學習效果。",
                    "page": 2,
                    "defining_type": "od",
                    "reason": "此句描述了操作或測量方法"
                },
                {
                    "sentence": "這只是一個普通的描述性句子，不包含任何定義。",
                    "page": 3,
                    "defining_type": "none",
                    "reason": "此句不包含任何定義"
                }
            ]
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法
    client = N8nApiClient(base_url="http://n8n:5678")
    result = await client.classify_sentences(TEST_SENTENCES)
    
    # 驗證結果
    assert len(result) == 3
    assert result[0]["defining_type"] == "cd"
    assert result[1]["defining_type"] == "od"
    assert result[2]["defining_type"] == "none"
    
    # 驗證 API 調用正確
    mock_httpx_client.post.assert_called_once()
    args, kwargs = mock_httpx_client.post.call_args
    assert args[0] == "http://n8n:5678/webhook/sentence-classification"
    assert kwargs["json"]["sentences"] == TEST_SENTENCES
    assert kwargs["headers"]["Content-Type"] == "application/json"

@pytest.mark.asyncio
async def test_classify_sentences_with_api_key(mock_httpx_client):
    """測試帶 API key 調用句子分類 API 的情況"""
    # 模擬 API 成功響應
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "classified_sentences": [
                {
                    "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
                    "page": 1,
                    "defining_type": "cd",
                    "reason": "此句包含明確的概念定義"
                }
            ]
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法（帶 API key）
    client = N8nApiClient(base_url="http://n8n:5678", api_key="test_api_key")
    result = await client.classify_sentences([TEST_SENTENCES[0]])
    
    # 驗證 API 調用標頭中包含認證信息
    args, kwargs = mock_httpx_client.post.call_args
    assert kwargs["headers"]["Authorization"] == "Bearer test_api_key"

@pytest.mark.asyncio
async def test_classify_sentences_timeout(mock_httpx_client):
    """測試 API 調用超時的情況"""
    # 模擬超時異常
    mock_httpx_client.post.side_effect = httpx.TimeoutException("Connection timeout")
    
    # 初始化客戶端並調用方法
    client = N8nApiClient(base_url="http://n8n:5678")
    
    # 驗證異常處理
    with pytest.raises(HTTPException) as excinfo:
        await client.classify_sentences(TEST_SENTENCES)
    
    assert excinfo.value.status_code == 504
    assert "超時" in excinfo.value.detail

@pytest.mark.asyncio
async def test_extract_keywords_success(mock_httpx_client):
    """測試成功調用關鍵詞提取 API 的情況"""
    # 模擬 API 成功響應
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "keywords": ["自適應專業知識", "專業知識"]
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法
    client = N8nApiClient(base_url="http://n8n:5678")
    result = await client.extract_keywords(TEST_QUERY)
    
    # 驗證結果
    assert len(result) == 2
    assert "自適應專業知識" in result
    assert "專業知識" in result
    
    # 驗證 API 調用正確
    mock_httpx_client.post.assert_called_once()
    args, kwargs = mock_httpx_client.post.call_args
    assert args[0] == "http://n8n:5678/webhook/keyword-extraction"
    assert kwargs["json"]["query"] == TEST_QUERY

@pytest.mark.asyncio
async def test_generate_answer_success(mock_httpx_client):
    """測試成功調用答案生成 API 的情況"""
    # 準備測試用的相關句子
    relevant_sentences = [
        {
            "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "file_uuid": "550e8400-e29b-41d4-a716-446655440001",
            "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
            "page": 1,
            "defining_type": "cd",
            "original_name": "example.pdf"
        }
    ]
    
    # 模擬 API 成功響應
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "answer": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。這種能力使得個體能夠在不同情境中有效解決問題。",
            "references": [
                {
                    "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
                    "file_uuid": "550e8400-e29b-41d4-a716-446655440001",
                    "original_name": "example.pdf",
                    "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
                    "page": 1,
                    "defining_type": "cd"
                }
            ]
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法
    client = N8nApiClient(base_url="http://n8n:5678")
    result = await client.generate_answer(TEST_QUERY, relevant_sentences)
    
    # 驗證結果
    assert "answer" in result
    assert "references" in result
    assert len(result["references"]) == 1
    assert result["references"][0]["sentence_uuid"] == "550e8400-e29b-41d4-a716-446655440000"
    
    # 驗證 API 調用正確
    mock_httpx_client.post.assert_called_once()
    args, kwargs = mock_httpx_client.post.call_args
    assert args[0] == "http://n8n:5678/webhook/answer-generation"
    assert kwargs["json"]["query"] == TEST_QUERY
    assert kwargs["json"]["relevant_sentences"] == relevant_sentences

@pytest.mark.asyncio
async def test_generate_answer_invalid_response(mock_httpx_client):
    """測試答案生成 API 返回無效格式的情況"""
    # 準備測試用的相關句子
    relevant_sentences = [
        {
            "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "file_uuid": "550e8400-e29b-41d4-a716-446655440001",
            "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
            "page": 1,
            "defining_type": "cd",
            "original_name": "example.pdf"
        }
    ]
    
    # 模擬 API 返回無效格式
    mock_response = Response(
        status_code=200,
        content=json.dumps({
            "answer": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。"
            # 缺少 references 欄位
        }).encode()
    )
    mock_httpx_client.post.return_value = mock_response
    
    # 初始化客戶端並調用方法
    client = N8nApiClient(base_url="http://n8n:5678")
    
    # 驗證異常處理
    with pytest.raises(HTTPException) as excinfo:
        await client.generate_answer(TEST_QUERY, relevant_sentences)
    
    assert excinfo.value.status_code == 500
    assert "格式無效" in excinfo.value.detail 