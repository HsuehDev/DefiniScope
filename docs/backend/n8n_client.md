# n8n API 客戶端模組

## 概述

`n8n_client.py` 模組提供了一組功能，用於與 n8n 工作流程 API 進行非同步通信。這個模組主要處理對 n8n 中定義的各個 workflow 的 HTTP 請求，實現了重試機制、錯誤處理和回應驗證等功能。

目前實現的主要功能包括:
- 句子分類 API (`call_n8n_check_od_cd_api`): 判斷一個句子是否為概念型定義(CD)或操作型定義(OD)

## 依賴項目

- `httpx`: 用於非同步 HTTP 請求
- `pydantic`: 用於資料驗證和結構定義
- `asyncio`: 用於非同步操作和等待
- `logging`: 用於日誌記錄
- `random`: 用於重試時間的隨機抖動

確保這些依賴已添加到 `requirements.txt`:

```
httpx>=0.25.0
pydantic>=2.0.0
```

## 功能詳解

### 句子分類 API (`call_n8n_check_od_cd_api`)

#### 功能說明

這個函數調用 n8n 的 `check od/cd` workflow，用於判斷給定的句子是概念型定義(CD)還是操作型定義(OD)。

#### API 規格

- **HTTP 方法**: POST
- **內容類型**: application/x-www-form-urlencoded
- **路徑**: /webhook/5fd2cefe-147a-490d-ada9-8849234c1580
- **請求參數**:
  - `sentence`: 要分類的句子文本
- **回應格式** (JSON):
  - `defining_type`: 分類結果，可能值為 "cd", "od" 或 "none"
  - `reason`: 分類的原因說明

#### 使用範例

```python
import asyncio
from app.services.n8n_client import call_n8n_check_od_cd_api

async def classify_sentence_example():
    # 示例句子
    sentence = "Learning is acquiring new knowledge."
    
    try:
        # 調用API
        result = await call_n8n_check_od_cd_api(sentence)
        
        # 使用結果
        print(f"分類結果: {result['defining_type']}")
        print(f"分類原因: {result['reason']}")
        
        # 根據分類結果進行後續處理
        if result['defining_type'] == 'cd':
            print("這是一個概念型定義")
        elif result['defining_type'] == 'od':
            print("這是一個操作型定義")
        else:
            print("這不是一個定義")
            
    except Exception as e:
        print(f"分類過程中發生錯誤: {str(e)}")

# 在FastAPI路由中使用
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.post("/classify-sentence")
async def classify_sentence(sentence: str):
    try:
        result = await call_n8n_check_od_cd_api(sentence)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分類失敗: {str(e)}")

# 在Celery任務中使用
from app.worker import celery_app

@celery_app.task
def classify_sentence_task(sentence: str):
    # 注意: 在Celery任務中使用非同步函數需要特殊處理
    # 方法1: 使用同步包裝器
    import asyncio
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(call_n8n_check_od_cd_api(sentence))
    return result
    
    # 方法2: 在Celery配置中使用專用的協程worker
    # 請參考Celery文檔中關於非同步任務的支援
```

## 實現細節

### 重試機制

該模組實現了指數退避重試機制:
- 最大重試次數: 3次
- 初始重試延遲: 1秒
- 最大重試延遲: 10秒
- 包含隨機抖動以避免同時重試導致的問題

重試僅適用於以下情況:
- 網路連接錯誤 (`httpx.RequestError`)
- 伺服器錯誤 (5xx 狀態碼)
- 特定客戶端錯誤 (如 429 Too Many Requests)

### 超時設定

根據 PRD 的要求，API 調用超時設定為 30 秒。

### 錯誤處理

函數處理以下類型的錯誤:
- 網路連接錯誤 (`httpx.RequestError`)
- HTTP 狀態碼錯誤 (`httpx.HTTPStatusError`)
- 回應格式錯誤 (`ValueError`)
- 請求超時 (`TimeoutError`)

所有錯誤都會被適當地記錄，並根據錯誤類型決定是否重試。

### 資料驗證

使用 Pydantic 模型 `ODCD_Response` 對 API 回應進行驗證，確保回應包含所需的欄位 (`defining_type` 和 `reason`)。

## 日誌記錄

該模組使用標準的 Python `logging` 模組記錄各種事件:
- INFO 級別: 成功的 API 調用
- WARNING 級別: API 重試嘗試
- ERROR 級別: 重試失敗或不可重試的錯誤

所有日誌包含足夠的上下文信息，便於故障排除。

## 性能考慮

- 每個函數調用都會創建一個新的 `httpx.AsyncClient` 實例
- 對於需要大量並發調用的場景，考慮使用共享的 `AsyncClient` 實例以優化性能
- 當在 Celery 任務中使用非同步函數時，需要考慮 asyncio 事件循環的處理方式

## 維護與擴展

未來可能的擴展:
1. 添加更多的 n8n workflow API 接口，如提取關鍵詞和生成回答
2. 實現配置驅動的端點管理，將 URL 和路徑等配置從程式碼中分離
3. 添加監控和指標收集功能，以追踪 API 呼叫性能
4. 優化並發處理，支援批量請求 