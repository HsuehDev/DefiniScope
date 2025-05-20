# n8n 句子分類客戶端 (API Client) 文檔

## 1. 概述

本文檔介紹實現的 n8n API 客戶端函數，主要用於調用 n8n 的 `check od/cd` workflow，該 workflow 用於判斷句子是概念型定義 (Conceptual Definition, CD) 還是操作型定義 (Operational Definition, OD)。

根據 PRD 的要求，API 客戶端實現了以下功能：
- 指數退避重試機制（最多 3 次，起始間隔 1 秒）
- API 超時設置為 30 秒
- 詳細的錯誤處理和日誌記錄
- 批量處理功能，控制並發請求數

## 2. 實現文件

- **Python 後端**: `backend/app/api/clients/n8n_sentence_classifier.py`
- **TypeScript 前端**: `frontend/src/api/n8n_client.ts`
- **測試文件**: `backend/tests/api/test_n8n_sentence_classifier.py`

## 3. API 端點

根據 `n8n_api_document.md` 文檔，調用的 API 端點為：

- **HTTP 方法**: `POST`
- **路徑**: `/webhook/5fd2cefe-147a-490d-ada9-8849234c1580`
- **請求格式**: `application/x-www-form-urlencoded`
- **請求參數**: `sentence`（要判斷的句子文本）
- **回應格式**: JSON 格式，包含 `defining_type` 和 `reason` 欄位

## 4. Python 版本使用方法

### 單個句子分類

```python
import asyncio
from app.api.clients.n8n_sentence_classifier import check_od_cd

async def classify_example():
    sentence = "學習是獲取新的知識和技能的過程。"
    try:
        result = await check_od_cd(sentence)
        print(f"分類結果: {result['defining_type']}")
        print(f"理由: {result['reason']}")
    except Exception as e:
        print(f"分類失敗: {e}")

asyncio.run(classify_example())
```

### 批量句子分類

```python
import asyncio
from app.api.clients.n8n_sentence_classifier import classify_sentence_batch

async def batch_classify_example():
    sentences = [
        "學習是獲取新的知識和技能的過程。",
        "研究中的學習進步將使用測驗分數的增長來衡量，至少需要提高10%才算有效。"
    ]
    
    results = await classify_sentence_batch(
        sentences,
        batch_size=5,     # 每批處理的句子數量
        concurrent_limit=3  # 最大並發請求數
    )
    
    for i, result in enumerate(results):
        print(f"句子 {i+1}: {result['defining_type']} - {result['reason']}")

asyncio.run(batch_classify_example())
```

## 5. TypeScript/JavaScript 版本使用方法

### 單個句子分類

```typescript
import { checkOdCd } from '../api/n8n_client';

async function classifySentence() {
  const sentence = "學習是獲取新的知識和技能的過程。";
  
  try {
    const result = await checkOdCd(sentence);
    console.log(`分類結果: ${result.defining_type}`);
    console.log(`理由: ${result.reason}`);
  } catch (error) {
    console.error('分類失敗:', error);
  }
}

classifySentence();
```

## 6. 主要特性說明

### 6.1 指數退避重試

依據 PRD 要求，API 調用失敗時會使用指數退避策略重試：
- 第一次重試等待 1 秒
- 第二次重試等待 2 秒
- 第三次重試等待 4 秒

Python 版本使用 `tenacity` 函式庫實現重試機制，TypeScript 版本使用自定義的重試邏輯實現。

### 6.2 錯誤處理

客戶端處理以下錯誤情況：
- 網路連接錯誤
- API 請求超時（設置為 30 秒）
- 服務器端錯誤（HTTP 5xx 狀態碼）
- 回應格式不符預期

錯誤發生時，Python 版本拋出 `HTTPException`，並附加詳細的錯誤信息，TypeScript 版本拋出一般的 `Error`，同樣附加詳細信息。

### 6.3 日誌記錄

Python 版本使用 `logging` 模組記錄以下信息：
- API 調用開始（包含 URL 和簡短的句子預覽）
- 重試次數和延遲時間
- 成功獲取結果
- 詳細的錯誤信息（包含類型和原因）

TypeScript 版本使用 `console.log` 和 `console.error` 輸出類似信息。

### 6.4 批量處理能力

Python 版本提供了 `classify_sentence_batch` 函數用於批量處理句子：
- 控制每批處理的句子數量
- 限制並發請求數量，避免 API 過載
- 適當的錯誤處理，單個句子失敗不影響批次中的其他句子
- 詳細的進度日誌記錄

## 7. 與其他系統的整合

### 7.1 與 Celery 任務整合

這些函數設計為可以在 Celery 任務中調用：

```python
from app.api.clients.n8n_sentence_classifier import classify_sentence_batch

@celery.task
def process_sentences(file_uuid, sentences):
    # 這裡可以將 asyncio 函數轉換為同步調用
    import asyncio
    
    loop = asyncio.get_event_loop()
    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    results = loop.run_until_complete(
        classify_sentence_batch(sentences)
    )
    
    # 處理結果...
    return results
```

### 7.2 與 FastAPI 端點整合

可以在 FastAPI 端點中直接使用這些非同步函數：

```python
from fastapi import APIRouter, Depends, HTTPException
from app.api.clients.n8n_sentence_classifier import check_od_cd

router = APIRouter()

@router.post("/classify-sentence")
async def classify_sentence_endpoint(sentence: str):
    try:
        result = await check_od_cd(sentence)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## 8. 效能考量

1. **批次處理與並發控制**：在處理大量句子時，批次處理和控制並發數量可以平衡效率和 API 伺服器負載。

2. **超時設置**：預設超時設置為 30 秒，可根據實際情況調整。

3. **錯誤處理**：失敗的請求會透過重試機制重新嘗試，但會有上限，避免無限重試。

4. **日誌記錄**：詳細的日誌可用於監控效能和排查問題。 