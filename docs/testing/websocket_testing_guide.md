# WebSocket 端點測試指南

本文檔提供測試 WebSocket 端點的詳細步驟，包括基本連接測試、認證測試、訊息接收測試、多客戶端測試和斷線重連測試。

## 1. 準備工作

### 1.1 安裝測試工具

推薦使用 `wscat` 命令行工具進行測試：

```bash
# 使用 npm 安裝 wscat
npm install -g wscat
```

或者使用基於瀏覽器的 WebSocket 客戶端，如 Simple WebSocket Client。

### 1.2 獲取認證令牌

在測試之前，需要獲取有效的 JWT 令牌：

```bash
# 使用 curl 獲取令牌
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}' \
  | grep -o '"access_token":"[^"]*"' | sed 's/"access_token":"\(.*\)"/\1/'
```

## 2. 基本連接測試

### 2.1 檔案處理 WebSocket 連接

使用 wscat 連接到檔案處理 WebSocket：

```bash
# 替換 <token> 為有效的 JWT 令牌，<file_uuid> 為有效的檔案 UUID
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

預期結果：

```json
{
  "event": "connection_established",
  "file_uuid": "<file_uuid>",
  "connection_id": "<uuid>",
  "server_start_time": "<iso-datetime>",
  "message": "已成功連接到檔案處理 WebSocket",
  "timestamp": "<iso-datetime>"
}
```

### 2.2 查詢處理 WebSocket 連接

使用 wscat 連接到查詢處理 WebSocket：

```bash
# 替換 <token> 為有效的 JWT 令牌，<query_uuid> 為有效的查詢 UUID
wscat -c "ws://localhost:8000/ws/chat/<query_uuid>?token=<token>"
```

預期結果與檔案處理 WebSocket 類似。

## 3. 認證與授權測試

### 3.1 無令牌連接測試

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>"
```

預期結果：

```json
{
  "event": "error",
  "detail": "認證失敗：未提供有效的認證令牌",
  "timestamp": "<iso-datetime>"
}
```

### 3.2 無效令牌連接測試

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=invalid.token.value"
```

預期結果：

```json
{
  "event": "error",
  "detail": "認證失敗：令牌無效或已過期",
  "timestamp": "<iso-datetime>"
}
```

### 3.3 無權限連接測試

使用其他用戶的令牌：

```bash
# 使用用戶A的令牌嘗試訪問用戶B的檔案
wscat -c "ws://localhost:8000/ws/processing/<user_B_file_uuid>?token=<user_A_token>"
```

預期結果：

```json
{
  "event": "error",
  "detail": "權限錯誤：您沒有權限訪問該檔案",
  "timestamp": "<iso-datetime>"
}
```

## 4. 訊息接收測試

### 4.1 手動發送檔案處理訊息

在一個終端運行 WebSocket 連接：

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

在另一個終端使用 Redis CLI 發送測試訊息：

```bash
# 安裝 redis-cli
sudo apt install redis-cli

# 發送測試訊息
redis-cli PUBLISH "file_updates:<file_uuid>" '{"event":"pdf_extraction_progress","file_uuid":"<file_uuid>","progress":50,"current":5,"total":10,"status":"processing","timestamp":"2023-08-18T12:40:00.000Z"}'
```

WebSocket 客戶端應該能接收到發送的訊息。

### 4.2 使用 Python 腳本測試

創建一個 Python 腳本測試不同類型的訊息：

```python
import redis
import json
import time
import uuid
from datetime import datetime, timezone

# 連接到 Redis
r = redis.from_url("redis://localhost:6379/0")

# 要測試的檔案 UUID
file_uuid = "550e8400-e29b-41d4-a716-446655440000"  # 替換為實際的檔案 UUID

# 發送處理開始事件
start_message = {
    "event": "processing_started",
    "file_uuid": file_uuid,
    "status": "processing",
    "timestamp": datetime.now(timezone.utc).isoformat()
}
r.publish(f"file_updates:{file_uuid}", json.dumps(start_message))
print(f"已發送 processing_started 事件")
time.sleep(1)

# 發送進度更新
for i in range(10):
    progress = i * 10
    progress_message = {
        "event": "pdf_extraction_progress",
        "file_uuid": file_uuid,
        "progress": progress,
        "current": i,
        "total": 10,
        "status": "processing",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    r.publish(f"file_updates:{file_uuid}", json.dumps(progress_message))
    print(f"已發送進度更新: {progress}%")
    time.sleep(1)

# 發送完成事件
complete_message = {
    "event": "processing_completed",
    "file_uuid": file_uuid,
    "status": "completed",
    "timestamp": datetime.now(timezone.utc).isoformat()
}
r.publish(f"file_updates:{file_uuid}", json.dumps(complete_message))
print(f"已發送 processing_completed 事件")
```

保存為 `test_websocket.py` 並運行：

```bash
python test_websocket.py
```

## 5. 多客戶端測試

在多個終端中運行 WebSocket 客戶端，連接到同一個資源：

```bash
# 終端 1
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"

# 終端 2
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"

# 終端 3
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

然後使用上面的 Python 腳本發送測試訊息，確認所有客戶端都能接收到訊息。

## 6. 斷線重連測試

### 6.1 客戶端斷線重連

1. 連接到 WebSocket 並記錄連接 ID：

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

2. 關閉連接 (按 Ctrl+C)

3. 使用同樣的參數重新連接：

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

4. 記錄新的連接 ID，驗證是否收到之前發送的最近更新

### 6.2 伺服器重啟測試

1. 連接到 WebSocket 並記錄伺服器啟動時間：

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

2. 重啟伺服器：

```bash
# 在伺服器上運行
sudo systemctl restart app_backend
```

3. 重新連接並比較新的伺服器啟動時間：

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

4. 驗證是否收到最近的更新

## 7. Ping/Pong 測試

測試心跳機制：

1. 連接到 WebSocket：

```bash
wscat -c "ws://localhost:8000/ws/processing/<file_uuid>?token=<token>"
```

2. 發送 ping 訊息：

```json
{"type": "ping"}
```

3. 預期收到 pong 響應：

```json
{
  "event": "pong",
  "timestamp": "<iso-datetime>"
}
```

## 8. WebSocket 連接計數測試

測試系統能否正確跟踪活躍連接數：

1. 創建多個連接

2. 發送測試訊息，查看日誌中的連接數信息

3. 斷開部分連接，確認日誌中報告的連接數正確減少 