-- PostgreSQL 函數初始化腳本
-- 創建用於資料管理和維護的函數

-- 檔案刪除清理函數
CREATE OR REPLACE FUNCTION delete_file_with_cleanup(file_uuid_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    bucket_name VARCHAR;
    object_key VARCHAR;
    success BOOLEAN := FALSE;
BEGIN
    -- 獲取 MinIO 信息
    SELECT minio_bucket_name, minio_object_key INTO bucket_name, object_key
    FROM files
    WHERE file_uuid = file_uuid_param;
    
    -- 記錄刪除操作
    INSERT INTO deletion_logs (file_uuid, minio_bucket_name, minio_object_key, deleted_at)
    VALUES (file_uuid_param, bucket_name, object_key, NOW());
    
    -- 刪除檔案記錄 (會通過 CASCADE 刪除相關記錄)
    DELETE FROM files WHERE file_uuid = file_uuid_param;
    
    -- 標記操作成功
    success := TRUE;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;

-- 上傳超時處理函數
CREATE OR REPLACE FUNCTION mark_timed_out_uploads(timeout_minutes INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE files
    SET upload_status = 'timeout',
        error_message = '上傳超時：超過' || timeout_minutes || '分鐘未完成',
        updated_at = NOW()
    WHERE upload_status = 'in_progress'
      AND upload_started_at IS NOT NULL
      AND NOW() - upload_started_at > (timeout_minutes || ' minutes')::INTERVAL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 清理過期上傳分片函數
CREATE OR REPLACE FUNCTION cleanup_expired_chunks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM upload_chunks
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 更新檔案統計資訊函數
CREATE OR REPLACE FUNCTION update_file_sentence_statistics(file_uuid_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_count INTEGER := 0;
    cd_count_var INTEGER := 0;
    od_count_var INTEGER := 0;
BEGIN
    -- 計算句子總數
    SELECT COUNT(*) INTO total_count
    FROM sentences
    WHERE file_uuid = file_uuid_param;
    
    -- 計算 CD 句子數
    SELECT COUNT(*) INTO cd_count_var
    FROM sentences
    WHERE file_uuid = file_uuid_param
      AND defining_type = 'cd';
    
    -- 計算 OD 句子數
    SELECT COUNT(*) INTO od_count_var
    FROM sentences
    WHERE file_uuid = file_uuid_param
      AND defining_type = 'od';
    
    -- 更新檔案表
    UPDATE files
    SET sentence_count = total_count,
        cd_count = cd_count_var,
        od_count = od_count_var,
        updated_at = NOW()
    WHERE file_uuid = file_uuid_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 更新對話最後消息時間函數
CREATE OR REPLACE FUNCTION update_conversation_last_message_time()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE conversation_uuid = NEW.conversation_uuid;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建消息表的觸發器，自動更新對話最後消息時間
CREATE TRIGGER trigger_update_conversation_last_message_time
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message_time();

-- 更新資料表的 updated_at 函數
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為每個需要自動更新 updated_at 的表創建觸發器
CREATE TRIGGER trigger_update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trigger_update_files_modtime
BEFORE UPDATE ON files
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trigger_update_sentences_modtime
BEFORE UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trigger_update_conversations_modtime
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 