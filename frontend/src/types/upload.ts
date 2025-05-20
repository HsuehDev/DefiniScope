/**
 * 檔案上傳相關的類型定義
 */

// 上傳狀態枚舉
export enum UploadStatus {
  IDLE = 'idle',           // 初始狀態
  PREPARING = 'preparing', // 準備上傳
  UPLOADING = 'uploading', // 上傳中
  PAUSED = 'paused',       // 已暫停
  SUCCESS = 'success',     // 上傳成功
  ERROR = 'error',         // 上傳失敗
  TIMEOUT = 'timeout',     // 上傳超時
}

// 檔案處理狀態枚舉
export enum ProcessingStatus {
  PENDING = 'pending',       // 等待處理
  PROCESSING = 'processing', // 處理中
  COMPLETED = 'completed',   // 處理完成
  FAILED = 'failed',         // 處理失敗
}

// 上傳文件的資訊
export interface FileUploadInfo {
  id: string;                    // 前端生成的唯一ID
  file: File;                    // 原始檔案物件
  uploadId?: string;             // 後端返回的上傳ID (用於分片上傳)
  status: UploadStatus;          // 當前上傳狀態
  progress: number;              // 上傳進度 (0-100)
  errorMessage?: string;         // 錯誤訊息
  startTime: number;             // 開始上傳的時間戳
  uploadedBytes: number;         // 已上傳的位元組數
  speed: number;                 // 上傳速度 (bytes/s)
  remainingTime: number;         // 預估剩餘時間 (秒)
  timeoutWarning: boolean;       // 是否顯示超時警告
  bucketName?: string;           // 存儲桶名稱
  objectKey?: string;            // 物件金鑰
  chunks: ChunkInfo[];           // 分片資訊
  processingStatus?: ProcessingStatus; // 處理狀態
}

// 分片資訊
export interface ChunkInfo {
  index: number;        // 分片索引
  blob: Blob;           // 分片數據
  uploaded: boolean;    // 是否已上傳
  etag?: string;        // 分片的ETag (用於完成上傳)
  startByte: number;    // 分片起始位元組
  endByte: number;      // 分片結束位元組
  retries: number;      // 重試次數
}

// 初始化上傳響應
export interface InitUploadResponse {
  file_id: string;
  upload_id: string;
  bucket: string;
  key: string;
}

// 上傳分片響應
export interface UploadPartResponse {
  part_number: number;
  etag: string;
  progress: number;
}

// 完成上傳響應
export interface CompleteUploadResponse {
  file_id: string;
  file_uuid: string;
  bucket: string;
  key: string;
  etag: string;
  size: number;
  file_name: string;
  original_name: string;
  upload_status: string;
  processing_status: string;
  created_at: string;
}

// 上傳狀態響應
export interface UploadStatusResponse {
  file_id: string;
  upload_id: string;
  bucket: string;
  key: string;
  total_parts: number;
  uploaded_parts: number[];
  start_time: string;
  time_elapsed: number;
  remaining_time: number;
  is_expired: boolean;
}

// 設定檔案上傳的配置
export interface UploadConfig {
  maxFileSize: number;     // 最大檔案大小 (bytes)
  acceptedFileTypes: string[]; // 接受的檔案類型
  chunkSize: number;       // 分片大小 (bytes)
  maxRetries: number;      // 最大重試次數
  concurrentUploads: number; // 並發上傳數
  timeoutMinutes: number;  // 上傳超時時間 (分鐘)
  warningThreshold: number; // 警告閾值 (分鐘)
}

// 上傳錯誤類型
export interface UploadError {
  message: string;
  code?: string;
  retryable: boolean;
} 