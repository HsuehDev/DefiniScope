import asyncio
import httpx
import logging
from typing import Dict, List, Optional, Union, Any
from fastapi import HTTPException
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

class N8nApiClient:
    def __init__(
        self, 
        base_url: str,
        api_key: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 3,
        initial_retry_delay: float = 1.0
    ):
        """
        初始化 N8N API 客戶端
        
        Args:
            base_url: N8N API 基礎 URL
            api_key: 可選的 API 認證密鑰
            timeout: 請求超時時間（秒）
            max_retries: 最大重試次數
            initial_retry_delay: 初始重試延遲（秒）
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.initial_retry_delay = initial_retry_delay
    
    def _get_headers(self) -> Dict[str, str]:
        """獲取請求標頭"""
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError))
    )
    async def classify_sentences(
        self, 
        sentences: List[Dict[str, Union[str, int]]]
    ) -> List[Dict[str, Any]]:
        """
        將一批句子分類為概念型定義 (CD) 或操作型定義 (OD)
        
        Args:
            sentences: 要分類的句子列表，每個句子包含 'sentence' 和 'page' 字段
            
        Returns:
            包含分類結果的句子列表，每個句子增加 'defining_type' 和 'reason' 字段
            
        Raises:
            HTTPException: 當 API 請求失敗時
        """
        endpoint = f"{self.base_url}/webhook/sentence-classification"
        
        try:
            payload = {
                "sentences": sentences
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"正在調用 N8N 句子分類 API: {endpoint}，處理 {len(sentences)} 個句子")
                response = await client.post(
                    endpoint, 
                    json=payload, 
                    headers=self._get_headers()
                )
                response.raise_for_status()
                
                result = response.json()
                if not isinstance(result, dict) or 'classified_sentences' not in result:
                    raise HTTPException(
                        status_code=500,
                        detail="N8N API 返回的句子分類格式無效"
                    )
                
                logger.info(f"成功從 N8N API 獲取 {len(result['classified_sentences'])} 個分類結果")
                return result['classified_sentences']
                
        except httpx.TimeoutException:
            logger.error(f"N8N 句子分類 API 請求超時")
            raise HTTPException(
                status_code=504,
                detail="N8N 句子分類 API 請求超時"
            )
        except httpx.RequestError as e:
            logger.error(f"N8N 句子分類 API 請求錯誤: {str(e)}")
            raise HTTPException(
                status_code=502,
                detail=f"無法連接 N8N 句子分類 API: {str(e)}"
            )
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            logger.error(f"N8N 句子分類 API 返回錯誤狀態碼 {status_code}: {e.response.text}")
            raise HTTPException(
                status_code=status_code,
                detail=f"N8N 句子分類 API 錯誤: {e.response.text}"
            )
        except Exception as e:
            logger.error(f"處理 N8N 句子分類 API 回應時發生未預期的錯誤: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"處理 N8N 句子分類 API 回應時發生錯誤: {str(e)}"
            )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError))
    )
    async def extract_keywords(
        self, 
        query: str
    ) -> List[str]:
        """
        從查詢中提取關鍵詞
        
        Args:
            query: 使用者的查詢文本
            
        Returns:
            提取的關鍵詞列表
            
        Raises:
            HTTPException: 當 API 請求失敗時
        """
        endpoint = f"{self.base_url}/webhook/keyword-extraction"
        
        try:
            payload = {
                "query": query
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"正在調用 N8N 關鍵詞提取 API: {endpoint}")
                response = await client.post(
                    endpoint, 
                    json=payload, 
                    headers=self._get_headers()
                )
                response.raise_for_status()
                
                result = response.json()
                if not isinstance(result, dict) or 'keywords' not in result:
                    raise HTTPException(
                        status_code=500,
                        detail="N8N API 返回的關鍵詞提取格式無效"
                    )
                
                logger.info(f"成功從 N8N API 獲取 {len(result['keywords'])} 個關鍵詞")
                return result['keywords']
                
        except httpx.TimeoutException:
            logger.error(f"N8N 關鍵詞提取 API 請求超時")
            raise HTTPException(
                status_code=504,
                detail="N8N 關鍵詞提取 API 請求超時"
            )
        except httpx.RequestError as e:
            logger.error(f"N8N 關鍵詞提取 API 請求錯誤: {str(e)}")
            raise HTTPException(
                status_code=502,
                detail=f"無法連接 N8N 關鍵詞提取 API: {str(e)}"
            )
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            logger.error(f"N8N 關鍵詞提取 API 返回錯誤狀態碼 {status_code}: {e.response.text}")
            raise HTTPException(
                status_code=status_code,
                detail=f"N8N 關鍵詞提取 API 錯誤: {e.response.text}"
            )
        except Exception as e:
            logger.error(f"處理 N8N 關鍵詞提取 API 回應時發生未預期的錯誤: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"處理 N8N 關鍵詞提取 API 回應時發生錯誤: {str(e)}"
            )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError))
    )
    async def generate_answer(
        self, 
        query: str,
        relevant_sentences: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        根據查詢和相關句子生成回答
        
        Args:
            query: 使用者的查詢文本
            relevant_sentences: 相關句子列表，包含句子文本、來源和定義類型
            
        Returns:
            包含回答內容和引用的字典
            
        Raises:
            HTTPException: 當 API 請求失敗時
        """
        endpoint = f"{self.base_url}/webhook/answer-generation"
        
        try:
            payload = {
                "query": query,
                "relevant_sentences": relevant_sentences
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"正在調用 N8N 答案生成 API: {endpoint}")
                response = await client.post(
                    endpoint, 
                    json=payload, 
                    headers=self._get_headers()
                )
                response.raise_for_status()
                
                result = response.json()
                if not isinstance(result, dict) or 'answer' not in result or 'references' not in result:
                    raise HTTPException(
                        status_code=500,
                        detail="N8N API 返回的答案生成格式無效"
                    )
                
                logger.info(f"成功從 N8N API 獲取回答，包含 {len(result['references'])} 個引用")
                return result
                
        except httpx.TimeoutException:
            logger.error(f"N8N 答案生成 API 請求超時")
            raise HTTPException(
                status_code=504,
                detail="N8N 答案生成 API 請求超時"
            )
        except httpx.RequestError as e:
            logger.error(f"N8N 答案生成 API 請求錯誤: {str(e)}")
            raise HTTPException(
                status_code=502,
                detail=f"無法連接 N8N 答案生成 API: {str(e)}"
            )
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            logger.error(f"N8N 答案生成 API 返回錯誤狀態碼 {status_code}: {e.response.text}")
            raise HTTPException(
                status_code=status_code,
                detail=f"N8N 答案生成 API 錯誤: {e.response.text}"
            )
        except Exception as e:
            logger.error(f"處理 N8N 答案生成 API 回應時發生未預期的錯誤: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"處理 N8N 答案生成 API 回應時發生錯誤: {str(e)}"
            ) 