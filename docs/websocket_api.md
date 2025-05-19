# WebSocket API 文件

本文檔說明系統中的 WebSocket API 端點、認證方式、訊息格式及使用方法。

## 1. 認證方式

所有 WebSocket 連接都需要進行身份驗證。認證是通過在 WebSocket 連接 URL 的查詢參數中添加 JWT 令牌完成的：

```
ws://server_address/ws/processing/{file_uuid}?token=your_jwt_token
```

- `token`: 通過 `/api/auth/login` 端點獲得的有效 JWT 令牌
- 只有檔案或查詢的所有者才能訂閱其處理進度

## 2. 檔案處理進度 WebSocket 端點

### 2.1 端點 URL

```
ws://server_address/ws/processing/{file_uuid}
```

- `{file_uuid}`: 檔案的 UUID

### 2.2 事件類型

此端點支援以下事件類型：

1. **connection_established**: 連接建立成功
2. **processing_started**: 處理開始
3. **pdf_extraction_progress**: PDF 文本提取進度
4. **sentence_extraction_detail**: 每批句子提取的詳細信息
5. **sentence_classification_progress**: 句子分類進度
6. **sentence_classification_detail**: 句子分類的詳細信息
7. **processing_completed**: 處理完成
8. **processing_failed**: 處理失敗
9. **pong**: 心跳響應

### 2.3 訊息格式

所有訊息都是 JSON 格式，包含以下通用欄位：

- `event`: 事件類型
- `file_uuid`: 檔案 UUID
- `timestamp`: 時間戳

根據事件類型，還可能包含以下欄位：

- `connection_id`: 連接唯一標識符（用於斷線重連）
- `server_start_time`: 伺服器啟動時間（用於檢測系統重啟）
- `status`: 處理狀態
- `progress`: 進度百分比 (0-100)
- `current`: 當前處理的項目數量
- `total`: 項目總數
- `sentences`: 處理的句子列表
- `error_message`: 錯誤訊息

### 2.4 範例訊息

1. **連接建立**：
```json
{
  "event": "connection_established",
  "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "connection_id": "fbe92385-5a1c-4d9e-8e4b-b2f15f26b8d5",
  "server_start_time": "2023-08-18T10:00:00.000Z",
  "message": "已成功連接到檔案處理 WebSocket",
  "timestamp": "2023-08-18T12:39:00.000Z"
}
```

2. **處理進度更新**：
```json
{
  "event": "sentence_classification_progress",
  "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 45,
  "current": 54,
  "total": 120,
  "status": "processing",
  "timestamp": "2023-08-18T12:40:00.000Z"
}
```

3. **句子分類詳情**：
```json
{
  "event": "sentence_classification_detail",
  "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "sentences": [
    {
      "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "sentence": "自適應專業知識是指...",
      "defining_type": "cd",
      "reason": "此句包含明確的概念定義",
      "page": 1
    }
  ],
  "timestamp": "2023-08-18T12:40:05.000Z"
}
```

4. **處理完成**：
```json
{
  "event": "processing_completed",
  "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 100,
  "status": "completed",
  "timestamp": "2023-08-18T13:00:00.000Z"
}
```

5. **處理失敗**：
```json
{
  "event": "processing_failed",
  "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "error_message": "處理過程中發生錯誤：無法解析 PDF 內容",
  "timestamp": "2023-08-18T12:45:00.000Z"
}
```

6. **心跳響應**：
```json
{
  "event": "pong",
  "timestamp": "2023-08-18T12:45:10.000Z"
}
```

### 2.5 使用範例 (JavaScript)

```javascript
// 連接 WebSocket
const connectProcessingWebSocket = (fileUuid, token) => {
  const socket = new WebSocket(`ws://server_address/ws/processing/${fileUuid}?token=${token}`);
  let lastConnectionId = null;
  let serverStartTime = null;
  let heartbeatInterval = null;
  
  socket.onopen = () => {
    console.log('WebSocket 連接已建立');
    
    // 設定心跳機制，每 30 秒發送一次
    heartbeatInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('收到更新:', data);
    
    // 保存連接 ID 和伺服器啟動時間
    if (data.event === 'connection_established') {
      lastConnectionId = data.connection_id;
      serverStartTime = data.server_start_time;
    }
    
    switch (data.event) {
      case 'processing_started':
        // 處理開始
        break;
      case 'sentence_extraction_detail':
        // 顯示提取的句子
        break;
      case 'sentence_classification_progress':
        // 更新進度條
        updateProgressBar(data.progress);
        break;
      case 'processing_completed':
        // 處理完成
        break;
      case 'processing_failed':
        // 顯示錯誤訊息
        break;
    }
  };
  
  socket.onclose = (event) => {
    console.log('WebSocket 連接已關閉:', event.code, event.reason);
    clearInterval(heartbeatInterval);
    
    // 自動重連
    setTimeout(() => {
      console.log('嘗試重新連接...');
      connectProcessingWebSocket(fileUuid, token);
    }, 3000);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket 錯誤:', error);
  };
  
  return socket;
};
```

### 2.6 斷線重連與歷史訊息

系統支援斷線重連和歷史訊息功能：

1. **斷線重連**: 當 WebSocket 連接斷開時，客戶端可以使用相同的 URL 重新連接。
2. **連接 ID**: 每次建立連接時，服務器會生成一個唯一的連接 ID，可用於識別連接。
3. **伺服器啟動時間**: 通過比較伺服器啟動時間，客戶端可以檢測服務器是否重啟。
4. **歷史訊息**: 連接建立後，系統會發送該資源的最近更新（最多 10 條），確保客戶端能獲取之前錯過的消息。

## 3. 查詢處理進度 WebSocket 端點

### 3.1 端點 URL

```
ws://server_address/ws/chat/{query_uuid}
```

- `{query_uuid}`: 查詢的 UUID

### 3.2 事件類型

此端點支援以下事件類型：

1. **connection_established**: 連接建立成功
2. **query_processing_started**: 查詢處理開始
3. **keyword_extraction_completed**: 關鍵詞提取完成
4. **database_search_progress**: 資料庫搜尋進度
5. **database_search_result**: 資料庫搜尋結果
6. **answer_generation_started**: 答案生成開始
7. **referenced_sentences**: 生成答案時參考的關鍵句子
8. **query_completed**: 查詢處理完成
9. **query_failed**: 查詢處理失敗
10. **pong**: 心跳響應

### 3.3 訊息格式

所有訊息都是 JSON 格式，包含以下通用欄位：

- `event`: 事件類型
- `query_uuid`: 查詢 UUID
- `timestamp`: 時間戳

根據事件類型，還可能包含以下欄位：

- `connection_id`: 連接唯一標識符（用於斷線重連）
- `server_start_time`: 伺服器啟動時間（用於檢測系統重啟）
- `status`: 處理狀態
- `keywords`: 提取的關鍵詞列表
- `progress`: 進度百分比 (0-100)
- `current_step`: 當前處理步驟描述
- `found_definitions`: 找到的定義數量 (按類型分類)
- `found_sentences`: 找到的句子列表
- `referenced_sentences`: 生成答案時參考的句子列表
- `error_message`: 錯誤訊息

### 3.4 範例訊息

1. **連接建立**：
```json
{
  "event": "connection_established",
  "query_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "connection_id": "fbe92385-5a1c-4d9e-8e4b-b2f15f26b8d5",
  "server_start_time": "2023-08-18T10:00:00.000Z",
  "message": "已成功連接到查詢處理 WebSocket",
  "timestamp": "2023-08-18T12:39:00.000Z"
}
```

2. **資料庫搜尋進度**：
```json
{
  "event": "database_search_progress",
  "query_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "keywords": ["自適應專業知識", "專業知識"],
  "progress": 60,
  "current_step": "正在搜尋資料庫中符合關鍵詞的定義",
  "found_definitions": {
    "cd": 3,
    "od": 2
  },
  "timestamp": "2023-08-18T12:40:10.000Z"
}
```

3. **資料庫搜尋結果**：
```json
{
  "event": "database_search_result",
  "query_uuid": "550e8400-e29b-41d4-a716-446655440000", 
  "keyword": "自適應專業知識",
  "found_sentences": [
    {
      "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "original_name": "example.pdf",
      "sentence": "自適應專業知識是指...",
      "page": 3,
      "defining_type": "cd",
      "relevance_score": 0.92
    }
  ],
  "timestamp": "2023-08-18T12:40:15.000Z"
}
```

4. **參考句子**：
```json
{
  "event": "referenced_sentences",
  "query_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "referenced_sentences": [
    {
      "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "original_name": "example.pdf",
      "sentence": "自適應專業知識是指...",
      "page": 3,
      "defining_type": "cd"
    }
  ],
  "timestamp": "2023-08-18T12:40:20.000Z"
}
```

5. **查詢完成**：
```json
{
  "event": "query_completed",
  "query_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "timestamp": "2023-08-18T12:41:00.000Z"
}
```

### 3.5 使用範例 (JavaScript)

```javascript
// 連接 WebSocket
const connectChatWebSocket = (queryUuid, token) => {
  const socket = new WebSocket(`ws://server_address/ws/chat/${queryUuid}?token=${token}`);
  let lastConnectionId = null;
  let serverStartTime = null;
  let heartbeatInterval = null;
  
  socket.onopen = () => {
    console.log('Chat WebSocket 連接已建立');
    
    // 設定心跳機制，每 30 秒發送一次
    heartbeatInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('收到查詢更新:', data);
    
    // 保存連接 ID 和伺服器啟動時間
    if (data.event === 'connection_established') {
      lastConnectionId = data.connection_id;
      serverStartTime = data.server_start_time;
    }
    
    switch (data.event) {
      case 'query_processing_started':
        // 處理開始
        break;
      case 'database_search_progress':
        // 更新搜索進度
        break;
      case 'referenced_sentences':
        // 顯示參考的句子
        break;
      case 'query_completed':
        // 查詢完成
        break;
    }
  };
  
  socket.onclose = (event) => {
    console.log('Chat WebSocket 連接已關閉:', event.code, event.reason);
    clearInterval(heartbeatInterval);
    
    // 自動重連
    setTimeout(() => {
      console.log('嘗試重新連接...');
      connectChatWebSocket(queryUuid, token);
    }, 3000);
  };
  
  socket.onerror = (error) => {
    console.error('Chat WebSocket 錯誤:', error);
  };
  
  return socket;
};
```

### 3.6 斷線重連與歷史訊息

系統支援斷線重連和歷史訊息功能：

1. **斷線重連**: 當 WebSocket 連接斷開時，客戶端可以使用相同的 URL 重新連接。
2. **連接 ID**: 每次建立連接時，服務器會生成一個唯一的連接 ID，可用於識別連接。
3. **伺服器啟動時間**: 通過比較伺服器啟動時間，客戶端可以檢測服務器是否重啟。
4. **歷史訊息**: 連接建立後，系統會發送該資源的最近更新（最多 10 條），確保客戶端能獲取之前錯過的消息。

## 4. 心跳機制

為了保持連接活躍並檢測斷線，客戶端可以定期發送心跳訊息：

```json
{
  "type": "ping"
}
```

服務器會回應：

```json
{
  "event": "pong",
  "timestamp": "2023-08-18T12:45:10.000Z"
}
```

建議的心跳間隔為 30 秒。

## 5. 最佳實踐

### 5.1 連接管理

- 每個需要監控進度的檔案或查詢建立一個單獨的 WebSocket 連接
- 在不再需要時關閉連接，釋放資源
- 實現錯誤處理和重連機制
- 處理認證過期情況

### 5.2 效能考慮

- 不要建立不必要的連接
- 適當處理接收的數據，避免在處理大量更新時影響 UI 性能
- 考慮節流 (throttling) 或批處理 (batching) 來改善 UI 更新效率

### 5.3 安全考慮

- 始終通過安全連接 (WSS) 而非不安全連接 (WS) 來傳輸數據
- 不要在客戶端代碼中硬編碼 JWT 令牌
- 實現令牌刷新機制，處理令牌過期情況 