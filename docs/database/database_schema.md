# 資料庫結構設計文檔

## 1. 概述

本文檔詳細說明系統資料庫的設計，包括 PostgreSQL 關聯式資料庫的表結構、索引策略、約束條件以及 MinIO 物件儲存的設計。

系統採用雙數據庫架構：
- **PostgreSQL**：儲存結構化資料，如用戶信息、檔案元數據、句子內容和對話記錄
- **MinIO**：儲存非結構化資料，如原始 PDF 檔案和處理中間結果

## 2. PostgreSQL 資料表結構

### 2.1 使用者資料表 (users)

儲存使用者帳戶信息。

```sql
CREATE TABLE users (
    user_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| user_uuid | UUID | 主鍵，使用者唯一識別碼 |
| email | VARCHAR(255) | 使用者電子郵件，唯一值 |
| password_hash | VARCHAR(255) | 使用者密碼雜湊值 |
| created_at | TIMESTAMPTZ | 帳戶創建時間 |
| updated_at | TIMESTAMPTZ | 帳戶最後更新時間 |
| last_login_at | TIMESTAMPTZ | 最後登入時間 |

### 2.2 檔案資料表 (files)

儲存用戶上傳檔案的元數據和處理狀態。

```sql
CREATE TABLE files (
    file_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    minio_bucket_name VARCHAR(100) NOT NULL,
    minio_object_key VARCHAR(255) NOT NULL,
    upload_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sentence_count INTEGER DEFAULT 0,
    cd_count INTEGER DEFAULT 0,
    od_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    upload_started_at TIMESTAMPTZ,
    upload_completed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| file_uuid | UUID | 主鍵，檔案唯一識別碼 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| original_name | VARCHAR(255) | 原始檔案名稱 |
| size_bytes | BIGINT | 檔案大小 (位元組) |
| minio_bucket_name | VARCHAR(100) | MinIO Bucket 名稱 |
| minio_object_key | VARCHAR(255) | MinIO 物件鍵值 |
| upload_status | VARCHAR(20) | 上傳狀態 ('pending', 'in_progress', 'completed', 'failed', 'timeout') |
| processing_status | VARCHAR(20) | 處理狀態 ('pending', 'in_progress', 'completed', 'failed') |
| error_message | TEXT | 錯誤訊息 (如果有) |
| sentence_count | INTEGER | 檔案中句子總數 |
| cd_count | INTEGER | 概念型定義 (CD) 句子數量 |
| od_count | INTEGER | 操作型定義 (OD) 句子數量 |
| created_at | TIMESTAMPTZ | 記錄創建時間 |
| updated_at | TIMESTAMPTZ | 記錄最後更新時間 |
| upload_started_at | TIMESTAMPTZ | 上傳開始時間 |
| upload_completed_at | TIMESTAMPTZ | 上傳完成時間 |
| version | INTEGER | 版本號，用於樂觀鎖 |

### 2.3 句子資料表 (sentences)

儲存從 PDF 檔案中提取的句子及其分類結果。

```sql
CREATE TABLE sentences (
    sentence_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_uuid UUID NOT NULL REFERENCES files(file_uuid) ON DELETE CASCADE,
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    sentence TEXT NOT NULL,
    page INTEGER NOT NULL,
    defining_type VARCHAR(10) DEFAULT 'none',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| sentence_uuid | UUID | 主鍵，句子唯一識別碼 |
| file_uuid | UUID | 外鍵，關聯到 files 表 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| sentence | TEXT | 句子內容 |
| page | INTEGER | 句子所在頁碼 |
| defining_type | VARCHAR(10) | 定義類型 ('cd', 'od', 'none') |
| reason | TEXT | 分類原因 |
| created_at | TIMESTAMPTZ | 記錄創建時間 |
| updated_at | TIMESTAMPTZ | 記錄最後更新時間 |

### 2.4 對話資料表 (conversations)

儲存使用者的對話上下文。

```sql
CREATE TABLE conversations (
    conversation_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT '新對話',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| conversation_uuid | UUID | 主鍵，對話唯一識別碼 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| title | VARCHAR(255) | 對話標題 |
| created_at | TIMESTAMPTZ | 對話創建時間 |
| updated_at | TIMESTAMPTZ | 對話最後更新時間 |
| last_message_at | TIMESTAMPTZ | 最後一條消息的時間 |

### 2.5 消息資料表 (messages)

儲存對話中的消息（用戶查詢和系統回應）。

```sql
CREATE TABLE messages (
    message_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_uuid UUID NOT NULL REFERENCES conversations(conversation_uuid) ON DELETE CASCADE,
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| message_uuid | UUID | 主鍵，消息唯一識別碼 |
| conversation_uuid | UUID | 外鍵，關聯到 conversations 表 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| role | VARCHAR(20) | 消息角色 ('user' 或 'assistant') |
| content | TEXT | 消息內容 |
| created_at | TIMESTAMPTZ | 消息創建時間 |

### 2.6 消息引用資料表 (message_references)

儲存系統回應中引用的原文句子關聯。

```sql
CREATE TABLE message_references (
    reference_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_uuid UUID NOT NULL REFERENCES messages(message_uuid) ON DELETE CASCADE,
    sentence_uuid UUID NOT NULL REFERENCES sentences(sentence_uuid) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| reference_uuid | UUID | 主鍵，引用唯一識別碼 |
| message_uuid | UUID | 外鍵，關聯到 messages 表 |
| sentence_uuid | UUID | 外鍵，關聯到 sentences 表 |
| created_at | TIMESTAMPTZ | 引用創建時間 |

### 2.7 上傳分片資料表 (upload_chunks)

追踪檔案分片上傳狀態，支援斷點續傳。

```sql
CREATE TABLE upload_chunks (
    chunk_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    upload_id VARCHAR(100) NOT NULL,
    file_id VARCHAR(100) NOT NULL,
    chunk_number INTEGER NOT NULL,
    chunk_total INTEGER NOT NULL,
    chunk_size BIGINT NOT NULL,
    minio_bucket_name VARCHAR(100) NOT NULL,
    minio_object_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| chunk_uuid | UUID | 主鍵，分片唯一識別碼 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| upload_id | VARCHAR(100) | 上傳 ID |
| file_id | VARCHAR(100) | 檔案 ID |
| chunk_number | INTEGER | 分片編號 |
| chunk_total | INTEGER | 分片總數 |
| chunk_size | BIGINT | 分片大小 (位元組) |
| minio_bucket_name | VARCHAR(100) | MinIO Bucket 名稱 |
| minio_object_key | VARCHAR(255) | MinIO 物件鍵值 |
| created_at | TIMESTAMPTZ | 記錄創建時間 |
| expires_at | TIMESTAMPTZ | 記錄過期時間 |

### 2.8 刪除日誌表 (deletion_logs)

追踪檔案刪除操作，確保資料庫和 MinIO 的數據同步。

```sql
CREATE TABLE deletion_logs (
    log_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_uuid UUID NOT NULL,
    minio_bucket_name VARCHAR(100) NOT NULL,
    minio_object_key VARCHAR(255) NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    minio_cleanup_status VARCHAR(20) DEFAULT 'pending',
    minio_cleanup_attempts INTEGER DEFAULT 0,
    minio_cleanup_completed_at TIMESTAMPTZ
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| log_uuid | UUID | 主鍵，日誌唯一識別碼 |
| file_uuid | UUID | 已刪除的檔案 UUID |
| minio_bucket_name | VARCHAR(100) | MinIO Bucket 名稱 |
| minio_object_key | VARCHAR(255) | MinIO 物件鍵值 |
| deleted_at | TIMESTAMPTZ | 資料庫記錄刪除時間 |
| minio_cleanup_status | VARCHAR(20) | MinIO 清理狀態 |
| minio_cleanup_attempts | INTEGER | 清理嘗試次數 |
| minio_cleanup_completed_at | TIMESTAMPTZ | MinIO 清理完成時間 |

### 2.9 使用者密碼重設表 (password_reset_tokens)

追踪密碼重設請求的令牌。

```sql
CREATE TABLE password_reset_tokens (
    token_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    token VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| token_uuid | UUID | 主鍵，令牌唯一識別碼 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| token | VARCHAR(100) | 重設令牌 |
| created_at | TIMESTAMPTZ | 令牌創建時間 |
| expires_at | TIMESTAMPTZ | 令牌過期時間 |
| used | BOOLEAN | 令牌是否已使用 |

### 2.10 系統活動日誌表 (system_activity_logs)

記錄系統活動，用於審計和故障排查。

```sql
CREATE TABLE system_activity_logs (
    log_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(user_uuid) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_uuid UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| log_uuid | UUID | 主鍵，日誌唯一識別碼 |
| user_uuid | UUID | 外鍵，關聯到 users 表 |
| action_type | VARCHAR(50) | 動作類型 |
| entity_type | VARCHAR(50) | 實體類型 |
| entity_uuid | UUID | 實體 UUID |
| details | JSONB | 詳細資訊 (JSON 格式) |
| ip_address | VARCHAR(45) | IP 地址 |
| user_agent | TEXT | 使用者代理 |
| created_at | TIMESTAMPTZ | 記錄創建時間 |

### 2.11 處理進度表 (processing_progress)

追踪檔案處理進度，實時回報進度給前端。

```sql
CREATE TABLE processing_progress (
    progress_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_uuid UUID NOT NULL REFERENCES files(file_uuid) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);
```

| 欄位名稱 | 資料類型 | 說明 |
|----------|----------|------|
| progress_uuid | UUID | 主鍵，進度唯一識別碼 |
| file_uuid | UUID | 外鍵，關聯到 files 表 |
| stage | VARCHAR(50) | 處理階段 |
| progress_percentage | INTEGER | 進度百分比 (0-100) |
| status | VARCHAR(20) | 狀態 |
| started_at | TIMESTAMPTZ | 階段開始時間 |
| completed_at | TIMESTAMPTZ | 階段完成時間 |
| error_message | TEXT | 錯誤訊息 (如果有) |

## 3. 索引與約束

### 3.1 主要索引

#### users 表索引
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);
```

#### files 表索引
```sql
CREATE INDEX idx_files_user_uuid ON files(user_uuid);
CREATE INDEX idx_files_upload_status ON files(upload_status);
CREATE INDEX idx_files_processing_status ON files(processing_status);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_user_processing_status ON files(user_uuid, processing_status);
CREATE INDEX idx_files_upload_started_at ON files(upload_started_at) WHERE upload_started_at IS NOT NULL;
```

#### sentences 表索引
```sql
CREATE INDEX idx_sentences_file_uuid ON sentences(file_uuid);
CREATE INDEX idx_sentences_user_uuid ON sentences(user_uuid);
CREATE INDEX idx_sentences_defining_type ON sentences(defining_type);
CREATE INDEX idx_sentences_page ON sentences(page);
CREATE INDEX idx_sentences_user_file ON sentences(user_uuid, file_uuid);
CREATE INDEX idx_sentences_user_defining_type ON sentences(user_uuid, defining_type);
CREATE INDEX idx_sentences_sentence_tsv ON sentences USING GIN (to_tsvector('chinese', sentence));
```

#### conversations 表索引
```sql
CREATE INDEX idx_conversations_user_uuid ON conversations(user_uuid);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX idx_conversations_user_last_message ON conversations(user_uuid, last_message_at);
```

#### messages 表索引
```sql
CREATE INDEX idx_messages_conversation_uuid ON messages(conversation_uuid);
CREATE INDEX idx_messages_user_uuid ON messages(user_uuid);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_uuid, created_at);
CREATE INDEX idx_messages_role ON messages(role);
```

### 3.2 檢查約束

#### sentences 表約束
```sql
ALTER TABLE sentences ADD CONSTRAINT check_positive_page CHECK (page > 0);
ALTER TABLE sentences ADD CONSTRAINT check_valid_defining_type CHECK (defining_type IN ('cd', 'od', 'none'));
```

#### files 表約束
```sql
ALTER TABLE files ADD CONSTRAINT check_valid_upload_status CHECK (upload_status IN ('pending', 'in_progress', 'completed', 'failed', 'timeout'));
ALTER TABLE files ADD CONSTRAINT check_valid_processing_status CHECK (processing_status IN ('pending', 'in_progress', 'completed', 'failed'));
ALTER TABLE files ADD CONSTRAINT check_positive_size CHECK (size_bytes > 0);
```

#### messages 表約束
```sql
ALTER TABLE messages ADD CONSTRAINT check_valid_role CHECK (role IN ('user', 'assistant'));
```

## 4. 資料庫函數

### 4.1 檔案刪除清理函數
```sql
CREATE OR REPLACE FUNCTION delete_file_with_cleanup(file_uuid_param UUID)
RETURNS BOOLEAN AS $$
-- 函數內容略
$$ LANGUAGE plpgsql;
```

### 4.2 上傳超時處理函數
```sql
CREATE OR REPLACE FUNCTION mark_timed_out_uploads(timeout_minutes INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
-- 函數內容略
$$ LANGUAGE plpgsql;
```

### 4.3 更新對話最後消息時間的觸發器
```sql
CREATE OR REPLACE FUNCTION update_conversation_last_message_time()
RETURNS TRIGGER AS $$
-- 函數內容略
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message_time
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message_time();
```

## 5. MinIO 物件儲存設計

### 5.1 Bucket 命名策略
- 系統 bucket: `system-bucket`
- 暫存上傳: `temp-uploads`
- 處理暫存: `processing-temp`
- 用戶專屬 bucket: `user-{user_uuid}`

### 5.2 物件命名策略
- 上傳的原始檔案: `{file_uuid}.pdf`
- 分片上傳的暫存片段: `uploads/{upload_id}/{chunk_number}`
- 處理中間結果: `processing/{file_uuid}/{step_name}.data`

### 5.3 存取控制
- 後端服務使用專用的 MinIO 訪問金鑰
- 使用有限權限的 IAM 政策
- 使用預簽名 URL 提供臨時檔案存取權限
- 設置合理的 URL 過期時間 (例如 15 分鐘)

### 5.4 生命週期管理
- 自動清理已處理完成的暫存檔案
- 定期清理過期的分片上傳
- 保留 7 天的上傳日誌

## 6. 主從複製配置

PostgreSQL 資料庫採用主從架構以提高可用性和讀取效能。

### 6.1 主節點配置重點
- 配置 `wal_level = replica` 啟用複寫
- 設定適當的 `max_wal_senders` 和 `wal_keep_segments`
- 啟用 `archive_mode` 和配置 `archive_command`

### 6.2 從節點配置重點
- 設置 `hot_standby = on` 允許在備份服務器上進行讀取操作
- 配置 `primary_conninfo` 連接到主節點
- 設置 `hot_standby_feedback = on` 允許從節點反饋到主節點

## 7. 備份與恢復策略

### 7.1 備份策略
- 每日全量備份 PostgreSQL 資料庫
- 備份 MinIO 物件存儲中的關鍵數據
- 保留最近 30 天的備份，自動清理舊備份

### 7.2 恢復策略
- 提供完整的資料庫和物件存儲恢復腳本
- 支援從任何備份點恢復
- 恢復過程包括 PostgreSQL 資料庫和 MinIO 物件存儲的同步恢復 