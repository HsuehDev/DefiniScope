import asyncio
import httpx
import logging
from typing import Dict, List, Optional, Union, Any
from fastapi import HTTPException
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

class SplitSentencesAPIClient:
    def __init__(
        self, 
        base_url: str,
        timeout: int = 30,
        max_retries: int = 3,
        initial_retry_delay: float = 1.0
    ):
        """
        初始化 Split Sentences API 客戶端
        
        Args:
            base_url: API 基礎 URL，例如 http://pdf_sentence_splitter:8000
            timeout: 請求超時時間（秒）
            max_retries: 最大重試次數
            initial_retry_delay: 初始重試延遲（秒）
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.initial_retry_delay = initial_retry_delay
        
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError))
    )
    async def split_pdf_sentences(
        self, 
        file_content: bytes, 
        file_name: str
    ) -> List[Dict[str, Union[str, int]]]:
        """
        調用 Split Sentences API 將 PDF 文件切分成句子
        
        Args:
            file_content: PDF 文件的二進制內容
            file_name: 文件名稱
            
        Returns:
            包含句子文本和頁碼的列表
            
        Raises:
            HTTPException: 當 API 請求失敗時
        """
        endpoint = f"{self.base_url}/api/process-pdf"
        
        try:
            files = {'file': (file_name, file_content, 'application/pdf')}
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"正在調用 Split Sentences API: {endpoint}")
                response = await client.post(endpoint, files=files)
                response.raise_for_status()  # 如果狀態碼不是 2xx，則引發異常
                
                result = response.json()
                if 'sentences' not in result:
                    raise HTTPException(
                        status_code=500,
                        detail="Split Sentences API 返回格式無效"
                    )
                
                logger.info(f"成功從 Split Sentences API 獲取 {len(result['sentences'])} 個句子")
                return result['sentences']
                
        except httpx.TimeoutException:
            logger.error(f"Split Sentences API 請求超時")
            raise HTTPException(
                status_code=504,
                detail="Split Sentences API 請求超時"
            )
        except httpx.RequestError as e:
            logger.error(f"Split Sentences API 請求錯誤: {str(e)}")
            raise HTTPException(
                status_code=502,
                detail=f"無法連接 Split Sentences API: {str(e)}"
            )
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            logger.error(f"Split Sentences API 返回錯誤狀態碼 {status_code}: {e.response.text}")
            raise HTTPException(
                status_code=status_code,
                detail=f"Split Sentences API 錯誤: {e.response.text}"
            )
        except Exception as e:
            logger.error(f"處理 Split Sentences API 回應時發生未預期的錯誤: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"處理 Split Sentences API 回應時發生錯誤: {str(e)}"
            ) 