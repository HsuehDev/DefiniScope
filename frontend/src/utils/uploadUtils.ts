import { ChunkInfo, UploadConfig } from '../types/upload';

/**
 * 生成唯一ID
 * @returns 唯一ID
 */
export const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * 將檔案分割為多個分片
 * 
 * @param file 檔案
 * @param chunkSize 分片大小
 * @returns 分片列表
 */
export const splitFileIntoChunks = (file: File, chunkSize: number): ChunkInfo[] => {
  const chunks: ChunkInfo[] = [];
  let start = 0;
  
  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    
    chunks.push({
      index: chunks.length + 1, // 索引從1開始
      blob,
      uploaded: false,
      startByte: start,
      endByte: end - 1,
      retries: 0
    });
    
    start = end;
  }
  
  return chunks;
};

/**
 * 格式化檔案大小
 * 
 * @param bytes 位元組數
 * @param decimals 小數位數
 * @returns 格式化後的檔案大小字串
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * 檢查檔案類型是否為允許的類型
 * 
 * @param file 檔案
 * @param acceptedTypes 允許的類型陣列
 * @returns 是否為允許的類型
 */
export const isAcceptedFileType = (file: File, acceptedTypes: string[]): boolean => {
  const fileType = file.type.toLowerCase();
  return acceptedTypes.some(type => fileType === type);
};

/**
 * 檢查檔案大小是否超過限制
 * 
 * @param file 檔案
 * @param maxSize 最大允許大小 (bytes)
 * @returns 是否超過限制
 */
export const isFileSizeValid = (file: File, maxSize: number): boolean => {
  return file.size <= maxSize;
};

/**
 * 格式化上傳時間
 * 
 * @param seconds 秒數
 * @returns 格式化後的時間字串
 */
export const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '--:--';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 計算上傳速度 (bytes/s)
 * 
 * @param bytesUploaded 已上傳位元組數
 * @param elapsedMs 已用時間 (毫秒)
 * @returns 上傳速度 (bytes/s)
 */
export const calculateSpeed = (bytesUploaded: number, elapsedMs: number): number => {
  if (elapsedMs === 0) return 0;
  return (bytesUploaded / elapsedMs) * 1000;
};

/**
 * 格式化上傳速度
 * 
 * @param bytesPerSecond 每秒位元組數
 * @returns 格式化後的速度字串
 */
export const formatSpeed = (bytesPerSecond: number): string => {
  return `${formatFileSize(bytesPerSecond)}/s`;
};

/**
 * 估算剩餘上傳時間 (秒)
 * 
 * @param totalBytes 總位元組數
 * @param bytesUploaded 已上傳位元組數
 * @param speed 上傳速度 (bytes/s)
 * @returns 預估剩餘時間 (秒)
 */
export const estimateRemainingTime = (
  totalBytes: number,
  bytesUploaded: number,
  speed: number
): number => {
  if (speed === 0) return Infinity;
  const remainingBytes = totalBytes - bytesUploaded;
  return remainingBytes / speed;
};

/**
 * 檢查是否需要顯示超時警告
 * 
 * @param startTime 開始時間 (timestamp)
 * @param timeoutMinutes 超時時間 (分鐘)
 * @param warningThreshold 警告閾值 (分鐘)
 * @returns 是否需要警告
 */
export const shouldShowTimeoutWarning = (
  startTime: number,
  timeoutMinutes: number,
  warningThreshold: number
): boolean => {
  if (!startTime) return false;
  
  const currentTime = Date.now();
  const elapsedMinutes = (currentTime - startTime) / (60 * 1000);
  const remainingMinutes = timeoutMinutes - elapsedMinutes;
  
  return remainingMinutes <= warningThreshold;
};

/**
 * 檢查上傳是否已超時
 * 
 * @param startTime 開始時間 (timestamp)
 * @param timeoutMinutes 超時時間 (分鐘)
 * @returns 是否已超時
 */
export const isUploadTimedOut = (startTime: number, timeoutMinutes: number): boolean => {
  if (!startTime) return false;
  
  const currentTime = Date.now();
  const elapsedMinutes = (currentTime - startTime) / (60 * 1000);
  
  return elapsedMinutes >= timeoutMinutes;
};

/**
 * 獲取默認的上傳配置
 * 
 * @returns 默認配置
 */
export const getDefaultUploadConfig = (): UploadConfig => {
  return {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    acceptedFileTypes: ['application/pdf'],
    chunkSize: 1024 * 1024, // 1MB
    maxRetries: 3,
    concurrentUploads: 3,
    timeoutMinutes: 10,
    warningThreshold: 2 // 剩餘2分鐘顯示警告
  };
}; 