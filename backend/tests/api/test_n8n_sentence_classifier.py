"""
測試n8n句子分類客戶端
"""
import pytest
import asyncio
from unittest.mock import patch, MagicMock

from app.api.clients.n8n_sentence_classifier import check_od_cd, classify_sentence_batch

# 測試句子
TEST_CD_SENTENCE = "學習是獲取新的知識和技能的過程。"
TEST_OD_SENTENCE = "研究中的學習進步將使用測驗分數的增長來衡量，至少需要提高10%才算有效。"


# 模擬成功的API響應
@pytest.mark.asyncio
async def test_check_od_cd_success():
    # 創建一個模擬的httpx客戶端響應
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "defining_type": "CD",
        "reason": "該句子定義了學習的概念，而不是如何測量它。"
    }
    
    # 使用非同步上下文管理器模擬
    mock_client = MagicMock()
    mock_client.__aenter__.return_value.post.return_value = mock_response
    mock_client.__aenter__.return_value.post.return_value.raise_for_status = MagicMock()
    
    # 使用上下文管理器模擬httpx.AsyncClient
    with patch('httpx.AsyncClient', return_value=mock_client):
        result = await check_od_cd(TEST_CD_SENTENCE)
        
        # 驗證結果
        assert result["defining_type"] == "cd"  # 應該轉為小寫
        assert "reason" in result
        assert isinstance(result["reason"], str)


# 測試HTTP錯誤
@pytest.mark.asyncio
async def test_check_od_cd_http_error():
    from httpx import HTTPStatusError, Response, Request
    
    # 創建模擬的請求和響應
    mock_request = Request('POST', 'https://n8n.hsueh.tw/webhook/xxx')
    mock_response = Response(status_code=500, request=mock_request)
    
    # 創建模擬的HTTP錯誤
    http_error = HTTPStatusError("Server error", request=mock_request, response=mock_response)
    
    # 模擬 client.post 拋出 HTTPStatusError
    mock_client = MagicMock()
    mock_client.__aenter__.return_value.post.side_effect = http_error
    
    # 使用上下文管理器模擬httpx.AsyncClient
    with patch('httpx.AsyncClient', return_value=mock_client):
        with pytest.raises(Exception) as exc_info:
            await check_od_cd(TEST_CD_SENTENCE)
            
        # 確認拋出了HTTPException
        assert "返回錯誤狀態碼 500" in str(exc_info.value)


# 測試超時錯誤
@pytest.mark.asyncio
async def test_check_od_cd_timeout():
    from httpx import TimeoutException
    
    # 模擬 client.post 拋出 TimeoutException
    mock_client = MagicMock()
    mock_client.__aenter__.return_value.post.side_effect = TimeoutException("Connection timed out")
    
    # 使用上下文管理器模擬httpx.AsyncClient
    with patch('httpx.AsyncClient', return_value=mock_client):
        with pytest.raises(Exception) as exc_info:
            await check_od_cd(TEST_CD_SENTENCE)
            
        # 確認拋出了HTTPException並包含超時訊息
        assert "請求超時" in str(exc_info.value)


# 測試批量分類函數
@pytest.mark.asyncio
async def test_classify_sentence_batch():
    # 創建一個模擬check_od_cd函數
    async def mock_check_od_cd(sentence, **kwargs):
        if "學習" in sentence:
            return {"defining_type": "cd", "reason": "包含概念定義"}
        else:
            return {"defining_type": "od", "reason": "包含操作定義"}
    
    # 使用模擬的check_od_cd函數
    with patch('app.api.clients.n8n_sentence_classifier.check_od_cd', side_effect=mock_check_od_cd):
        sentences = [
            "學習是獲取知識的過程。",
            "研究使用問卷調查測量學生滿意度。",
            "學習能力是指學習新事物的速度。"
        ]
        
        results = await classify_sentence_batch(sentences, batch_size=2)
        
        # 驗證結果
        assert len(results) == 3
        assert results[0]["defining_type"] == "cd"
        assert results[1]["defining_type"] == "od"
        assert results[2]["defining_type"] == "cd"


# 測試批量分類處理失敗的情況
@pytest.mark.asyncio
async def test_classify_sentence_batch_with_errors():
    # 創建一個有時會失敗的模擬check_od_cd函數
    async def mock_check_od_cd(sentence, **kwargs):
        if "失敗" in sentence:
            raise Exception("模擬API調用失敗")
        return {"defining_type": "cd", "reason": "測試結果"}
    
    # 使用模擬的check_od_cd函數
    with patch('app.api.clients.n8n_sentence_classifier.check_od_cd', side_effect=mock_check_od_cd):
        sentences = [
            "正常句子1",
            "包含失敗的句子",
            "正常句子2"
        ]
        
        results = await classify_sentence_batch(sentences)
        
        # 驗證結果
        assert len(results) == 3
        assert results[0]["defining_type"] == "cd"
        assert results[1]["defining_type"] == "none"  # 失敗的句子應該標記為none
        assert "error" in results[1]
        assert results[1]["error"] == True
        assert results[2]["defining_type"] == "cd"


if __name__ == "__main__":
    # 如果直接運行此腳本，可以執行一個簡單的實際API調用測試（需要真實的API可用）
    async def run_actual_test():
        try:
            print("測試單個句子分類...")
            result = await check_od_cd(TEST_CD_SENTENCE)
            print(f"結果: {result}")
            
            print("\n測試批量分類...")
            batch_results = await classify_sentence_batch([TEST_CD_SENTENCE, TEST_OD_SENTENCE])
            for i, res in enumerate(batch_results):
                print(f"句子 {i+1} 結果: {res}")
                
        except Exception as e:
            print(f"測試失敗: {e}")
    
    asyncio.run(run_actual_test()) 