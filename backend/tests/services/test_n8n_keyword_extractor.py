"""
n8n關鍵詞提取客戶端單元測試

此模組測試n8n_keyword_extractor.py中定義的query_keyword_extraction函數。
使用pytest和pytest-httpx模擬HTTP請求並驗證功能的正確性。
"""

import pytest
import httpx
import asyncio
import json
import urllib.parse
from typing import List, Dict, Any

from fastapi import HTTPException
from backend.app.services.n8n_keyword_extractor import query_keyword_extraction

# 通用測試常量
TEST_BASE_URL = "https://test-n8n.example.com"
TEST_ENDPOINT = "/webhook/421337df-0d97-47b4-a96b-a70a6c35d416"
TEST_QUERY = "這是一個關於人工智能和機器學習的問題"
FULL_URL = f"{TEST_BASE_URL}{TEST_ENDPOINT}"

# 模擬成功的API回應
MOCK_SUCCESS_RESPONSE = [
    {
        "output": {
            "keywords": ["人工智能", "機器學習"]
        }
    }
]

# 用於參數化測試的HTTP錯誤代碼及其對應的預期異常
HTTP_ERROR_CODES = [400, 401, 403, 404, 500, 503]

@pytest.mark.asyncio
async def test_successful_keyword_extraction(httpx_mock):
    """測試成功調用API並正確解析回應"""
    # 配置httpx_mock不驗證未預期的請求
    httpx_mock._options.assert_all_requests_were_expected = False
    
    # 模擬HTTP響應
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json=MOCK_SUCCESS_RESPONSE,
        status_code=200,
        match_content=b"query=" + urllib.parse.quote(TEST_QUERY).encode()
    )
    
    # 調用函數
    result = await query_keyword_extraction(
        query=TEST_QUERY,
        base_url=TEST_BASE_URL
    )
    
    # 驗證結果
    assert isinstance(result, list)
    assert len(result) == 2
    assert "人工智能" in result
    assert "機器學習" in result
    
    # 驗證請求
    requests = httpx_mock.get_requests()
    assert len(requests) == 1
    request = requests[0]
    assert request.method == "POST"
    assert request.url == FULL_URL
    
    # 確認請求中的表單數據 - 使用URL解碼
    request_content = request.read().decode()
    assert "query=" in request_content
    # 使用URL解碼後比較
    decoded_content = urllib.parse.unquote(request_content)
    assert TEST_QUERY in decoded_content

@pytest.mark.asyncio
async def test_invalid_response_format(httpx_mock):
    """測試當API返回無效格式時的錯誤處理"""
    # 模擬響應 - 格式無效
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json={"unexpected": "format"},
        status_code=200
    )
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常內容
    assert excinfo.value.status_code == 500
    # 檢查異常消息中是否包含特定錯誤關鍵詞
    assert "n8n API回應格式無效" in excinfo.value.detail

@pytest.mark.asyncio
async def test_missing_output_field(httpx_mock):
    """測試當API響應缺少output字段時的錯誤處理"""
    # 模擬響應 - 缺少output字段
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json=[{"missing_output": "error"}],
        status_code=200
    )
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常內容
    assert excinfo.value.status_code == 500
    # 檢查異常消息中是否包含特定錯誤關鍵詞
    assert "缺少output字段" in excinfo.value.detail

@pytest.mark.asyncio
async def test_missing_keywords_field(httpx_mock):
    """測試當API響應缺少keywords字段時的錯誤處理"""
    # 模擬響應 - 缺少keywords字段
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json=[{"output": {"missing_keywords": "error"}}],
        status_code=200
    )
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常內容
    assert excinfo.value.status_code == 500
    # 檢查異常消息中是否包含特定錯誤關鍵詞
    assert "缺少keywords字段" in excinfo.value.detail

@pytest.mark.asyncio
async def test_invalid_keywords_type(httpx_mock):
    """測試當API響應中keywords不是字符串列表時的錯誤處理"""
    # 模擬響應 - keywords不是字符串列表
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json=[{"output": {"keywords": [1, 2, "string"]}}],
        status_code=200
    )
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常內容
    assert excinfo.value.status_code == 500
    # 檢查異常消息中是否包含特定錯誤關鍵詞
    assert "不全是字符串" in excinfo.value.detail

@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", HTTP_ERROR_CODES)
async def test_http_error_handling(httpx_mock, status_code):
    """測試當API返回不同HTTP錯誤代碼時的錯誤處理"""
    # 模擬HTTP錯誤響應
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        status_code=status_code,
        text=f"Error {status_code}"
    )
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常細節
    if status_code < 500 and status_code != 429:
        # 客戶端錯誤，非429，不應重試，直接拋出原始狀態碼
        assert excinfo.value.status_code == status_code
        assert str(status_code) in excinfo.value.detail
    else:
        # 伺服器錯誤或429，應該重試，由於模擬所有請求都失敗，最終拋出500或504
        assert excinfo.value.status_code in (500, 502, 504)
        assert "API" in excinfo.value.detail

@pytest.mark.asyncio
async def test_timeout_handling(httpx_mock):
    """測試請求超時時的錯誤處理"""
    # 模擬請求超時
    httpx_mock.add_exception(httpx.TimeoutException("Connection timed out"))
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL,
            timeout=1  # 設置較短的超時時間加速測試
        )
    
    # 驗證異常細節
    assert excinfo.value.status_code == 504
    assert "超時" in excinfo.value.detail or "timed out" in excinfo.value.detail.lower()

@pytest.mark.asyncio
async def test_connection_error_handling(httpx_mock):
    """測試連接錯誤時的錯誤處理"""
    # 模擬連接錯誤
    httpx_mock.add_exception(httpx.ConnectError("Connection refused"))
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常細節
    assert excinfo.value.status_code in (502, 504)  # 可能是502(請求錯誤)或504(超時)
    assert "API" in excinfo.value.detail or "Connection" in excinfo.value.detail

@pytest.mark.asyncio
async def test_retry_mechanism(httpx_mock):
    """測試重試機制，模擬間歇性失敗後成功"""
    # 添加失敗響應
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        status_code=500,
        text="Internal Server Error"
    )
    
    # 添加另一次失敗響應
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        status_code=500,
        text="Internal Server Error"
    )
    
    # 添加一次成功響應
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json=MOCK_SUCCESS_RESPONSE,
        status_code=200
    )
    
    # 如果還有更多請求，添加一個默認響應
    httpx_mock.add_response(
        method="POST",
        url=FULL_URL,
        json=MOCK_SUCCESS_RESPONSE,
        status_code=200
    )
    
    # 調用函數，應該在兩次失敗後成功
    result = await query_keyword_extraction(
        query=TEST_QUERY,
        base_url=TEST_BASE_URL
    )
    
    # 驗證結果
    assert isinstance(result, list)
    assert len(result) == 2
    assert "人工智能" in result
    assert "機器學習" in result

@pytest.mark.asyncio
async def test_max_retries_exceeded(httpx_mock):
    """測試超過最大重試次數後的錯誤處理"""
    # 添加4次失敗響應（初始 + 3次重試）
    for _ in range(4):
        httpx_mock.add_response(
            method="POST",
            url=FULL_URL,
            status_code=500,
            text="Internal Server Error"
        )
    
    # 預期函數將拋出HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await query_keyword_extraction(
            query=TEST_QUERY,
            base_url=TEST_BASE_URL
        )
    
    # 驗證異常細節
    assert excinfo.value.status_code == 500
    # 檢查異常消息中是否包含重試相關信息
    assert "API" in excinfo.value.detail and "500" in excinfo.value.detail

@pytest.mark.asyncio
async def test_empty_query_handling():
    """測試空查詢時的行為"""
    
    # 預期函數將拋出某種異常
    with pytest.raises(Exception):
        await query_keyword_extraction(query="")

# 集成測試建議（註釋掉，因為這需要實際的API服務）
"""
@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_api_integration():
    結合實際API的集成測試
    
    注意：此測試需要連接到實際的API服務
    運行方式：pytest -m integration
    
    # 使用真實API端點
    result = await query_keyword_extraction(
        query="人工智能和機器學習的區別是什麼？",
    )
    
    # 基本驗證
    assert isinstance(result, list)
    assert len(result) > 0
    assert all(isinstance(k, str) for k in result)
""" 