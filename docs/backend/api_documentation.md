# API 文檔

## 1. API 概述

本系統提供RESTful API和WebSocket連接，實現以下主要功能：
- 使用者認證與授權
- 檔案上傳與管理
- 聊天與問答服務
- 實時進度通知

所有API端點都以`/api`為前綴，並根據功能分組。

## 2. 認證 API

### 2.1 註冊

- **端點**: `/api/auth/register`
- **方法**: `POST`
- **請求體**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123"
  }
  ```
- **成功回應** (201 Created):
  ```json
  {
    "user_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2023-08-18T12:34:56.789Z"
  }
  ```
- **請求要求**:
  - 密碼長度至少 8 個字元，包含至少一個大寫字母和一個數字
  - 電子郵件格式必須有效

### 2.2 登入

- **端點**: `/api/auth/login`
- **方法**: `POST`
- **請求體**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123"
  }
  ```
- **成功回應** (200 OK):
  ```json
  {
    "user_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "token_type": "bearer"
  }
  ```

### 2.3 更新 Token

- **端點**: `/api/auth/refresh`
- **方法**: `POST`
- **請求體**:
  ```json
  {
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```
- **成功回應** (200 OK):
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "token_type": "bearer"
  }
  ```

### 2.4 登出

- **端點**: `/api/auth/logout`
- **方法**: `POST`
- **請求頭**: `Authorization: Bearer {access_token}`
- **成功回應** (200 OK):
  ```json
  {
    "detail": "成功登出"
  }
  ```

## 3. 檔案管理 API

### 3.1 上傳檔案

- **端點**: `/api/files/upload`
- **方法**: `POST`
- **請求頭**: `Authorization: Bearer {access_token}`
- **請求內容類型**: `multipart/form-data`
- **請求參數**:
  - `files`: 檔案列表 (支援多檔案上傳)
  - `chunk_number` (選填): 當前分片編號
  - `chunk_total` (選填): 總分片數
  - `file_id` (選填): 用於斷點續傳的檔案標識
- **成功回應** (201 Created):
  ```json
  {
    "files": [
      {
        "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "original_name": "example.pdf",
        "size_bytes": 1024000,
        "upload_status": "completed",
        "processing_status": "pending",
        "created_at": "2023-08-18T12:34:56.789Z"
      }
    ],
    "upload_id": "abc123"
  }
  ```
- **請求要求**:
  - 僅接受 PDF 檔案 (MIME type: application/pdf)
  - 單一檔案大小上限為 10MB
  - 支援分片上傳和斷點續傳

### 3.2 獲取檔案列表

- **端點**: `/api/files`
- **方法**: `GET`
- **請求頭**: `Authorization: Bearer {access_token}`
- **查詢參數**:
  - `page`: 頁碼 (預設: 1)
  - `limit`: 每頁項目數 (預設: 10, 最大: 50)
  - `sort_by`: 排序欄位 (可選: created_at, original_name)
  - `sort_order`: 排序方向 (可選: asc, desc, 預設: desc)
- **成功回應** (200 OK):
  ```json
  {
    "total": 25,
    "page": 1,
    "limit": 10,
    "files": [
      {
        "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "original_name": "example.pdf",
        "size_bytes": 1024000,
        "upload_status": "completed",
        "processing_status": "completed",
        "sentence_count": 120,
        "cd_count": 5,
        "od_count": 8,
        "created_at": "2023-08-18T12:34:56.789Z",
        "updated_at": "2023-08-18T13:00:00.000Z"
      }
    ]
  }
  ```

### 3.3 獲取檔案詳情

- **端點**: `/api/files/{file_uuid}`
- **方法**: `GET`
- **請求頭**: `Authorization: Bearer {access_token}`
- **路徑參數**:
  - `file_uuid`: 檔案的 UUID
- **成功回應** (200 OK):
  ```json
  {
    "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "user_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "original_name": "example.pdf",
    "size_bytes": 1024000,
    "minio_bucket_name": "user-550e8400-e29b-41d4-a716-446655440000",
    "minio_object_key": "550e8400-e29b-41d4-a716-446655440000.pdf",
    "upload_status": "completed",
    "processing_status": "completed",
    "error_message": null,
    "sentence_count": 120,
    "cd_count": 5,
    "od_count": 8,
    "created_at": "2023-08-18T12:34:56.789Z",
    "updated_at": "2023-08-18T13:00:00.000Z",
    "download_url": "https://api.example.com/files/550e8400-e29b-41d4-a716-446655440000/download",
    "preview_url": "https://api.example.com/files/550e8400-e29b-41d4-a716-446655440000/preview"
  }
  ```

### 3.4 下載檔案

- **端點**: `/api/files/{file_uuid}/download`
- **方法**: `GET`
- **請求頭**: `Authorization: Bearer {access_token}`
- **路徑參數**:
  - `file_uuid`: 檔案的 UUID
- **成功回應**: 檔案內容 (application/pdf)

### 3.5 刪除檔案

- **端點**: `/api/files/{file_uuid}`
- **方法**: `DELETE`
- **請求頭**: `Authorization: Bearer {access_token}`
- **路徑參數**:
  - `file_uuid`: 檔案的 UUID
- **成功回應** (200 OK):
  ```json
  {
    "detail": "檔案已成功刪除"
  }
  ```

## 4. 聊天與問答 API

### 4.1 發送查詢

- **端點**: `/api/chat/query`
- **方法**: `POST`
- **請求頭**: `Authorization: Bearer {access_token}`
- **請求體**:
  ```json
  {
    "query": "什麼是概念型定義?",
    "file_uuids": ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
    "chat_uuid": "550e8400-e29b-41d4-a716-446655440002"
  }
  ```
- **成功回應** (202 Accepted):
  ```json
  {
    "task_id": "550e8400-e29b-41d4-a716-446655440003",
    "status": "processing",
    "message_uuid": "550e8400-e29b-41d4-a716-446655440004",
    "websocket_path": "/api/ws/chat/550e8400-e29b-41d4-a716-446655440002"
  }
  ```

### 4.2 獲取聊天歷史

- **端點**: `/api/chat/history`
- **方法**: `GET`
- **請求頭**: `Authorization: Bearer {access_token}`
- **查詢參數**:
  - `page`: 頁碼 (預設: 1)
  - `limit`: 每頁項目數 (預設: 10, 最大: 50)
- **成功回應** (200 OK):
  ```json
  {
    "total": 5,
    "page": 1,
    "limit": 10,
    "chats": [
      {
        "chat_uuid": "550e8400-e29b-41d4-a716-446655440002",
        "title": "關於概念型定義的討論",
        "created_at": "2023-08-18T12:34:56.789Z",
        "updated_at": "2023-08-18T13:00:00.000Z",
        "message_count": 10
      }
    ]
  }
  ```

### 4.3 獲取聊天消息

- **端點**: `/api/chat/{chat_uuid}/messages`
- **方法**: `GET`
- **請求頭**: `Authorization: Bearer {access_token}`
- **路徑參數**:
  - `chat_uuid`: 聊天的 UUID
- **查詢參數**:
  - `page`: 頁碼 (預設: 1)
  - `limit`: 每頁項目數 (預設: 20, 最大: 100)
- **成功回應** (200 OK):
  ```json
  {
    "total": 10,
    "page": 1,
    "limit": 20,
    "messages": [
      {
        "message_uuid": "550e8400-e29b-41d4-a716-446655440004",
        "chat_uuid": "550e8400-e29b-41d4-a716-446655440002",
        "content": "什麼是概念型定義?",
        "role": "user",
        "created_at": "2023-08-18T12:34:56.789Z"
      },
      {
        "message_uuid": "550e8400-e29b-41d4-a716-446655440005",
        "chat_uuid": "550e8400-e29b-41d4-a716-446655440002",
        "content": "概念型定義(CD)是指定義一個概念的本質、特性或範疇的陳述。與操作型定義不同，概念型定義通常不涉及如何測量或觀察該概念。",
        "role": "assistant",
        "created_at": "2023-08-18T12:35:10.456Z",
        "references": [
          {
            "sentence_uuid": "550e8400-e29b-41d4-a716-446655440006",
            "content": "概念型定義(Conceptual Definition)是對一個概念的本質、範疇和特點的理論性闡述。",
            "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "page_number": 5
          }
        ]
      }
    ]
  }
  ```

## 5. WebSocket API

### 5.1 檔案處理進度通知

- **WebSocket端點**: `/api/ws/files/{file_uuid}`
- **訪問權限**: 需要在URL查詢參數中提供token
  ```
  /api/ws/files/550e8400-e29b-41d4-a716-446655440000?token=eyJhbGciOiJIUzI1NiIsInR5cCI6...
  ```
- **消息格式**:
  ```json
  {
    "event": "processing_progress",
    "data": {
      "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "status": "extracting",
      "progress": 45,
      "message": "抽取文本中...",
      "timestamp": "2023-08-18T12:36:00.123Z"
    }
  }
  ```

### 5.2 聊天消息與進度通知

- **WebSocket端點**: `/api/ws/chat/{chat_uuid}`
- **訪問權限**: 需要在URL查詢參數中提供token
  ```
  /api/ws/chat/550e8400-e29b-41d4-a716-446655440002?token=eyJhbGciOiJIUzI1NiIsInR5cCI6...
  ```
- **消息格式**:
  ```json
  {
    "event": "query_processing",
    "data": {
      "task_id": "550e8400-e29b-41d4-a716-446655440003",
      "status": "processing",
      "stage": "generating_answer",
      "progress": 75,
      "message": "生成回答中...",
      "message_uuid": "550e8400-e29b-41d4-a716-446655440004",
      "timestamp": "2023-08-18T12:36:30.456Z",
      "references": [
        {
          "sentence_uuid": "550e8400-e29b-41d4-a716-446655440006",
          "content": "概念型定義(Conceptual Definition)是對一個概念的本質、範疇和特點的理論性闡述。",
          "file_uuid": "550e8400-e29b-41d4-a716-446655440000",
          "page_number": 5
        }
      ]
    }
  }
  ```

## 6. API 認證與安全

### 6.1 認證機制
所有API (除了註冊和登入) 都需要在HTTP請求頭中提供JWT token：
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### 6.2 WebSocket 認證
WebSocket連接需要在URL查詢參數中提供token：
```
/api/ws/chat/550e8400-e29b-41d4-a716-446655440002?token=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### 6.3 Rate Limiting
為防止濫用，API實施了速率限制：
- 驗證endpoints: 每IP每分鐘最多20次請求
- 檔案上傳: 每用戶每小時最多10次上傳
- 問答請求: 每用戶每分鐘最多5次查詢 