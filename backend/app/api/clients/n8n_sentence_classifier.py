"""
n8n句子分類客戶端

此模組提供了一個用於調用n8n API的非同步函數，用於判斷句子是
概念型定義(Conceptual Definition, CD)還是操作型定義(Operational Definition, OD)
"""

import logging
import asyncio
from typing import Dict, Any, Optional

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    RetryError
)
from fastapi import HTTPException

# 設定日誌記錄器
logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(3),  # 最多重試3次
    wait=wait_exponential(multiplier=1, min=1, max=10),  # 指數退避: 1秒, 2秒, 4秒...最大10秒
    retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError))
)
async def check_od_cd(
    sentence: str,
    base_url: str = "https://n8n.hsueh.tw",
    timeout: int = 30
) -> Dict[str, str]:
    """
    調用n8n API判斷句子是概念型定義(CD)還是操作型定義(OD)
    
    根據PRD要求實現了:
    - 指數退避重試機制 (最多3次，起始間隔1秒)
    - API調用超時設置為30秒
    - 詳細的錯誤處理和日誌記錄
    
    Args:
        sentence: 要判斷的句子文本
        base_url: n8n API的基礎URL，默認為"https://n8n.hsueh.tw"
        timeout: API請求超時時間，默認30秒
        
    Returns:
        包含defining_type和reason的字典，例如:
        {"defining_type": "cd", "reason": "這是概念型定義因為..."}
        
    Raises:
        HTTPException: 當API請求失敗且重試後仍然失敗時拋出錯誤
    """
    # API端點，根據文檔提供的URL
    endpoint = "/webhook/5fd2cefe-147a-490d-ada9-8849234c1580"
    url = f"{base_url}{endpoint}"
    
    # 準備請求數據 (application/x-www-form-urlencoded格式)
    form_data = {"sentence": sentence}
    
    try:
        # 使用httpx進行非同步HTTP請求
        async with httpx.AsyncClient(timeout=timeout) as client:
            logger.info(f"正在調用n8n check od/cd API: {url}，句子: {sentence[:30]}...")
            
            # 發送POST請求，根據文檔要求使用x-www-form-urlencoded格式
            response = await client.post(
                url,
                data=form_data,  # 使用data參數，httpx會自動設置Content-Type為application/x-www-form-urlencoded
            )
            
            # 檢查HTTP狀態碼
            response.raise_for_status()
            
            # 解析回應
            result = response.json()
            
            # 驗證回應格式
            if not isinstance(result, dict) or "defining_type" not in result or "reason" not in result:
                error_msg = f"n8n API回應格式無效: {result}"
                logger.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)
            
            # 標準化defining_type為小寫
            result["defining_type"] = result["defining_type"].lower()
            
            logger.info(f"成功獲取句子分類結果: {result['defining_type']}")
            return result
            
    except httpx.TimeoutException as e:
        error_msg = f"n8n check od/cd API請求超時: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=504, detail=error_msg) from e
        
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        error_msg = f"n8n check od/cd API返回錯誤狀態碼 {status_code}: {e.response.text}"
        logger.error(error_msg)
        raise HTTPException(status_code=status_code, detail=error_msg) from e
        
    except httpx.RequestError as e:
        error_msg = f"n8n check od/cd API請求錯誤: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=502, detail=error_msg) from e
        
    except Exception as e:
        error_msg = f"調用n8n check od/cd API時發生未預期的錯誤: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg) from e


async def classify_sentence_batch(
    sentences: list[str],
    base_url: str = "https://n8n.hsueh.tw",
    timeout: int = 30,
    batch_size: int = 5,
    concurrent_limit: int = 3
) -> list[Dict[str, str]]:
    """
    批量對句子進行CD/OD分類，控制並發數量和分批處理
    
    Args:
        sentences: 要分類的句子列表
        base_url: n8n API的基礎URL
        timeout: 每個API請求的超時時間(秒)
        batch_size: 每批處理的句子數量
        concurrent_limit: 最大並發請求數
        
    Returns:
        分類結果列表，每個元素是包含defining_type和reason的字典
    """
    logger.info(f"開始批量分類 {len(sentences)} 個句子，並發限制: {concurrent_limit}，批次大小: {batch_size}")
    
    results = []
    
    # 將句子列表分批
    for i in range(0, len(sentences), batch_size):
        batch = sentences[i:i+batch_size]
        
        # 創建當前批次的任務列表
        tasks = []
        for sentence in batch:
            task = check_od_cd(sentence, base_url, timeout)
            tasks.append(task)
        
        # 使用asyncio.gather並發執行當前批次的任務
        try:
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 處理每個結果
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    # 處理任務失敗的情況
                    logger.error(f"句子分類失敗: {str(result)}")
                    # 添加一個表示分類失敗的結果
                    results.append({
                        "defining_type": "none",
                        "reason": f"分類過程中發生錯誤: {str(result)}",
                        "error": True
                    })
                else:
                    # 添加成功的分類結果
                    results.append(result)
            
            logger.info(f"完成第 {i//batch_size + 1} 批句子分類，進度: {min(i+batch_size, len(sentences))}/{len(sentences)}")
            
        except Exception as e:
            logger.error(f"處理句子批次時發生未預期錯誤: {str(e)}", exc_info=True)
            # 對於整個批次失敗的情況，為每個句子添加錯誤結果
            for _ in batch:
                results.append({
                    "defining_type": "none",
                    "reason": f"批次處理過程中發生錯誤: {str(e)}",
                    "error": True
                })
    
    logger.info(f"句子批量分類完成，總共 {len(results)} 個結果")
    return results 