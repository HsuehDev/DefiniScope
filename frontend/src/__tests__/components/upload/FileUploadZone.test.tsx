import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FileUploadZone } from '../../../components/upload/FileUploadZone';
import * as useFileUploadModule from '../../../hooks/useFileUpload';
import { UploadStatus } from '../../../types/upload';

// 模擬 useFileUpload hook
vi.mock('../../../hooks/useFileUpload', () => {
  const addFilesMock = vi.fn().mockReturnValue({
    validFiles: [],
    invalidFiles: []
  });
  
  const cancelUploadMock = vi.fn();
  const retryUploadMock = vi.fn();
  const pauseUploadMock = vi.fn();
  const resumeUploadMock = vi.fn();
  
  return {
    useFileUpload: vi.fn().mockReturnValue({
      files: [],
      addFiles: addFilesMock,
      cancelUpload: cancelUploadMock,
      retryUpload: retryUploadMock,
      pauseUpload: pauseUploadMock,
      resumeUpload: resumeUploadMock
    })
  };
});

// 創建一個測試文件
const createTestFile = (name = 'test.pdf', type = 'application/pdf', size = 1024 * 1024) => {
  return new File(['test file content'], name, { type });
};

describe('FileUploadZone 組件', () => {
  // 在每個測試前重置模擬
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  // 測試拖放區域的渲染
  test('應該正確渲染拖放區域', () => {
    render(<FileUploadZone />);
    
    // 檢查拖放區域是否存在
    const dropzone = screen.getByTestId('dropzone');
    expect(dropzone).toBeInTheDocument();
    
    // 檢查文本提示是否正確
    expect(screen.getByText(/拖放 PDF 檔案至此處，或/i)).toBeInTheDocument();
    expect(screen.getByText(/點擊選擇檔案/i)).toBeInTheDocument();
  });
  
  // 測試檔案拖放功能
  test('當拖放有效檔案時，應該調用 addFiles', async () => {
    // 設置測試檔案
    const testFile = createTestFile();
    
    render(<FileUploadZone />);
    
    // 獲取拖放區域
    const dropzone = screen.getByTestId('dropzone');
    
    // 模擬文件拖放事件
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [testFile],
        types: ['Files']
      }
    });
    
    // 檢查 addFiles 是否被調用
    const { addFiles } = useFileUploadModule.useFileUpload();
    expect(addFiles).toHaveBeenCalledTimes(1);
    expect(addFiles).toHaveBeenCalledWith([testFile]);
  });
  
  // 測試點擊上傳功能
  test('當點擊選擇檔案時，應該打開文件選擇器', async () => {
    render(<FileUploadZone />);
    
    // 獲取文件輸入元素
    const fileInput = screen.getByTestId('file-input');
    
    // 模擬點擊文件選擇
    const clickSpy = vi.spyOn(fileInput, 'click');
    userEvent.click(screen.getByText(/點擊選擇檔案/i));
    
    // 檢查文件輸入元素的點擊事件是否被觸發
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
  });
  
  // 測試無效文件類型的處理
  test('當上傳無效的檔案類型時，應該顯示錯誤信息', () => {
    // 創建非 PDF 文件
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    render(<FileUploadZone />);
    
    // 獲取拖放區域
    const dropzone = screen.getByTestId('dropzone');
    
    // 模擬拖放非 PDF 文件
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [invalidFile],
        types: ['Files']
      }
    });
    
    // 檢查錯誤信息是否顯示
    expect(screen.getByTestId('upload-error')).toBeInTheDocument();
    expect(screen.getByText(/檔案 test.txt 類型不支援/i)).toBeInTheDocument();
  });
  
  // 測試文件大小限制
  test('當上傳超過大小限制的檔案時，應該顯示錯誤信息', () => {
    // 創建大文件 (11 MB)
    const largeFile = createTestFile('large.pdf', 'application/pdf', 11 * 1024 * 1024);
    
    render(<FileUploadZone />);
    
    // 獲取拖放區域
    const dropzone = screen.getByTestId('dropzone');
    
    // 模擬拖放大文件
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [largeFile],
        types: ['Files']
      }
    });
    
    // 檢查錯誤信息是否顯示
    expect(screen.getByTestId('upload-error')).toBeInTheDocument();
    expect(screen.getByText(/檔案 large.pdf 超過大小限制/i)).toBeInTheDocument();
  });
  
  // 測試上傳文件列表顯示
  test('應該正確顯示上傳的檔案列表', () => {
    // 模擬上傳文件數據
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue({
      files: [
        {
          id: 'test-file-1',
          file: createTestFile('document1.pdf'),
          status: UploadStatus.UPLOADING,
          progress: 50,
          startTime: Date.now(),
          uploadedBytes: 512 * 1024,
          speed: 100 * 1024,
          remainingTime: 30,
          timeoutWarning: false,
          chunks: []
        }
      ],
      addFiles: vi.fn(),
      cancelUpload: vi.fn(),
      retryUpload: vi.fn(),
      pauseUpload: vi.fn(),
      resumeUpload: vi.fn()
    });
    
    render(<FileUploadZone />);
    
    // 檢查文件列表是否顯示
    expect(screen.getByTestId('file-list')).toBeInTheDocument();
    expect(screen.getByTestId('file-item-test-file-1')).toBeInTheDocument();
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
  });
  
  // 測試暫停/繼續上傳功能
  test('點擊暫停/繼續按鈕時應該調用相應的功能', () => {
    // 模擬上傳文件
    const pauseUploadMock = vi.fn();
    const resumeUploadMock = vi.fn();
    
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue({
      files: [
        {
          id: 'test-file-1',
          file: createTestFile('document1.pdf'),
          status: UploadStatus.UPLOADING,
          progress: 50,
          startTime: Date.now(),
          uploadedBytes: 512 * 1024,
          speed: 100 * 1024,
          remainingTime: 30,
          timeoutWarning: false,
          chunks: []
        }
      ],
      addFiles: vi.fn(),
      cancelUpload: vi.fn(),
      retryUpload: vi.fn(),
      pauseUpload: pauseUploadMock,
      resumeUpload: resumeUploadMock
    });
    
    render(<FileUploadZone />);
    
    // 點擊暫停按鈕
    const pauseButton = screen.getByTestId('toggle-pause-test-file-1');
    fireEvent.click(pauseButton);
    
    // 檢查 pauseUpload 是否被調用
    expect(pauseUploadMock).toHaveBeenCalledWith('test-file-1');
    
    // 模擬暫停狀態
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue({
      files: [
        {
          id: 'test-file-1',
          file: createTestFile('document1.pdf'),
          status: UploadStatus.PAUSED,
          progress: 50,
          startTime: Date.now(),
          uploadedBytes: 512 * 1024,
          speed: 0,
          remainingTime: 30,
          timeoutWarning: false,
          chunks: []
        }
      ],
      addFiles: vi.fn(),
      cancelUpload: vi.fn(),
      retryUpload: vi.fn(),
      pauseUpload: pauseUploadMock,
      resumeUpload: resumeUploadMock
    });
    
    render(<FileUploadZone />);
    
    // 點擊繼續按鈕
    const resumeButton = screen.getByTestId('toggle-pause-test-file-1');
    fireEvent.click(resumeButton);
    
    // 檢查 resumeUpload 是否被調用
    expect(resumeUploadMock).toHaveBeenCalledWith('test-file-1');
  });
  
  // 測試重試上傳功能
  test('當上傳失敗時，點擊重試按鈕應調用重試功能', () => {
    // 模擬上傳失敗
    const retryUploadMock = vi.fn();
    
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue({
      files: [
        {
          id: 'test-file-1',
          file: createTestFile('document1.pdf'),
          status: UploadStatus.ERROR,
          progress: 25,
          startTime: Date.now(),
          uploadedBytes: 256 * 1024,
          speed: 0,
          remainingTime: 0,
          timeoutWarning: false,
          errorMessage: '上傳失敗',
          chunks: []
        }
      ],
      addFiles: vi.fn(),
      cancelUpload: vi.fn(),
      retryUpload: retryUploadMock,
      pauseUpload: vi.fn(),
      resumeUpload: vi.fn()
    });
    
    render(<FileUploadZone />);
    
    // 點擊重試按鈕
    const retryButton = screen.getByTestId('retry-upload-test-file-1');
    fireEvent.click(retryButton);
    
    // 檢查 retryUpload 是否被調用
    expect(retryUploadMock).toHaveBeenCalledWith('test-file-1');
  });
  
  // 測試取消上傳功能
  test('點擊取消按鈕時應該調用取消上傳功能', () => {
    // 模擬上傳中
    const cancelUploadMock = vi.fn();
    
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue({
      files: [
        {
          id: 'test-file-1',
          file: createTestFile('document1.pdf'),
          status: UploadStatus.UPLOADING,
          progress: 50,
          startTime: Date.now(),
          uploadedBytes: 512 * 1024,
          speed: 100 * 1024,
          remainingTime: 30,
          timeoutWarning: false,
          chunks: []
        }
      ],
      addFiles: vi.fn(),
      cancelUpload: cancelUploadMock,
      retryUpload: vi.fn(),
      pauseUpload: vi.fn(),
      resumeUpload: vi.fn()
    });
    
    render(<FileUploadZone />);
    
    // 點擊取消按鈕
    const cancelButton = screen.getByTestId('cancel-upload-test-file-1');
    fireEvent.click(cancelButton);
    
    // 檢查 cancelUpload 是否被調用
    expect(cancelUploadMock).toHaveBeenCalledWith('test-file-1');
  });
}); 