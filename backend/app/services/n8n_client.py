import asyncio
import logging
import random
from typing import Dict, Optional, Union, Any

import httpx
from pydantic import BaseModel, Field


class ODCD_Response(BaseModel):
    """OD/CD 分類回應的 Pydantic 模型

    Attributes:
        defining_type (str): 分類結果，可能是 "cd"、"od" 或 "none"
        reason (str): 分類的原因說明
    """
    defining_type: str = Field(..., description="分類結果（cd、od 或 none）")
    reason: str = Field(..., description="分類的原因說明")


# 記錄器設定
logger = logging.getLogger(__name__)


async def call_n8n_check_od_cd_api(sentence: str) -> Dict[str, str]:
    """
    以非同步方式調用 n8n 的 Webhook 判斷句子是否為概念型定義(CD)或操作型定義(OD)

    這個函數通過 HTTP POST 請求調用 n8n workflow API，用於分類一個句子是 CD 或 OD。
    函數實現了指數退避重試機制，最多重試 3 次，每次重試等待時間成倍增加。

    Args:
        sentence (str): 要分類的句子文本

    Returns:
        Dict[str, str]: 包含分類結果的字典，結構如下：
            {
                "defining_type": "cd" | "od" | "none",
                "reason": "分類的原因說明"
            }

    Raises:
        httpx.RequestError: 當網路連接錯誤時
        httpx.HTTPStatusError: 當 API 返回非 2xx 狀態碼時
        ValueError: 當回應格式無效或無法解析時
        TimeoutError: 當請求超時時
    """
    # API 端點設定
    n8n_base_url = "https://n8n.hsueh.tw"
    webhook_path = "/webhook/5fd2cefe-147a-490d-ada9-8849234c1580"
    url = f"{n8n_base_url}{webhook_path}"

    # 重試設定
    max_retries = 3  # 最大重試次數
    initial_retry_delay = 1  # 初始重試間隔（秒）
    max_retry_delay = 10  # 最大重試間隔（秒）

    # 請求設定
    timeout = 30.0  # 請求超時時間，根據 PRD 設定為 30 秒
    
    # 請求資料（application/x-www-form-urlencoded 格式）
    data = {"sentence": sentence}

    # 重試計數
    retry_count = 0
    last_exception: Optional[Exception] = None

    # 使用 httpx.AsyncClient 進行非同步請求，設定超時
    async with httpx.AsyncClient(timeout=timeout) as client:
        while retry_count <= max_retries:
            try:
                # 如果不是第一次嘗試，記錄重試信息
                if retry_count > 0:
                    logger.warning(
                        f"重試調用 n8n check od/cd API（第 {retry_count} 次）: {sentence[:50]}..."
                    )

                # 發送 POST 請求
                response = await client.post(
                    url,
                    data=data,  # 使用 form-urlencoded 格式傳送數據
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                # 檢查 HTTP 狀態碼
                response.raise_for_status()

                # 解析 JSON 回應
                result = response.json()
                
                # 驗證回應格式
                if not isinstance(result, dict) or "defining_type" not in result or "reason" not in result:
                    raise ValueError(f"無效的 API 回應格式: {result}")
                
                # 格式化回應，將 defining_type 轉為小寫
                result["defining_type"] = result["defining_type"].lower()
                
                # 使用 Pydantic 模型驗證回應
                validated_response = ODCD_Response(**result)
                
                # 記錄成功信息
                logger.info(
                    f"成功調用 n8n check od/cd API: 句子「{sentence[:50]}...」被分類為 {validated_response.defining_type}"
                )
                
                # 返回驗證後的回應字典
                return validated_response.dict()
                
            except (httpx.RequestError, httpx.HTTPStatusError, ValueError, TimeoutError) as e:
                last_exception = e
                
                # 判斷是否為可重試的錯誤
                retry_allowed = True
                
                # HTTP 狀態錯誤中，只有伺服器錯誤（5xx）和部分客戶端錯誤適合重試
                if isinstance(e, httpx.HTTPStatusError):
                    if e.response.status_code < 500 and e.response.status_code != 429:
                        # 客戶端錯誤（非 429 Too Many Requests）不重試
                        retry_allowed = False
                
                # 如果達到最大重試次數或不允許重試，則拋出最後的異常
                if retry_count >= max_retries or not retry_allowed:
                    logger.error(
                        f"調用 n8n check od/cd API 失敗（重試 {retry_count} 次後）: {str(e)}"
                    )
                    raise
                
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
                    f"調用 n8n check od/cd API 失敗: {str(e)}. 在 {retry_delay:.2f} 秒後重試 (嘗試 {retry_count+1}/{max_retries})"
                )
                
                # 等待後重試
                await asyncio.sleep(retry_delay)
                
                # 增加重試計數
                retry_count += 1
    
    # 如果所有重試都失敗，拋出最後的異常
    if last_exception:
        raise last_exception
    
    # 理論上不會執行到這裡，但為了代碼完整性添加
    raise RuntimeError("未知錯誤：重試循環結束但未返回結果或拋出異常") 