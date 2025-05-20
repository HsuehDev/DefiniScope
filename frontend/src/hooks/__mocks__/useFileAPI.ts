import { vi } from 'vitest';

// 模擬檔案資料
export const mockFiles = [
  {
    file_uuid: '550e8400-e29b-41d4-a716-446655440000',
    original_name: 'example1.pdf',
    size_bytes: 1024000,
    upload_status: 'completed',
    processing_status: 'completed',
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
    upload_status: 'completed',
    processing_status: 'completed',
    sentence_count: 200,
    cd_count: 10,
    od_count: 15,
    created_at: '2023-08-19T10:34:56.789Z',
    updated_at: '2023-08-19T11:00:00.000Z'
  }
];

// 獲取檔案列表
export const useGetFiles = vi.fn().mockReturnValue({
  isLoading: false,
  isError: false,
  data: {
    total: mockFiles.length,
    page: 1,
    limit: 10,
    files: [...mockFiles]
  },
  error: null,
  refetch: vi.fn()
});

// 獲取單一檔案
export const useGetFile = vi.fn().mockImplementation((fileUuid: string) => {
  const file = mockFiles.find(f => f.file_uuid === fileUuid);
  
  return {
    isLoading: false,
    isError: !file,
    data: file || null,
    error: file ? null : new Error('檔案不存在'),
    refetch: vi.fn()
  };
});

// 刪除檔案 - 成功情況
const mockDeleteSuccess = vi.fn().mockResolvedValue({ detail: '檔案已成功刪除' });
export const useDeleteFile = vi.fn().mockReturnValue({
  mutate: mockDeleteSuccess,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  reset: vi.fn()
});

// 設置刪除檔案失敗情況
export const setDeleteFileError = (errorMessage: string = '刪除檔案時發生錯誤') => {
  const mockDeleteError = vi.fn().mockRejectedValue(new Error(errorMessage));
  useDeleteFile.mockReturnValue({
    mutate: mockDeleteError,
    isLoading: false,
    isError: true,
    isSuccess: false,
    error: new Error(errorMessage),
    reset: vi.fn()
  });
  return mockDeleteError;
};

// 設置刪除檔案成功情況 (用於測試結束後恢復)
export const setDeleteFileSuccess = () => {
  useDeleteFile.mockReturnValue({
    mutate: mockDeleteSuccess,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null,
    reset: vi.fn()
  });
  return mockDeleteSuccess;
};

// 使用可控制的Promise測試異步操作
export const createControlledPromise = () => {
  let resolve: (value: any) => void;
  let reject: (reason?: any) => void;
  
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  const mockFn = vi.fn().mockImplementation(() => promise);
  
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
    mockFn
  };
};

// 模擬樂觀更新與回滾測試
export const setupOptimisticUpdateTest = () => {
  const { mockFn, resolve, reject } = createControlledPromise();
  
  useDeleteFile.mockReturnValue({
    mutate: mockFn,
    isLoading: true,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn()
  });
  
  return {
    mutate: mockFn,
    resolveDelete: resolve,
    rejectDelete: reject,
    reset: () => setDeleteFileSuccess()
  };
}; 