-- 建立資料庫副本用戶
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicate_password';

-- 創建擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 創建刪除日誌表
CREATE TABLE IF NOT EXISTS deletion_logs (
    log_uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_uuid UUID NOT NULL,
    minio_bucket_name VARCHAR(100) NOT NULL,
    minio_object_key VARCHAR(255) NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    minio_cleanup_status VARCHAR(20) DEFAULT 'pending',
    minio_cleanup_attempts INTEGER DEFAULT 0,
    minio_cleanup_completed_at TIMESTAMPTZ
);

-- 權限設定
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET max_replication_slots = 10; 