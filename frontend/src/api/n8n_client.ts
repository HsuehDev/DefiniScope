import axios from 'axios';

// 定義API回應的介面
interface CheckOdCdResponse {
  defining_type: string; // 'cd' 或 'od'
  reason: string;
}

/**
 * 實現指數退避的延遲
 * @param retryCount 當前重試次數
 * @returns 延遲毫秒數
 */
function exponentialDelay(retryCount: number): number {
  const delay = Math.pow(2, retryCount - 1) * 1000;
  console.log(`重試第${retryCount}次，延遲${delay}毫秒`);
  return delay;
}

/**
 * 判斷錯誤是否可重試
 * @param error Axios錯誤
 * @returns 是否可重試
 */
function isRetryableError(error: any): boolean {
  if (!axios.isAxiosError(error)) return false;
  
  // 網路錯誤(如連接中斷)
  if (!error.response) return true;
  
  // 伺服器錯誤(5xx)
  const status = error.response.status;
  return status >= 500 && status < 600;
}

/**
 * 調用n8n API檢查句子是概念型定義(CD)還是操作型定義(OD)
 * 
 * 此函數包含完整的錯誤處理和指數退避重試機制，確保API呼叫的穩定性
 * 
 * @param sentence - 要檢查的句子文本
 * @param baseUrl - n8n API的基礎URL
 * @returns 包含定義類型和理由的物件
 * @throws 當API調用失敗且重試後仍然失敗時拋出錯誤
 */
export async function checkOdCd(
  sentence: string,
  baseUrl: string = 'https://n8n.hsueh.tw'
): Promise<CheckOdCdResponse> {
  // 重試設定
  const maxRetries = 3;
  let retryCount = 0;
  
  // 建立axios實例
  const client = axios.create({
    timeout: 30000, // 30秒超時，符合PRD中的要求
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  });

  // 構建表單數據
  const formData = new URLSearchParams();
  formData.append('sentence', sentence);

  // n8n API端點，根據文件提供的URL
  const endpoint = '/webhook/5fd2cefe-147a-490d-ada9-8849234c1580';
  const url = `${baseUrl}${endpoint}`;

  while (true) {
    try {
      console.log(`正在調用n8n check od/cd API: ${url}`);
      const response = await client.post(url, formData);

      // 驗證回應格式
      const data = response.data;
      if (!data || typeof data.defining_type !== 'string' || typeof data.reason !== 'string') {
        throw new Error('API回應格式不符預期');
      }

      console.log(`成功獲取句子「${sentence.substring(0, 30)}...」的分類結果: ${data.defining_type}`);
      return {
        defining_type: data.defining_type.toLowerCase(), // 標準化為小寫
        reason: data.reason
      };
    } catch (error) {
      retryCount += 1;
      
      // 檢查是否可重試且未超過最大重試次數
      if (retryCount < maxRetries && isRetryableError(error)) {
        // 計算延遲時間並等待
        const delay = exponentialDelay(retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // 重試
      }
      
      // 處理最終錯誤
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        
        console.error(`n8n API調用失敗: ${status} ${statusText}`, data);
        throw new Error(`調用n8n check od/cd API失敗: ${status} ${statusText} - ${JSON.stringify(data)}`);
      } else {
        // 處理其他類型錯誤
        console.error(`n8n API調用發生未預期錯誤: ${error}`);
        throw new Error(`調用n8n check od/cd API時發生錯誤: ${error}`);
      }
    }
  }
} 