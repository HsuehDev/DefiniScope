import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PDFPreviewModal from '../../../components/PDFViewer/PDFPreviewModal';

// 引入PDF.js模擬
import '../../mocks/pdfjs.mock';

// 模擬PDF檢視器組件，避免直接依賴PDF檢視器的複雜性
vi.mock('../../../components/PDFViewer/PDFViewer', () => ({
  default: vi.fn(({ fileUuid, highlightSentenceUuid, initialPage, onClose }) => (
    <div 
      data-testid="mock-pdf-viewer" 
      data-file-uuid={fileUuid}
      data-sentence-uuid={highlightSentenceUuid}
      data-page={initialPage}
    >
      模擬的PDF檢視器
      {onClose && <button onClick={onClose}>關閉</button>}
    </div>
  ))
}));

// 模擬fetch API
const originalFetch = global.fetch;

const mockFetchImplementation = (url: string) => {
  // 模擬文件詳情請求
  if (url.includes('/api/files/test-file-uuid')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        file_uuid: 'test-file-uuid',
        original_name: '測試文件.pdf',
        size_bytes: 1024 * 1024,
        upload_status: 'completed',
        processing_status: 'completed'
      })
    } as Response);
  }
  
  // 默認返回404
  return Promise.resolve({
    ok: false,
    status: 404,
    statusText: '未找到'
  } as Response);
};

// 模擬localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn().mockReturnValue('mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn()
  },
  writable: true
});

describe('PDFPreviewModal組件', () => {
  beforeEach(() => {
    // 重置模擬
    vi.clearAllMocks();
    
    // 替換全局fetch
    global.fetch = vi.fn(mockFetchImplementation);
  });

  afterEach(() => {
    // 恢復原始fetch
    global.fetch = originalFetch;
  });

  test('當isOpen為false時不渲染任何內容', () => {
    const { container } = render(
      <BrowserRouter>
        <PDFPreviewModal
          isOpen={false}
          onClose={() => {}}
          fileUuid="test-file-uuid"
        />
      </BrowserRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('當isOpen為true時渲染模態框和PDF檢視器', async () => {
    render(
      <BrowserRouter>
        <PDFPreviewModal
          isOpen={true}
          onClose={() => {}}
          fileUuid="test-file-uuid"
          initialPage={2}
        />
      </BrowserRouter>
    );
    
    // 確認模態框已渲染
    const modal = screen.getByRole('dialog', { hidden: true });
    expect(modal).toBeInTheDocument();
    
    // 確認PDF檢視器已渲染
    const pdfViewer = screen.getByTestId('mock-pdf-viewer');
    expect(pdfViewer).toBeInTheDocument();
    expect(pdfViewer.getAttribute('data-file-uuid')).toBe('test-file-uuid');
    expect(pdfViewer.getAttribute('data-page')).toBe('2');
    
    // 確認文件名稱請求和顯示
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/test-file-uuid',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        })
      );
      
      expect(screen.getByText('測試文件.pdf')).toBeInTheDocument();
    });
  });

  test('通過關閉按鈕關閉模態框', async () => {
    const mockCloseHandler = vi.fn();
    
    render(
      <BrowserRouter>
        <PDFPreviewModal
          isOpen={true}
          onClose={mockCloseHandler}
          fileUuid="test-file-uuid"
        />
      </BrowserRouter>
    );
    
    // 等待模態框載入
    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-viewer')).toBeInTheDocument();
    });
    
    // 點擊關閉按鈕
    const closeButton = screen.getByRole('button', { name: /關閉/i });
    fireEvent.click(closeButton);
    
    // 確認關閉回調被調用
    expect(mockCloseHandler).toHaveBeenCalledTimes(1);
  });

  test('通過Escape鍵關閉模態框', async () => {
    const mockCloseHandler = vi.fn();
    
    render(
      <BrowserRouter>
        <PDFPreviewModal
          isOpen={true}
          onClose={mockCloseHandler}
          fileUuid="test-file-uuid"
        />
      </BrowserRouter>
    );
    
    // 等待模態框載入
    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-viewer')).toBeInTheDocument();
    });
    
    // 模擬按下Escape鍵
    fireEvent.keyDown(window, { key: 'Escape' });
    
    // 確認關閉回調被調用
    expect(mockCloseHandler).toHaveBeenCalledTimes(1);
  });

  test('處理文件信息獲取失敗的情況', async () => {
    // 模擬API返回錯誤
    global.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: '伺服器錯誤'
      } as Response);
    });
    
    render(
      <BrowserRouter>
        <PDFPreviewModal
          isOpen={true}
          onClose={() => {}}
          fileUuid="test-file-uuid"
        />
      </BrowserRouter>
    );
    
    // 確認使用默認文件名
    await waitFor(() => {
      expect(screen.getByText('文件預覽')).toBeInTheDocument();
    });
  });

  test('傳遞句子UUID到PDF檢視器', async () => {
    render(
      <BrowserRouter>
        <PDFPreviewModal
          isOpen={true}
          onClose={() => {}}
          fileUuid="test-file-uuid"
          sentenceUuid="test-sentence-uuid"
        />
      </BrowserRouter>
    );
    
    // 確認句子UUID已傳遞
    const pdfViewer = await screen.findByTestId('mock-pdf-viewer');
    expect(pdfViewer.getAttribute('data-sentence-uuid')).toBe('test-sentence-uuid');
  });
}); 