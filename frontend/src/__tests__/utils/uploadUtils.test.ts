import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  generateUniqueId,
  splitFileIntoChunks,
  formatFileSize,
  isAcceptedFileType,
  isFileSizeValid,
  formatTime,
  calculateSpeed,
  formatSpeed,
  estimateRemainingTime,
  shouldShowTimeoutWarning,
  isUploadTimedOut,
  getDefaultUploadConfig
} from '../../utils/uploadUtils';

describe('上傳工具函數', () => {
  describe('generateUniqueId', () => {
    test('應生成有效的 UUID 格式', () => {
      const id = generateUniqueId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    
    test('應生成唯一 ID', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('splitFileIntoChunks', () => {
    let testFile: File;
    
    beforeEach(() => {
      // 創建一個測試文件 (3MB)
      const buffer = new ArrayBuffer(3 * 1024 * 1024);
      testFile = new File([buffer], 'test.pdf', { type: 'application/pdf' });
    });
    
    test('應將文件分割為指定大小的分片', () => {
      const chunkSize = 1024 * 1024; // 1MB
      const chunks = splitFileIntoChunks(testFile, chunkSize);
      
      // 檢查分片數量
      expect(chunks).toHaveLength(3);
      
      // 檢查每個分片的大小
      expect(chunks[0].blob.size).toBe(chunkSize);
      expect(chunks[1].blob.size).toBe(chunkSize);
      expect(chunks[2].blob.size).toBe(chunkSize);
      
      // 檢查總大小
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.blob.size, 0);
      expect(totalSize).toBe(testFile.size);
    });
    
    test('當文件大小不是分片大小的整數倍時應正確處理最後一個分片', () => {
      // 創建一個 2.5MB 的文件
      const buffer = new ArrayBuffer(2.5 * 1024 * 1024);
      const unevenFile = new File([buffer], 'uneven.pdf', { type: 'application/pdf' });
      
      const chunkSize = 1024 * 1024; // 1MB
      const chunks = splitFileIntoChunks(unevenFile, chunkSize);
      
      // 檢查分片數量
      expect(chunks).toHaveLength(3);
      
      // 檢查每個分片的大小
      expect(chunks[0].blob.size).toBe(chunkSize);
      expect(chunks[1].blob.size).toBe(chunkSize);
      expect(chunks[2].blob.size).toBe(0.5 * 1024 * 1024);
      
      // 檢查總大小
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.blob.size, 0);
      expect(totalSize).toBe(unevenFile.size);
    });
  });
  
  describe('formatFileSize', () => {
    test('應正確格式化各種檔案大小', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });
    
    test('應允許自定義小數位數', () => {
      expect(formatFileSize(1024 * 1024 * 1.5, 0)).toBe('2 MB');
      expect(formatFileSize(1024 * 1024 * 1.5, 1)).toBe('1.5 MB');
      expect(formatFileSize(1024 * 1024 * 1.5, 3)).toBe('1.500 MB');
    });
  });
  
  describe('isAcceptedFileType', () => {
    test('應驗證接受的檔案類型', () => {
      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      const txtFile = new File([''], 'test.txt', { type: 'text/plain' });
      
      expect(isAcceptedFileType(pdfFile, ['application/pdf'])).toBe(true);
      expect(isAcceptedFileType(txtFile, ['application/pdf'])).toBe(false);
      expect(isAcceptedFileType(txtFile, ['application/pdf', 'text/plain'])).toBe(true);
    });
  });
  
  describe('isFileSizeValid', () => {
    test('應驗證檔案大小是否在限制範圍內', () => {
      const smallFile = new File(['small'], 'small.pdf', { type: 'application/pdf' });
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB
      const largeFile = new File([largeBuffer], 'large.pdf', { type: 'application/pdf' });
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      expect(isFileSizeValid(smallFile, maxSize)).toBe(true);
      expect(isFileSizeValid(largeFile, maxSize)).toBe(false);
    });
  });
  
  describe('formatTime', () => {
    test('應格式化時間為分鐘:秒格式', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(30)).toBe('00:30');
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(90)).toBe('01:30');
      expect(formatTime(3600)).toBe('60:00');
    });
    
    test('當時間為負數或無效值時應顯示佔位符', () => {
      expect(formatTime(-1)).toBe('--:--');
      expect(formatTime(NaN)).toBe('--:--');
    });
  });
  
  describe('calculateSpeed and formatSpeed', () => {
    test('calculateSpeed 應計算正確的上傳速度', () => {
      expect(calculateSpeed(1024 * 1024, 1000)).toBe(1024 * 1024); // 1MB/s
      expect(calculateSpeed(512 * 1024, 1000)).toBe(512 * 1024); // 512KB/s
      expect(calculateSpeed(0, 1000)).toBe(0);
    });
    
    test('formatSpeed 應正確格式化速度', () => {
      expect(formatSpeed(1024)).toBe('1 KB/s');
      expect(formatSpeed(1024 * 1024)).toBe('1 MB/s');
    });
  });
  
  describe('estimateRemainingTime', () => {
    test('應正確估算剩餘時間', () => {
      // 總大小 1MB，已上傳 512KB，速度 128KB/s
      expect(estimateRemainingTime(1024 * 1024, 512 * 1024, 128 * 1024)).toBe(4); // 應該是 4 秒
      
      // 總大小 10MB，已上傳 5MB，速度 1MB/s
      expect(estimateRemainingTime(10 * 1024 * 1024, 5 * 1024 * 1024, 1024 * 1024)).toBe(5); // 應該是 5 秒
    });
    
    test('當速度為零時應返回無限大', () => {
      expect(estimateRemainingTime(1024, 0, 0)).toBe(Infinity);
    });
  });
  
  describe('shouldShowTimeoutWarning', () => {
    test('當距離超時時間小於警告閾值時應返回 true', () => {
      // 當前時間
      const now = Date.now();
      
      // 開始時間設為 8 分鐘前 (距離 10 分鐘超時還有 2 分鐘)
      const startTime = now - 8 * 60 * 1000;
      
      // 超時時間 10 分鐘，警告閾值 2 分鐘
      expect(shouldShowTimeoutWarning(startTime, 10, 2)).toBe(true);
    });
    
    test('當距離超時時間大於警告閾值時應返回 false', () => {
      // 當前時間
      const now = Date.now();
      
      // 開始時間設為 5 分鐘前 (距離 10 分鐘超時還有 5 分鐘)
      const startTime = now - 5 * 60 * 1000;
      
      // 超時時間 10 分鐘，警告閾值 2 分鐘
      expect(shouldShowTimeoutWarning(startTime, 10, 2)).toBe(false);
    });
  });
  
  describe('isUploadTimedOut', () => {
    test('當上傳時間超過超時限制時應返回 true', () => {
      // 當前時間
      const now = Date.now();
      
      // 開始時間設為 11 分鐘前
      const startTime = now - 11 * 60 * 1000;
      
      // 超時時間 10 分鐘
      expect(isUploadTimedOut(startTime, 10)).toBe(true);
    });
    
    test('當上傳時間未超過超時限制時應返回 false', () => {
      // 當前時間
      const now = Date.now();
      
      // 開始時間設為 9 分鐘前
      const startTime = now - 9 * 60 * 1000;
      
      // 超時時間 10 分鐘
      expect(isUploadTimedOut(startTime, 10)).toBe(false);
    });
  });
  
  describe('getDefaultUploadConfig', () => {
    test('應返回有效的默認配置', () => {
      const config = getDefaultUploadConfig();
      
      expect(config.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
      expect(config.acceptedFileTypes).toEqual(['application/pdf']);
      expect(config.chunkSize).toBe(1024 * 1024); // 1MB
      expect(config.maxRetries).toBe(3);
      expect(config.concurrentUploads).toBe(3);
      expect(config.timeoutMinutes).toBe(10);
      expect(config.warningThreshold).toBe(2);
    });
  });
}); 