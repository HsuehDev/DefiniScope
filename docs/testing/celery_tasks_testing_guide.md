# Celery 異步任務測試指南

本文檔提供測試 AI 文件分析與互動平台中 Celery 異步任務的詳細指南，包括單元測試、整合測試以及錯誤處理測試的方法。

## 目錄

1. [測試環境設置](#1-測試環境設置)
2. [單元測試](#2-單元測試)
3. [整合測試](#3-整合測試)
4. [錯誤處理測試](#4-錯誤處理測試)
5. [效能測試](#5-效能測試)
6. [最佳實踐](#6-最佳實踐)

## 1. 測試環境設置

### 1.1 安裝測試依賴

```bash
pip install pytest pytest-mock pytest-cov celery-testkit
```

### 1.2 環境變數設置

為了測試，創建 `.env.test` 文件並定義測試環境的變數：

```
DATABASE_URL=postgresql://testuser:testpass@localhost:5432/testdb
REDIS_URL=redis://localhost:6379/9
CELERY_BROKER_URL=redis://localhost:6379/9
CELERY_BACKEND_URL=redis://localhost:6379/9
```

### 1.3 建立 `conftest.py` 文件

在 `tests` 目錄中創建 `conftest.py` 文件，提供通用的測試夾具 (fixtures)：

```python
import pytest
from unittest.mock import patch, MagicMock

@pytest.fixture
def mock_session():
    with patch("app.tasks.file_processing.SessionLocal") as mock_session_factory:
        mock_session = MagicMock()
        mock_session_factory.return_value = mock_session
        yield mock_session

@pytest.fixture
def mock_ws_manager():
    with patch("app.tasks.file_processing.ws_manager") as mock_ws:
        yield mock_ws
```

## 2. 單元測試

### 2.1 測試任務函數

使用 `unittest.mock` 對資料庫、外部 API 和 WebSocket 管理器進行模擬，專注於測試任務本身的邏輯。

#### 例子：測試文件處理任務

```python
@patch("app.tasks.file_processing.get_file_info")
@patch("app.tasks.file_processing.update_file_status")
@patch("app.tasks.file_processing.extract_text_from_pdf")
def test_process_uploaded_file_success(mock_extract, mock_update_status, mock_get_info):
    # 設置模擬回傳值
    file_uuid = str(uuid.uuid4())
    user_uuid = uuid.uuid4()
    
    mock_get_info.return_value = ({"test": "info"}, user_uuid)
    mock_extract.return_value = [{"sentence": "Test", "page": 1}]
    
    # 調用任務
    result = process_uploaded_file(file_uuid)
    
    # 驗證結果
    assert result["status"] == "success"
    assert result["file_uuid"] == file_uuid
```

### 2.2 測試個別步驟

針對複雜任務中的每個主要步驟編寫單獨的測試。

#### 例子：測試句子分類

```python
def test_classify_sentences(mock_httpx_client, mock_ws_manager):
    # 設置測試數據和模擬
    # ...
    
    # 執行函數
    result = classify_sentences(file_uuid, user_uuid, sentence_uuids, sentences)
    
    # 驗證結果
    assert len(result) == len(sentences)
    assert result[0]["defining_type"] in ("cd", "od", "none")
```

## 3. 整合測試

### 3.1 使用 Celery 測試工作器

使用 `celery.contrib.testing.worker` 進行真實的 Celery 任務執行測試。

```python
from celery.contrib.testing.worker import start_worker
import pytest

from app.worker import celery_app

@pytest.fixture(scope="module")
def celery_worker():
    with start_worker(celery_app, perform_ping_check=False):
        yield

def test_process_uploaded_file_task(celery_worker):
    # 準備測試數據
    file_uuid = str(uuid.uuid4())
    
    # 異步調用任務
    task_result = celery_app.send_task(
        "process_uploaded_file", 
        args=[file_uuid], 
        countdown=0
    )
    
    # 等待並檢查結果
    result = task_result.get(timeout=10)
    assert result["status"] == "success"
```

### 3.2 測試與資料庫的互動

使用測試資料庫進行實際資料庫操作測試。

```python
def test_store_classification_results_integration(test_db_session):
    # 創建測試數據
    # ...
    
    # 執行函數
    store_classification_results(file_uuid, classification_results)
    
    # 直接查詢資料庫驗證結果
    stored_sentences = test_db_session.query(Sentence).filter(
        Sentence.file_uuid == file_uuid
    ).all()
    
    # 驗證資料庫中的內容
    assert len(stored_sentences) == len(classification_results)
    # ...
```

## 4. 錯誤處理測試

### 4.1 測試異常處理

確保任務在發生錯誤時能夠正確處理和報告。

```python
def test_process_uploaded_file_error_handling(mock_get_info):
    # 模擬拋出異常
    mock_get_info.side_effect = Exception("Test error")
    
    # 調用任務，應拋出異常
    with pytest.raises(Exception) as exc_info:
        process_uploaded_file("invalid-uuid")
    
    # 驗證錯誤處理
    assert "Test error" in str(exc_info.value)
```

### 4.2 測試重試邏輯

確保設定了重試的任務能正確執行重試邏輯。

```python
@patch("app.tasks.chat_processing.send_keyword_extraction_completed_event")
@patch("httpx.Client")
@patch("time.sleep")
def test_extract_keywords_retry(mock_sleep, mock_client, mock_send_event):
    # 設置第一次呼叫失敗，第二次成功
    mock_instance = MagicMock()
    first_call = MagicMock()
    first_call.post.side_effect = httpx.RequestError("Connection error")
    
    second_call = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"keywords": ["test"]}
    second_call.post.return_value = mock_response
    
    mock_instance.__enter__.side_effect = [first_call, second_call]
    mock_client.return_value = mock_instance
    
    # 執行函數
    keywords = extract_keywords("test-uuid", uuid.uuid4(), "test query")
    
    # 驗證結果
    assert keywords == ["test"]
    assert mock_sleep.call_count == 1  # 確認等待了一次
```

## 5. 效能測試

### 5.1 批量操作測試

測試批量操作的效率，特別是資料庫操作。

```python
def test_store_classification_results_performance():
    # 創建大量測試數據
    large_results = [generate_mock_result() for _ in range(1000)]
    
    # 記錄執行時間
    start_time = time.time()
    store_classification_results(uuid.uuid4(), large_results)
    end_time = time.time()
    
    # 驗證執行時間在可接受範圍
    assert end_time - start_time < 5  # 應在5秒內完成
```

### 5.2 並發任務測試

測試系統在多個任務並發執行時的行為。

```python
def test_concurrent_tasks(celery_worker):
    # 準備多個任務
    task_results = []
    for _ in range(10):
        task_results.append(celery_app.send_task(
            "process_user_query", 
            args=[str(uuid.uuid4()), None, str(uuid.uuid4()), "test query"]
        ))
    
    # 驗證所有任務都成功完成
    for task in task_results:
        result = task.get(timeout=30)
        assert result["status"] == "success"
```

## 6. 最佳實踐

### 6.1 分離關注點

- 將測試劃分為單元測試、整合測試和端到端測試
- 單元測試應該快速且獨立，適合頻繁運行
- 整合測試驗證組件間交互，可能較慢

### 6.2 使用模擬和夾具

- 為常用的模擬對象創建可重用的夾具
- 模擬外部依賴，如資料庫、API和訊息佇列
- 使用 `pytest.mark.parametrize` 測試不同輸入

### 6.3 連續整合

- 在 CI 管道中自動運行測試
- 使用 `pytest-cov` 生成覆蓋率報告，目標達到 80% 以上
- 對於失敗的測試，生成詳細的錯誤報告

### 6.4 測試清理

- 測試後恢復環境至初始狀態
- 清理測試過程中創建的任何資源
- 使用 `yield` 夾具進行測試前/後清理

```python
@pytest.fixture
def test_file():
    # 設置
    file_uuid = uuid.uuid4()
    # 創建測試文件
    
    yield file_uuid
    
    # 清理
    # 刪除測試文件和相關記錄
```

---

## 附錄：常見測試場景

- 任務參數驗證
- 狀態更新和進度報告
- 外部 API 調用重試和容錯
- 資料庫操作
- WebSocket 事件發送
- 大檔案處理
- 高並發場景 