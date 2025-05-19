-- PostgreSQL 索引初始化腳本
-- 為各個資料表創建索引以優化查詢效能

-- users 表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);

-- files 表索引
CREATE INDEX idx_files_user_uuid ON files(user_uuid);
CREATE INDEX idx_files_upload_status ON files(upload_status);
CREATE INDEX idx_files_processing_status ON files(processing_status);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_user_processing_status ON files(user_uuid, processing_status);
CREATE INDEX idx_files_upload_started_at ON files(upload_started_at) WHERE upload_started_at IS NOT NULL;

-- sentences 表索引
CREATE INDEX idx_sentences_file_uuid ON sentences(file_uuid);
CREATE INDEX idx_sentences_user_uuid ON sentences(user_uuid);
CREATE INDEX idx_sentences_defining_type ON sentences(defining_type);
CREATE INDEX idx_sentences_page ON sentences(page);
CREATE INDEX idx_sentences_user_file ON sentences(user_uuid, file_uuid);
CREATE INDEX idx_sentences_user_defining_type ON sentences(user_uuid, defining_type);

-- 為 sentences 表的 sentence 欄位創建全文搜尋索引
CREATE INDEX idx_sentences_sentence_tsv ON sentences USING GIN (to_tsvector('chinese', sentence));

-- conversations 表索引
CREATE INDEX idx_conversations_user_uuid ON conversations(user_uuid);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX idx_conversations_user_last_message ON conversations(user_uuid, last_message_at);

-- messages 表索引
CREATE INDEX idx_messages_conversation_uuid ON messages(conversation_uuid);
CREATE INDEX idx_messages_user_uuid ON messages(user_uuid);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_uuid, created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- message_references 表索引
CREATE INDEX idx_message_references_message_uuid ON message_references(message_uuid);
CREATE INDEX idx_message_references_sentence_uuid ON message_references(sentence_uuid);
CREATE UNIQUE INDEX idx_message_references_unique ON message_references(message_uuid, sentence_uuid);

-- upload_chunks 表索引
CREATE INDEX idx_upload_chunks_user_uuid ON upload_chunks(user_uuid);
CREATE INDEX idx_upload_chunks_upload_id ON upload_chunks(upload_id);
CREATE INDEX idx_upload_chunks_expires_at ON upload_chunks(expires_at);
CREATE INDEX idx_upload_chunks_upload_chunk ON upload_chunks(upload_id, chunk_number);

-- deletion_logs 表索引
CREATE INDEX idx_deletion_logs_file_uuid ON deletion_logs(file_uuid);
CREATE INDEX idx_deletion_logs_cleanup_status ON deletion_logs(minio_cleanup_status);
CREATE INDEX idx_deletion_logs_deleted_at ON deletion_logs(deleted_at);

-- password_reset_tokens 表索引
CREATE INDEX idx_password_reset_tokens_user_uuid ON password_reset_tokens(user_uuid);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- system_activity_logs 表索引
CREATE INDEX idx_system_activity_logs_user_uuid ON system_activity_logs(user_uuid);
CREATE INDEX idx_system_activity_logs_action_type ON system_activity_logs(action_type);
CREATE INDEX idx_system_activity_logs_entity_type ON system_activity_logs(entity_type);
CREATE INDEX idx_system_activity_logs_entity_uuid ON system_activity_logs(entity_uuid);
CREATE INDEX idx_system_activity_logs_created_at ON system_activity_logs(created_at);

-- processing_progress 表索引
CREATE INDEX idx_processing_progress_file_uuid ON processing_progress(file_uuid);
CREATE INDEX idx_processing_progress_status ON processing_progress(status);
CREATE INDEX idx_processing_progress_stage ON processing_progress(stage);
CREATE INDEX idx_processing_progress_file_stage ON processing_progress(file_uuid, stage); 