# WebSocket 與 Redis Pub/Sub 整合

## 概述

本文檔描述了系統中 WebSocket 實時通訊功能與 Redis Pub/Sub 的整合架構。此整合設計用於實現 Celery 任務與 FastAPI WebSocket 端點之間的解耦通訊，從而提供高效可靠的實時進度更新。

## 架構概述

系統實現了兩種互補的實時通訊機制：

1. **直接 WebSocket 連接**：用於前端與後端之間的實時通訊
2. **Redis Pub/Sub 通道**：用於後端服務之間的事件傳遞
3. **Redis 有序集合**：用於存儲最近的更新訊息，支持斷線重連時的狀態同步

這種設計有以下優點：
- 允許異步 Celery 任務向 WebSocket 客戶端推送更新
- 實現服務間的松耦合設計
- 支援水平擴展和高可用性
- 支援斷線重連和歷史訊息回放

![架構圖](../assets/websocket_redis_architecture.png)

## 主要組件

### 1. 連接管理器 (WebSocketManager)

`WebSocketManager` 負責管理活躍的 WebSocket 連接，包括：
- 維護連接狀態
- 用戶身份關聯
- 主題訂閱
- 訊息派發

### 2. Redis 發布器 (RedisPublisher)

`utils/redis_publisher.py` 模組提供了用於向 Redis 發布更新事件的功能：
- `publish_file_update()`：發布檔案處理更新
- `publish_query_update()`：發布查詢處理更新

這些方法可以從 Celery 任務或其他後端服務調用。此外，這些方法還會將訊息持久化到 Redis 有序集合中。

### 3. Redis 訂閱監聽器 (RedisListener)

`api/websockets/listener.py` 中的 Redis 訂閱監聽器：
- 在 FastAPI 啟動時初始化
- 訂閱相關的 Redis 通道
- 監聽來自 Celery 任務的更新
- 將更新轉發給相應的 WebSocket 客戶端

### 4. WebSocket Redis 適配器 (WebSocketRedisAdapter)

`core/websocket_redis_adapter.py` 提供了 Redis 消息與 WebSocket 管理器之間的橋接：
- 將從 Redis 接收的訊息轉換為 WebSocket 訊息格式
- 確保訊息被正確轉發到對應的主題

## 通訊流程

### 檔案處理進度更新

1. 用戶上傳文件後，啟動 Celery 任務進行處理
2. 客戶端建立 WebSocket 連接 (`/ws/processing/{file_uuid}`)
3. 連接建立後，系統會發送該檔案的最近更新訊息（最多10條）
4. 處理過程中，Celery 任務調用 `publish_file_update()`，將更新發布到 Redis 並存儲到有序集合
5. Redis 監聽器接收事件並通過 `manager.broadcast_file_update()` 轉發給相關的 WebSocket 連接
6. 連接的客戶端接收實時進度更新

### 查詢處理進度更新

類似於檔案處理，但使用查詢專用通道：
1. 客戶端連接到 `/ws/chat/{query_uuid}`
2. 連接建立後，系統會發送該查詢的最近更新訊息（最多10條）
3. Celery 任務通過 `publish_query_update()` 發布更新並存儲到有序集合
4. Redis 監聽器將更新轉發給相關的 WebSocket 連接

## 消息持久化與歷史記錄

系統使用 Redis 有序集合 (Sorted Set) 實現訊息持久化：

1. **有序集合命名規則**：
   - 檔案處理更新：`recent_updates:file:{file_uuid}`
   - 查詢處理更新：`recent_updates:query:{query_uuid}`

2. **存儲機制**：
   - 每次發布訊息時，同時將訊息存入對應的有序集合
   - 使用時間戳作為分數，確保訊息按時間順序排列
   - 每個資源的有序集合僅保留最近的10條訊息，避免佔用過多內存

3. **檢索機制**：
   - 當客戶端建立新連接時，系統會檢索對應資源的最近更新
   - 通過 `ZRANGE` 命令獲取所有存儲的訊息
   - 按照順序發送給客戶端，確保狀態同步

## 消息格式

所有消息使用 JSON 格式，包含以下基本字段：
- `event`: 事件類型
- `timestamp`: 事件發生時間
- 資源識別符 (`file_uuid` 或 `query_uuid`)
- 相關狀態和數據

## 安全性

WebSocket 連接實現了以下安全機制：
- JWT 令牌驗證
- 資源訪問權限驗證
- 連接生命周期管理

## 錯誤處理與恢復機制

系統實現了錯誤恢復機制：
- 斷開連接的自動清理
- 連接錯誤的優雅處理
- 斷線重連後的狀態同步
- 伺服器重啟後的連接恢復
- 詳細的日誌記錄

## 使用示例

### 前端建立 WebSocket 連接

```javascript
// 建立檔案處理 WebSocket 連接
const connect = (fileUuid, token) => {
  const ws = new WebSocket(`ws://api-server/ws/processing/${fileUuid}?token=${token}`);
  let connectionId = null;
  let serverStartTime = null;
  let heartbeatInterval = null;
  
  ws.onopen = () => {
    console.log('WebSocket 連接已建立');
    
    // 設定心跳機制，每 30 秒發送一次
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('收到更新:', data);
    
    // 保存連接 ID 和伺服器啟動時間
    if (data.event === 'connection_established') {
      connectionId = data.connection_id;
      serverStartTime = data.server_start_time;
      console.log(`連接已建立，ID: ${connectionId}`);
    }
    
    // 根據事件類型更新 UI
    switch (data.event) {
      case 'pdf_extraction_progress':
        updateProgressBar(data.progress);
        break;
      case 'sentence_classification_detail':
        displayClassificationResults(data.sentences);
        break;
      // 處理其他事件...
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket 連接已關閉');
    clearInterval(heartbeatInterval);
    
    // 斷線重連
    setTimeout(() => {
      console.log('嘗試重新連接...');
      connect(fileUuid, token);
    }, 3000);
  };
  
  return ws;
};
```

### Celery 任務發送更新

```python
from app.utils.redis_publisher import publish_file_update

@celery.task
def process_file(file_uuid):
    # 發送處理開始通知
    publish_file_update(
        file_uuid,
        "processing_started",
        {"status": "processing"}
    )
    
    # 處理過程...
    
    # 發送進度更新
    publish_file_update(
        file_uuid,
        "pdf_extraction_progress",
        {
            "progress": 50,
            "current": 10,
            "total": 20,
            "status": "processing"
        }
    )
    
    # 完成處理...
    
    # 發送完成通知
    publish_file_update(
        file_uuid,
        "processing_completed",
        {"status": "completed"}
    )
```

## 故障排除

常見問題和解決方案：

1. **連接無法建立**
   - 檢查認證令牌是否有效
   - 確認用戶有權訪問資源

2. **未收到更新**
   - 確認 Redis 服務運行正常
   - 檢查監聽器是否正確初始化
   - 驗證任務是否正確發布更新

3. **連接意外斷開**
   - 實現重連機制
   - 檢查網路連接和服務器負載
   
4. **斷線重連後無法接收歷史訊息**
   - 檢查 Redis 有序集合是否正確創建和維護
   - 確認前端實現了正確的斷線重連邏輯
   - 驗證 WebSocket 端點中的 `send_recent_updates` 函數是否正常執行

5. **伺服器重啟後的連接恢復問題**
   - 使用服務器啟動時間來識別重啟
   - 實現適當的重連和同步策略 