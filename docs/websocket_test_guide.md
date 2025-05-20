# WebSocket 測試指南

本文檔提供了測試 WebSocket 端點的相關說明和範例，包括如何使用提供的測試工具驗證 WebSocket 功能和模擬 Celery 任務向 WebSocket 發送消息。

## 目錄

1. [前置需求](#前置需求)
2. [測試工具介紹](#測試工具介紹)
3. [使用 WebSocket 客戶端工具進行測試](#使用-websocket-客戶端工具進行測試)
4. [模擬 Celery 任務發送更新](#模擬-celery-任務發送更新)
5. [使用 PyTest 執行自動化測試](#使用-pytest-執行自動化測試)
6. [驗證重點](#驗證重點)
7. [故障排除](#故障排除)

## 前置需求

在開始測試前，請確保以下環境已準備就緒:

* Python 3.10+ 環境
* Redis 伺服器 (用於 Pub/Sub 測試)
* 安裝所需的依賴包:
  ```bash
  pip install websockets redis pytest pytest-asyncio pytest-mock
  ```

## 測試工具介紹

本項目提供了以下測試工具：

1. **WebSocket 客戶端工具 (`websocket_client.py`)**:
   * 用於連接 WebSocket 端點
   * 支援認證
   * 發送 ping 消息並接收 pong 回應
   * 顯示實時接收的訊息

2. **Celery 任務模擬工具 (`simulate_celery_task.py`)**:
   * 模擬檔案處理任務向 WebSocket 發送進度更新
   * 模擬查詢處理任務向 WebSocket 發送進度更新
   * 使用 Redis Pub/Sub 機制發布消息

3. **自動化測試案例 (`test_websocket_endpoints.py`)**:
   * 使用 PyTest 框架
   * 測試 WebSocket 連接建立和認證
   * 測試消息廣播功能
   * 測試 Redis Pub/Sub 集成

## 使用 WebSocket 客戶端工具進行測試

### 測試檔案處理 WebSocket

```bash
python frontend/tests/websocket_client.py --url ws://localhost:8000/ws/processing/{file_uuid} --token {your_jwt_token}
```

### 測試查詢處理 WebSocket

```bash
python frontend/tests/websocket_client.py --url ws://localhost:8000/ws/chat/{query_uuid} --token {your_jwt_token}
```

### 命令行交互

連接成功後，可使用以下命令:
* `p` - 發送 ping 消息 (測試連接活性)
* `q` - 退出客戶端

### 認證測試

1. **不提供令牌**:
   ```bash
   python frontend/tests/websocket_client.py --url ws://localhost:8000/ws/processing/{file_uuid}
   ```
   期望結果: 連接被拒絕，顯示認證錯誤。

2. **提供無效令牌**:
   ```bash
   python frontend/tests/websocket_client.py --url ws://localhost:8000/ws/processing/{file_uuid} --token invalid_token
   ```
   期望結果: 連接被拒絕，顯示令牌無效錯誤。

3. **訪問無權限資源**:
   使用有效令牌訪問不存在或無權限的資源。
   期望結果: 連接被拒絕，顯示權限錯誤。

## 模擬 Celery 任務發送更新

### 模擬檔案處理任務

```bash
python frontend/tests/simulate_celery_task.py --type file --uuid {file_uuid} --redis-url redis://localhost:6379/0 --sentences 50 --delay 0.5
```

參數說明:
* `--type file` - 模擬檔案處理任務
* `--uuid` - 指定檔案 UUID (可省略，自動生成)
* `--sentences` - 模擬處理的句子總數
* `--delay` - 每個階段的延遲時間 (秒)

### 模擬查詢處理任務

```bash
python frontend/tests/simulate_celery_task.py --type query --uuid {query_uuid} --redis-url redis://localhost:6379/0 --delay 0.5
```

## 使用 PyTest 執行自動化測試

執行所有 WebSocket 測試:

```bash
pytest -xvs frontend/tests/test_websocket_endpoints.py
```

執行特定測試:

```bash
pytest -xvs frontend/tests/test_websocket_endpoints.py::test_file_processing_websocket_connection
```

## 驗證重點

在測試過程中，請特別關注以下驗證點:

1. **連接建立與認證**:
   * WebSocket 連接是否正確建立
   * 用戶認證是否正常工作
   * 資源訪問權限是否被正確驗證

2. **消息接收**:
   * 連接後是否接收到歡迎消息
   * 是否包含連接 ID 和伺服器時間
   * ping/pong 心跳機制是否正常

3. **進度更新**:
   * Celery 任務發送的更新是否通過 Redis 正確傳遞到 WebSocket
   * 更新消息格式是否符合預期
   * 消息接收是否按正確順序進行

4. **異常處理**:
   * 連接異常斷開時的處理
   * 無效消息的處理
   * 重連機制

## 故障排除

### 連接被拒絕

* 檢查 WebSocket 服務是否啟動
* 檢查令牌是否有效
* 檢查資源 UUID 是否存在

### 未收到更新消息

* 檢查 Redis 服務是否正常運行
* 檢查 Redis 監聽器是否正確初始化
* 檢查發布的頻道名稱是否正確

### 消息格式不符合預期

* 檢查消息格式是否符合 PRD 中定義的格式
* 檢查消息中的必要字段是否存在

### Redis 連接失敗

* 檢查 Redis URL 是否正確
* 檢查 Redis 服務是否啟動
* 檢查網絡連接是否通暢 