import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { server } from '../setup';
import { rest } from 'msw';
import { handlers, networkErrorHandlers } from '../mocks/handlers';
import { useFileUpload } from '../../hooks/useFileUpload';
import { UploadStatus } from '../../types/upload';
import * as uploadApi from '../../api/uploadApi';
import * as uploadUtils from '../../utils/uploadUtils';

// 模擬上傳 API
vi.mock('../../api/uploadApi', () => ({
  initMultipartUpload: vi.fn().mockResolvedValue({
    file_id: 'mock-file-id',
    upload_id: 'mock-upload-id',
    bucket: 'mock-bucket',
    key: 'mock-file-key'
  }),
  uploadPart: vi.fn().mockResolvedValue({
    part_number: 1,
    etag: 'mock-etag-1',
    progress: 100
  }),
  completeMultipartUpload: vi.fn().mockResolvedValue({
    file_id: 'mock-file-id',
    file_uuid: 'mock-file-uuid',
    bucket: 'mock-bucket',
    key: 'mock-file-key',
    etag: 'mock-etag',
    size: 1024 * 1024,
    file_name: 'test.pdf',
    original_name: 'test.pdf',
    upload_status: 'completed',
    processing_status: 'pending',
    created_at: new Date().toISOString()
  }),
  abortMultipartUpload: vi.fn().mockResolvedValue({
    status: 'success',
    message: '上傳已成功取消'
  }),
  getUploadStatus: vi.fn().mockResolvedValue({
    file_id: 'mock-file-id',
    upload_id: 'mock-upload-id',
    bucket: 'mock-bucket',
    key: 'mock-file-key',
    total_parts: 2,
    uploaded_parts: [1],
    start_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    time_elapsed: 300,
    remaining_time: 300,
    is_expired: false
  })
}));

// 模擬工具函數
vi.mock('../../utils/uploadUtils', () => {
  const originalModule = vi.importActual('../../utils/uploadUtils');
  
  return {
    ...originalModule,
    generateUniqueId: vi.fn().mockReturnValue('test-file-id'),
    shouldShowTimeoutWarning: vi.fn().mockReturnValue(false),
    isUploadTimedOut: vi.fn().mockReturnValue(false)
  };
});

// 創建測試文件
const createTestFile = (name = 'test.pdf', type = 'application/pdf', size = 1024 * 1024) => {
  return new File(['test file content'], name, { type });
};

describe('useFileUpload Hook', () => {
  beforeEach(() => {
    // 設置 MSW 處理程序
    server.use(...handlers);
    
    // 重置模擬
    vi.clearAllMocks();
    
    // 模擬在線狀態
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    
    // 重置計時器
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.clearAllTimers();
  });
  
  test('初始狀態應為空檔案列表', () => {
    const { result } = renderHook(() => useFileUpload());
    
    expect(result.current.files).toEqual([]);
  });
  
  test('添加有效檔案應觸發上傳流程', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    const testFile = createTestFile();
    
    // 添加文件
    act(() => {
      result.current.addFiles([testFile]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 檢查 API 調用
    expect(uploadApi.initMultipartUpload).toHaveBeenCalledWith(
      'test.pdf',
      1024 * 1024,
      'application/pdf',
      expect.any(Number)
    );
    
    // 檢查文件信息更新
    expect(result.current.files[0]).toMatchObject({
      id: 'test-file-id',
      file: testFile,
      status: UploadStatus.UPLOADING,
      uploadId: 'mock-upload-id',
      bucketName: 'mock-bucket',
      objectKey: 'mock-file-key'
    });
  });
  
  test('添加無效檔案類型應被拒絕', () => {
    const { result } = renderHook(() => useFileUpload());
    
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    // 添加文件
    act(() => {
      const { invalidFiles } = result.current.addFiles([invalidFile]);
      
      // 檢查無效文件信息
      expect(invalidFiles).toHaveLength(1);
      expect(invalidFiles[0].file).toBe(invalidFile);
      expect(invalidFiles[0].reason).toContain('不支援的檔案類型');
    });
    
    // 檢查檔案列表未變
    expect(result.current.files).toHaveLength(0);
  });
  
  test('暫停上傳應更新檔案狀態', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 暫停上傳
    act(() => {
      result.current.pauseUpload('test-file-id');
    });
    
    // 檢查暫停狀態
    expect(result.current.files[0].status).toBe(UploadStatus.PAUSED);
  });
  
  test('繼續上傳應恢復檔案上傳', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 暫停上傳
    act(() => {
      result.current.pauseUpload('test-file-id');
    });
    
    // 檢查暫停狀態
    expect(result.current.files[0].status).toBe(UploadStatus.PAUSED);
    
    // 繼續上傳
    act(() => {
      result.current.resumeUpload('test-file-id');
    });
    
    // 檢查上傳狀態
    expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
  });
  
  test('取消上傳應調用 abortMultipartUpload API', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 取消上傳
    act(() => {
      result.current.cancelUpload('test-file-id');
    });
    
    // 檢查 API 是否被調用
    expect(uploadApi.abortMultipartUpload).toHaveBeenCalledWith('mock-file-id', 'mock-upload-id');
  });
  
  test('網絡斷開應自動暫停上傳', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 模擬網絡斷開
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });
    
    // 檢查上傳是否暫停
    expect(result.current.files[0].status).toBe(UploadStatus.PAUSED);
  });
  
  test('網絡恢復應自動繼續上傳', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 模擬網絡斷開
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });
    
    // 檢查上傳是否暫停
    expect(result.current.files[0].status).toBe(UploadStatus.PAUSED);
    
    // 模擬網絡恢復
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
    });
    
    // 檢查上傳是否繼續
    expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
  });
  
  test('上傳接近超時時應顯示警告', async () => {
    // 模擬接近超時
    vi.mocked(uploadUtils.shouldShowTimeoutWarning).mockReturnValue(true);
    
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 觸發超時檢查
    act(() => {
      vi.advanceTimersByTime(10000); // 10 秒
    });
    
    // 檢查警告狀態
    expect(result.current.files[0].timeoutWarning).toBe(true);
  });
  
  test('上傳超時時應自動取消上傳', async () => {
    // 模擬超時
    vi.mocked(uploadUtils.isUploadTimedOut).mockReturnValue(true);
    
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 觸發超時檢查
    act(() => {
      vi.advanceTimersByTime(10000); // 10 秒
    });
    
    // 檢查超時狀態
    expect(result.current.files[0].status).toBe(UploadStatus.TIMEOUT);
    expect(result.current.files[0].errorMessage).toContain('上傳超時');
  });
  
  test('重試上傳應重新開始上傳流程', async () => {
    const { result } = renderHook(() => useFileUpload());
    
    // 添加文件
    act(() => {
      result.current.addFiles([createTestFile()]);
    });
    
    // 等待初始化上傳完成
    await waitFor(() => {
      expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
    });
    
    // 模擬上傳失敗
    act(() => {
      // 修改文件狀態為錯誤
      const updatedFiles = [...result.current.files];
      updatedFiles[0] = {
        ...updatedFiles[0],
        status: UploadStatus.ERROR,
        errorMessage: '上傳失敗'
      };
      
      // 強制更新狀態 (通過修改 Hook 內部狀態)
      vi.spyOn(React, 'useState').mockReturnValueOnce([updatedFiles, vi.fn()]);
    });
    
    // 重置模擬函數
    vi.clearAllMocks();
    
    // 重試上傳
    act(() => {
      result.current.retryUpload('test-file-id');
    });
    
    // 檢查是否重新初始化上傳
    expect(uploadApi.initMultipartUpload).toHaveBeenCalled();
  });
}); 