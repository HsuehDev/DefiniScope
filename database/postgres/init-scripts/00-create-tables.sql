-- PostgreSQL 資料庫初始化腳本
-- 創建資料表及其關聯

-- 使用者資料表
CREATE TABLE users (
    user_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- 檔案資料表
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
    version INTEGER NOT NULL DEFAULT 1  -- 用於樂觀鎖
);

-- 句子資料表
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

-- 對話資料表
CREATE TABLE conversations (
    conversation_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT '新對話',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

-- 消息資料表
CREATE TABLE messages (
    message_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_uuid UUID NOT NULL REFERENCES conversations(conversation_uuid) ON DELETE CASCADE,
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 消息引用資料表
CREATE TABLE message_references (
    reference_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_uuid UUID NOT NULL REFERENCES messages(message_uuid) ON DELETE CASCADE,
    sentence_uuid UUID NOT NULL REFERENCES sentences(sentence_uuid) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 上傳分片資料表
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

-- 刪除日誌表
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

-- 使用者密碼重設表
CREATE TABLE password_reset_tokens (
    token_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    token VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- 系統活動日誌表
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

-- 處理進度表
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