# API 客戶端實現文檔

## 1. 概述

本文檔描述了 AI 文件分析與互動平台中外部 API 客戶端的實現，包括：

1. Split Sentences API 客戶端：用於將 PDF 文件切分為句子
2. N8N API 客戶端：用於句子分類、關鍵詞提取和答案生成

這些客戶端實現了與外部服務的溝通，並符合後端 PRD 中所定義的要求，包括錯誤處理、重試機制和超時設置。

## 2. Split Sentences API 客戶端

### 2.1 功能概述

Split Sentences API 客戶端負責將 PDF 文件發送到 split_sentences 服務，並獲取切分後的句子列表。

### 2.2 主要方法

#### `split_pdf_sentences(file_content, file_name)`

將 PDF 文件發送到 split_sentences 服務，並獲取切分後的句子列表。

**參數**：
- `file_content` (bytes)：PDF 文件的二進制內容
- `file_name` (str)：文件名稱

**返回值**：
- 包含句子文本和頁碼的列表，每個元素為 `{"sentence": "句子內容", "page": 頁碼}`

**異常**：
- 當 API 請求失敗時，拋出 `HTTPException`

### 2.3 實現細節

- 使用 `httpx` 作為非同步 HTTP 客戶端
- 實作指數退避重試機制（最多 3 次，起始間隔 1 秒）
- 設置 API 調用的超時為 30 秒
- 完整的錯誤處理，包括超時、連接錯誤、HTTP 錯誤和無效響應

### 2.4 使用示例

```python
# 初始化客戶端
split_sentences_client = SplitSentencesAPIClient(
    base_url="http://pdf_sentence_splitter:8000"
)

# 讀取 PDF 文件
with open("example.pdf", "rb") as f:
    pdf_content = f.read()

# 調用 API 獲取句子
sentences = await split_sentences_client.split_pdf_sentences(
    pdf_content, "example.pdf"
)

# 處理結果
for sentence in sentences:
    print(f"句子: {sentence['sentence']}, 頁碼: {sentence['page']}")
```

## 3. N8N API 客戶端

### 3.1 功能概述

N8N API 客戶端負責與外部 n8n 服務通信，實現以下功能：

1. 句子分類：將句子分類為概念型定義(CD)或操作型定義(OD)
2. 關鍵詞提取：從用戶查詢中提取關鍵詞
3. 答案生成：根據用戶查詢和相關句子生成回答

### 3.2 主要方法

#### `classify_sentences(sentences)`

將一批句子分類為概念型定義(CD)或操作型定義(OD)。

**參數**：
- `sentences` (List[Dict])：要分類的句子列表，每個句子包含 'sentence' 和 'page' 字段

**返回值**：
- 包含分類結果的句子列表，每個句子增加 'defining_type' 和 'reason' 字段

**異常**：
- 當 API 請求失敗時，拋出 `HTTPException`

#### `extract_keywords(query)`

從查詢中提取關鍵詞。

**參數**：
- `query` (str)：用戶的查詢文本

**返回值**：
- 提取的關鍵詞列表

**異常**：
- 當 API 請求失敗時，拋出 `HTTPException`

#### `generate_answer(query, relevant_sentences)`

根據查詢和相關句子生成回答。

**參數**：
- `query` (str)：用戶的查詢文本
- `relevant_sentences` (List[Dict])：相關句子列表，包含句子文本、來源和定義類型

**返回值**：
- 包含回答內容和引用的字典，格式為 `{"answer": "回答內容", "references": [引用列表]}`

**異常**：
- 當 API 請求失敗時，拋出 `HTTPException`

### 3.3 實現細節

- 使用 `httpx` 作為非同步 HTTP 客戶端
- 支援可選的 API key 認證
- 實作指數退避重試機制（最多 3 次，起始間隔 1 秒）
- 設置 API 調用的超時為 30 秒
- 完整的錯誤處理，包括超時、連接錯誤、HTTP 錯誤和無效響應

### 3.4 使用示例

```python
# 初始化客戶端
n8n_client = N8nApiClient(
    base_url="http://n8n:5678",
    api_key="optional_api_key"  # 可選參數
)

# 句子分類
sentences = [
    {"sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。", "page": 1},
    {"sentence": "研究者通過記錄參與者完成任務的時間來測量學習效果。", "page": 2}
]
classified_sentences = await n8n_client.classify_sentences(sentences)

# 關鍵詞提取
query = "什麼是自適應專業知識？"
keywords = await n8n_client.extract_keywords(query)

# 答案生成
relevant_sentences = [
    {
        "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "file_uuid": "550e8400-e29b-41d4-a716-446655440001",
        "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
        "page": 1,
        "defining_type": "cd",
        "original_name": "example.pdf"
    }
]
answer_result = await n8n_client.generate_answer(query, relevant_sentences)
```

## 4. 測試策略

### 4.1 單元測試

為了確保 API 客戶端的穩定性和可靠性，我們實現了全面的單元測試，使用 pytest 和 unittest.mock 模擬 HTTP 請求。測試案例包括：

1. 成功調用的場景
2. 超時的場景
3. 連接錯誤的場景
4. HTTP 錯誤（不同狀態碼）的場景
5. 無效回應格式的場景

### 4.2 整合測試

整合測試使用實際的外部服務進行測試，確保與真實環境的相容性。這些測試默認被跳過，只有在設置環境變量 `RUN_INTEGRATION_TESTS=1` 時才會執行。

整合測試需要以下環境變量：
- `SPLIT_SENTENCES_API_URL`：Split Sentences API 的基礎 URL
- `N8N_API_URL`：N8N API 的基礎 URL
- `N8N_API_KEY`：可選的 N8N API 認證密鑰

### 4.3 運行測試

```bash
# 運行單元測試
pytest backend/tests/unit/api/clients/

# 運行整合測試
export RUN_INTEGRATION_TESTS=1
export SPLIT_SENTENCES_API_URL=http://localhost:8000
export N8N_API_URL=http://localhost:5678
export N8N_API_KEY=your_api_key_if_needed
pytest backend/tests/integration/api/clients/
```

## 5. 符合 PRD 要求的驗證

API 客戶端的實現符合後端 PRD 中所定義的以下要求：

1. **使用 httpx 作為非同步 HTTP 客戶端**：所有 API 調用都使用 httpx 的非同步 API 實現。

2. **指數退避重試機制**：使用 tenacity 庫實現了指數退避重試，最多重試 3 次，起始間隔 1 秒。

3. **設置 API 調用的超時**：所有 API 調用都設置了 30 秒的超時時間。

4. **完整的錯誤處理**：處理各種可能的錯誤情況，如超時、連接錯誤、HTTP 錯誤和無效響應。

5. **詳細的日誌記錄**：每個 API 調用都有詳細的日誌記錄，包括請求信息、回應結果和錯誤詳情。 