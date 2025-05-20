import { rest } from 'msw';

// 模擬 API 基本 URL
const API_BASE_URL = '/api';

// 模擬成功的初始化上傳響應
const mockInitUploadSuccess = rest.post(
  `${API_BASE_URL}/files/multipart/init`,
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        file_id: 'mock-file-id',
        upload_id: 'mock-upload-id',
        bucket: 'mock-bucket',
        key: 'mock-file-key',
      })
    );
  }
);

// 模擬分片上傳響應
const mockUploadPartSuccess = rest.post(
  `${API_BASE_URL}/files/multipart/:fileId/:uploadId/:partNumber`,
  (req, res, ctx) => {
    const { partNumber } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        part_number: parseInt(partNumber as string, 10),
        etag: `mock-etag-${partNumber}`,
        progress: 100,
      })
    );
  }
);

// 模擬完成上傳響應
const mockCompleteUploadSuccess = rest.post(
  `${API_BASE_URL}/files/multipart/:fileId/:uploadId/complete`,
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        file_id: 'mock-file-id',
        file_uuid: 'mock-file-uuid',
        bucket: 'mock-bucket',
        key: 'mock-file-key',
        etag: 'mock-etag',
        size: 1024 * 1024 * 2, // 2MB
        file_name: 'mock-file.pdf',
        original_name: 'test.pdf',
        upload_status: 'completed',
        processing_status: 'pending',
        created_at: new Date().toISOString(),
      })
    );
  }
);

// 模擬取消上傳響應
const mockAbortUploadSuccess = rest.delete(
  `${API_BASE_URL}/files/multipart/:fileId/:uploadId`,
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        status: 'success',
        message: '上傳已成功取消',
      })
    );
  }
);

// 模擬獲取上傳狀態響應
const mockUploadStatusSuccess = rest.get(
  `${API_BASE_URL}/files/multipart/:fileId/:uploadId/status`,
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        file_id: 'mock-file-id',
        upload_id: 'mock-upload-id',
        bucket: 'mock-bucket',
        key: 'mock-file-key',
        total_parts: 3,
        uploaded_parts: [1, 2], // 已上傳的分片編號
        start_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5分鐘前
        time_elapsed: 300, // 秒
        remaining_time: 60, // 預計剩餘秒數
        is_expired: false,
      })
    );
  }
);

// 模擬上傳錯誤
const mockUploadError = rest.post(
  `${API_BASE_URL}/files/multipart/error/init`,
  (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        error: 'server_error',
        message: '伺服器錯誤，請稍後再試',
      })
    );
  }
);

// 模擬網絡超時
const mockNetworkTimeout = rest.post(
  `${API_BASE_URL}/files/multipart/timeout/init`,
  async (req, res, ctx) => {
    // 等待 30 秒，模擬超時
    await new Promise(resolve => setTimeout(resolve, 30000));
    return res(ctx.status(408));
  }
);

// 導出所有處理程序
export const handlers = [
  mockInitUploadSuccess,
  mockUploadPartSuccess,
  mockCompleteUploadSuccess,
  mockAbortUploadSuccess,
  mockUploadStatusSuccess,
  mockUploadError,
  mockNetworkTimeout,
];

// 模擬網絡中斷的處理程序
export const networkErrorHandlers = [
  rest.post('*', (req, res) => {
    return res.networkError('網絡連接失敗');
  }),
  rest.get('*', (req, res) => {
    return res.networkError('網絡連接失敗');
  }),
]; 