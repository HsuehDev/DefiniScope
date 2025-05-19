-- PostgreSQL 約束初始化腳本
-- 為各個資料表添加檢查約束以確保資料完整性

-- sentences 表的頁碼必須為正整數
ALTER TABLE sentences ADD CONSTRAINT check_positive_page 
CHECK (page > 0);

-- sentences 表的定義類型必須為有效值
ALTER TABLE sentences ADD CONSTRAINT check_valid_defining_type 
CHECK (defining_type IN ('cd', 'od', 'none'));

-- files 表的上傳狀態必須為有效值
ALTER TABLE files ADD CONSTRAINT check_valid_upload_status 
CHECK (upload_status IN ('pending', 'in_progress', 'completed', 'failed', 'timeout'));

-- files 表的處理狀態必須為有效值
ALTER TABLE files ADD CONSTRAINT check_valid_processing_status 
CHECK (processing_status IN ('pending', 'in_progress', 'completed', 'failed'));

-- files 表的文件大小必須為正數
ALTER TABLE files ADD CONSTRAINT check_positive_size 
CHECK (size_bytes > 0);

-- messages 表的角色必須為有效值
ALTER TABLE messages ADD CONSTRAINT check_valid_role 
CHECK (role IN ('user', 'assistant'));

-- upload_chunks 表的分片編號必須為正整數
ALTER TABLE upload_chunks ADD CONSTRAINT check_positive_chunk_number 
CHECK (chunk_number > 0);

-- upload_chunks 表的分片總數必須為正整數
ALTER TABLE upload_chunks ADD CONSTRAINT check_positive_chunk_total 
CHECK (chunk_total > 0);

-- upload_chunks 表的分片大小必須為正數
ALTER TABLE upload_chunks ADD CONSTRAINT check_positive_chunk_size 
CHECK (chunk_size > 0);

-- deletion_logs 表的清理狀態必須為有效值
ALTER TABLE deletion_logs ADD CONSTRAINT check_valid_cleanup_status 
CHECK (minio_cleanup_status IN ('pending', 'in_progress', 'completed', 'failed'));

-- processing_progress 表的進度百分比必須在 0 到 100 之間
ALTER TABLE processing_progress ADD CONSTRAINT check_valid_progress_percentage 
CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- processing_progress 表的狀態必須為有效值
ALTER TABLE processing_progress ADD CONSTRAINT check_valid_progress_status 
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')); 