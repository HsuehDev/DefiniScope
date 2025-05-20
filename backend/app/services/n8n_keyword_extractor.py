"""
n8n關鍵詞提取客戶端

此模組提供了一個用於調用n8n API的非同步函數，用於從查詢中提取關鍵詞。
遵循PRD中的要求，實現了指數退避重試和詳細錯誤處理。
"""

import logging
import asyncio
import random
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import traceback

import httpx
from fastapi import HTTPException

# 設定日誌記錄器
logger = logging.getLogger(__name__)

class KeywordResponse(BaseModel):
    """關鍵詞提取回應的 Pydantic 模型
    
    Attributes:
        output (Dict): 包含關鍵詞列表的輸出對象
    """
    output: Dict[str, List[str]] = Field(..., description="包含keywords字段的輸出對象")

async def query_keyword_extraction(
    query: str,
    base_url: str = "https://n8n.hsueh.tw",
    timeout: int = 30
) -> List[str]:
    """
    調用n8n API從查詢中提取關鍵詞
    
    根據PRD要求實現了:
    - 指數退避重試機制 (最多3次，起始間隔1秒)
    - API調用超時設置為30秒
    - 詳細的錯誤處理和日誌記錄
    
    Args:
        query: 要提取關鍵詞的查詢文本
        base_url: n8n API的基礎URL，默認為"https://n8n.hsueh.tw"
        timeout: API請求超時時間，默認30秒
        
    Returns:
        提取的關鍵詞列表，例如: ["自適應專業知識", "專業知識"]
        
    Raises:
        HTTPException: 當API請求失敗且重試後仍然失敗時拋出錯誤
    """
    # API端點，根據文檔提供的URL
    endpoint = "/webhook/421337df-0d97-47b4-a96b-a70a6c35d416"
    url = f"{base_url}{endpoint}"
    
    # 重試設定
    max_retries = 3  # 最大重試次數
    initial_retry_delay = 1  # 初始重試間隔（秒）
    max_retry_delay = 10  # 最大重試間隔（秒）
    
    # 請求資料（application/x-www-form-urlencoded格式）
    form_data = {"query": query}
    
    # 重試計數
    retry_count = 0
    last_exception: Optional[Exception] = None
    
    # 使用 httpx.AsyncClient 進行非同步請求
    async with httpx.AsyncClient(timeout=timeout) as client:
        while retry_count <= max_retries:
            try:
                # 如果不是第一次嘗試，記錄重試信息
                if retry_count > 0:
                    logger.warning(
                        f"重試調用n8n keyword extraction API（第 {retry_count} 次）: {query[:30]}..."
                    )
                
                # 發送POST請求，根據文檔要求使用x-www-form-urlencoded格式
                logger.info(f"正在調用n8n keyword extraction API: {url}，查詢: {query[:30]}...")
                response = await client.post(
                    url,
                    data=form_data,  # 使用data參數，httpx會自動設置Content-Type為application/x-www-form-urlencoded
                )
                
                # 檢查HTTP狀態碼
                response.raise_for_status()
                
                # 解析回應
                result = response.json()
                
                # 驗證回應格式
                if not isinstance(result, list) or len(result) == 0 or not isinstance(result[0], dict):
                    error_msg = f"n8n API回應格式無效: {result}"
                    logger.error(error_msg)
                    # 直接創建並拋出異常，不使用 from e
                    raise HTTPException(status_code=500, detail=error_msg)
                
                # 解析回應格式
                first_item = result[0]
                if "output" not in first_item or not isinstance(first_item["output"], dict):
                    error_msg = f"n8n API回應格式無效，缺少output字段: {result}"
                    logger.error(error_msg)
                    # 直接創建並拋出異常，不使用 from e
                    raise HTTPException(status_code=500, detail=error_msg)
                
                # 獲取關鍵詞列表
                output = first_item["output"]
                if "keywords" not in output or not isinstance(output["keywords"], list):
                    error_msg = f"n8n API回應格式無效，缺少keywords字段: {result}"
                    logger.error(error_msg)
                    # 直接創建並拋出異常，不使用 from e
                    raise HTTPException(status_code=500, detail=error_msg)
                
                keywords = output["keywords"]
                
                # 驗證每個關鍵詞是字符串
                if not all(isinstance(k, str) for k in keywords):
                    error_msg = f"n8n API回應格式無效，keywords不全是字符串: {keywords}"
                    logger.error(error_msg)
                    # 直接創建並拋出異常，不使用 from e
                    raise HTTPException(status_code=500, detail=error_msg)
                
                logger.info(f"成功從查詢 '{query[:30]}...' 中提取了 {len(keywords)} 個關鍵詞")
                return keywords
                
            except HTTPException as e:
                # 如果已經是HTTPException，則直接抛出，不進行重試
                # 這樣就能保留原始的錯誤消息
                raise e
                
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                last_exception = e
                
                # 判斷是否為可重試的錯誤
                retry_allowed = True
                
                # HTTP狀態錯誤中，只有伺服器錯誤(5xx)和部分客戶端錯誤適合重試
                if isinstance(e, httpx.HTTPStatusError):
                    if e.response.status_code < 500 and e.response.status_code != 429:
                        # 客戶端錯誤（非429 Too Many Requests）不重試
                        retry_allowed = False
                        
                        # 針對不同狀態碼返回適當的錯誤信息
                        status_code = e.response.status_code
                        error_msg = f"n8n API返回錯誤狀態碼 {status_code}: {e.response.text}"
                        logger.error(error_msg)
                        raise HTTPException(status_code=status_code, detail=error_msg)
                
                # 如果達到最大重試次數或不允許重試，則拋出最後的異常
                if retry_count >= max_retries or not retry_allowed:
                    if isinstance(e, httpx.TimeoutException):
                        error_msg = f"n8n keyword extraction API請求超時: {str(e)}"
                        logger.error(error_msg)
                        raise HTTPException(status_code=504, detail=error_msg)
                    
                    elif isinstance(e, httpx.RequestError):
                        error_msg = f"n8n keyword extraction API請求錯誤: {str(e)}"
                        logger.error(error_msg)
                        raise HTTPException(status_code=502, detail=error_msg)
                    
                    # 其他類型的異常
                    error_msg = f"調用n8n keyword extraction API失敗: {str(e)}"
                    logger.error(error_msg)
                    raise HTTPException(status_code=500, detail=error_msg)
                
                # 計算下一次重試的等待時間（指數退避 + 抖動）
                retry_delay = min(
                    initial_retry_delay * (2 ** retry_count),
                    max_retry_delay
                )
                # 添加隨機抖動以避免同時重試
                jitter = random.uniform(0, 0.5 * retry_delay)
                retry_delay += jitter
                
                # 記錄重試信息
                logger.warning(
                    f"調用n8n keyword extraction API失敗: {str(e)}. 在 {retry_delay:.2f} 秒後重試 (嘗試 {retry_count+1}/{max_retries})"
                )
                
                # 等待後重試
                await asyncio.sleep(retry_delay)
                
                # 增加重試計數
                retry_count += 1
            
            except Exception as e:
                # 獲取原始錯誤訊息
                error_msg = str(e)
                logger.error(f"調用n8n keyword extraction API時發生未預期的錯誤: {error_msg}", exc_info=True)
                
                # 添加堆疊跟踪以幫助偵錯
                stack_trace = traceback.format_exc()
                logger.debug(f"堆疊跟踪: {stack_trace}")
                
                # 直接拋出HTTPException而不包裝錯誤信息，以確保可以在測試中檢查
                raise HTTPException(status_code=500, detail=error_msg)
    
    # 如果所有重試都失敗，拋出最後的異常
    if last_exception:
        error_msg = f"調用n8n keyword extraction API失敗（重試 {max_retries} 次後）: {str(last_exception)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    
    # 理論上不會執行到這裡，但為了代碼完整性添加
    raise HTTPException(status_code=500, detail="未知錯誤：重試循環結束但未返回結果或拋出異常") 