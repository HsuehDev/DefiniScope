import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FilesList } from '../files/FilesList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { FileStatus } from '../../types/files';

// 模擬檔案資料
const mockFiles = [
  {
    file_uuid: '550e8400-e29b-41d4-a716-446655440000',
    original_name: 'example1.pdf',
    size_bytes: 1024000,
    upload_status: 'completed' as FileStatus,
    processing_status: 'completed' as FileStatus,
    sentence_count: 120,
    cd_count: 5,
    od_count: 8,
    created_at: '2023-08-18T12:34:56.789Z',
    updated_at: '2023-08-18T13:00:00.000Z'
  },
  {
    file_uuid: '550e8400-e29b-41d4-a716-446655440001',
    original_name: 'example2.pdf',
    size_bytes: 2048000,
    upload_status: 'completed' as FileStatus,
    processing_status: 'completed' as FileStatus,
    sentence_count: 200,
    cd_count: 10,
    od_count: 15,
    created_at: '2023-08-19T10:34:56.789Z',
    updated_at: '2023-08-19T11:00:00.000Z'
  },
  {
    file_uuid: '550e8400-e29b-41d4-a716-446655440002',
    original_name: 'example3.pdf',
    size_bytes: 3072000,
    upload_status: 'completed' as FileStatus,
    processing_status: 'failed' as FileStatus,
    sentence_count: 0,
    cd_count: 0,
    od_count: 0,
    created_at: '2023-08-20T09:34:56.789Z',
    updated_at: '2023-08-20T09:40:00.000Z',
    error_message: '處理過程中發生錯誤'
  }
];

// 模擬useFilesList hook
const mockUseFilesList = vi.fn().mockReturnValue({
  isLoading: false,
  isError: false,
  data: {
    total: mockFiles.length,
    page: 1,
    limit: 10,
    files: mockFiles
  },
  error: null,
  refetch: vi.fn()
});

// 模擬useDeleteFile hook
const mockUseDeleteFile = vi.fn().mockReturnValue({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isLoading: false,
  isError: false,
  isSuccess: false,
  reset: vi.fn()
});

// 模擬整個模組
vi.mock('../../hooks/useFiles', () => ({
  useFilesList: () => mockUseFilesList(),
  useDeleteFile: () => mockUseDeleteFile()
}));

describe('FilesList元件', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    
    // 重置mock函數
    vi.clearAllMocks();
    
    // 恢復默認的文件列表
    mockUseFilesList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total: mockFiles.length,
        page: 1,
        limit: 10,
        files: mockFiles
      },
      error: null,
      refetch: vi.fn()
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FilesList onPreviewFile={() => {}} />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  test('應正確顯示檔案列表', () => {
    renderComponent();
    
    // 檢查是否顯示所有檔案
    expect(screen.getByText('example1.pdf')).toBeInTheDocument();
    expect(screen.getByText('example2.pdf')).toBeInTheDocument();
    expect(screen.getByText('example3.pdf')).toBeInTheDocument();
    
    // 檢查統計資訊是否正確顯示
    expect(screen.getByText('120')).toBeInTheDocument(); // 第一個檔案的句子數
    expect(screen.getByText('10')).toBeInTheDocument(); // 第二個檔案的CD數
    expect(screen.getByText('處理過程中發生錯誤')).toBeInTheDocument(); // 第三個檔案的錯誤訊息
  });

  test('應顯示檔案處理狀態', () => {
    renderComponent();
    
    // 檢查是否正確顯示處理狀態
    expect(screen.getAllByText(/上傳：/).length).toBe(3);
    expect(screen.getByText(/處理：失敗/)).toBeInTheDocument();
  });

  test('當列表為空時應顯示適當訊息', () => {
    // 重新模擬空列表
    mockUseFilesList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total: 0,
        page: 1,
        limit: 10,
        files: []
      },
      error: null,
      refetch: vi.fn()
    });
    
    renderComponent();
    
    expect(screen.getByText('尚無上傳檔案')).toBeInTheDocument();
  });
}); 