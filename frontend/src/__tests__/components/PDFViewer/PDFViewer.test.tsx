import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PDFViewer from '../../../components/PDFViewer/PDFViewer';

// 引入PDF.js模擬
import '../../mocks/pdfjs.mock';

// 模擬fetch API
const originalFetch = global.fetch;

const mockFetchImplementation = (url: string) => {
  // 模擬PDF預覽URL請求
  if (url.includes('/api/files/test-file-uuid/preview')) {
    return Promise.resolve({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'application/json';
          return null;
        }
      },
      json: () => Promise.resolve({ preview_url: 'mock-pdf-url' })
    } as Response);
  }
  
  // 模擬句子信息請求
  if (url.includes('/api/files/test-file-uuid/sentences/test-sentence-uuid/view')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        file_uuid: 'test-file-uuid',
        sentence_uuid: 'test-sentence-uuid',
        page: 3,
        sentence: '這是一個測試高亮的句子',
        preview_url: 'mock-preview-url?page=3&highlight=test-sentence-uuid'
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

describe('PDFViewer組件', () => {
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

  // 測試基本渲染
  test('成功渲染PDF檢視器', async () => {
    render(
      <BrowserRouter>
        <PDFViewer fileUuid="test-file-uuid" />
      </BrowserRouter>
    );

    // 測試加載狀態
    expect(screen.getByText(/載入中/i)).toBeInTheDocument();

    // 等待PDF加載完成
    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
      expect(screen.getByText(/模擬的PDF頁面 1/i)).toBeInTheDocument();
      expect(screen.getByText(/1 \/ 5/i)).toBeInTheDocument(); // 頁碼顯示
    });

    // 確認PDF預覽URL請求是否正確
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/files/test-file-uuid/preview',
      expect.objectContaining({
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })
    );
  });

  // 測試頁面切換功能
  test('可以切換PDF頁面', async () => {
    render(
      <BrowserRouter>
        <PDFViewer fileUuid="test-file-uuid" />
      </BrowserRouter>
    );

    // 等待PDF加載完成
    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
    });

    // 點擊下一頁按鈕
    fireEvent.click(screen.getByText('下一頁'));

    // 確認頁碼更新
    await waitFor(() => {
      expect(screen.getByText(/2 \/ 5/i)).toBeInTheDocument();
      expect(screen.getByText(/模擬的PDF頁面 2/i)).toBeInTheDocument();
    });

    // 點擊上一頁按鈕
    fireEvent.click(screen.getByText('上一頁'));

    // 確認頁碼返回
    await waitFor(() => {
      expect(screen.getByText(/1 \/ 5/i)).toBeInTheDocument();
      expect(screen.getByText(/模擬的PDF頁面 1/i)).toBeInTheDocument();
    });
  });

  // 測試初始頁面設置
  test('可以設置初始頁面', async () => {
    render(
      <BrowserRouter>
        <PDFViewer fileUuid="test-file-uuid" initialPage={3} />
      </BrowserRouter>
    );

    // 等待PDF加載完成
    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
      expect(screen.getByText(/3 \/ 5/i)).toBeInTheDocument();
      expect(screen.getByText(/模擬的PDF頁面 3/i)).toBeInTheDocument();
    });
  });

  // 測試句子高亮功能
  test('可以高亮指定句子', async () => {
    // 模擬元素添加到頁面的appendChild方法
    const appendChildSpy = vi.spyOn(HTMLDivElement.prototype, 'appendChild');
    
    render(
      <BrowserRouter>
        <PDFViewer 
          fileUuid="test-file-uuid" 
          highlightSentenceUuid="test-sentence-uuid" 
        />
      </BrowserRouter>
    );

    // 確認獲取句子信息的請求
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/test-file-uuid/sentences/test-sentence-uuid/view',
        expect.anything()
      );
    });

    // 確認頁面跳轉到句子所在頁
    await waitFor(() => {
      expect(screen.getByText(/3 \/ 5/i)).toBeInTheDocument();
    });

    // 確認創建了高亮元素
    await waitFor(() => {
      expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLDivElement));
      const highlightElement = appendChildSpy.mock.calls[0][0] as HTMLDivElement;
      expect(highlightElement.className).toBe('pdf-text-highlight');
    });
  });

  // 測試URL參數處理
  test('處理URL中的頁碼和高亮參數', async () => {
    // 模擬URL參數
    Object.defineProperty(window, 'location', {
      value: {
        search: '?page=4&highlight=test-sentence-uuid'
      },
      writable: true
    });

    render(
      <BrowserRouter>
        <PDFViewer fileUuid="test-file-uuid" />
      </BrowserRouter>
    );

    // 確認獲取句子信息的請求
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/test-file-uuid/sentences/test-sentence-uuid/view',
        expect.anything()
      );
    });

    // 確認頁面顯示正確
    await waitFor(() => {
      expect(screen.getByText(/4 \/ 5/i)).toBeInTheDocument();
    });
  });

  // 測試鍵盤操作
  test('支援鍵盤快捷鍵操作', async () => {
    render(
      <BrowserRouter>
        <PDFViewer fileUuid="test-file-uuid" initialPage={2} />
      </BrowserRouter>
    );

    // 等待PDF加載完成
    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
      expect(screen.getByText(/2 \/ 5/i)).toBeInTheDocument();
    });

    // 按右箭頭鍵
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText(/3 \/ 5/i)).toBeInTheDocument();
    });

    // 按左箭頭鍵
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText(/2 \/ 5/i)).toBeInTheDocument();
    });
  });

  // 測試錯誤處理
  test('處理PDF載入錯誤', async () => {
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
        <PDFViewer fileUuid="test-file-uuid" />
      </BrowserRouter>
    );

    // 確認顯示錯誤信息
    await waitFor(() => {
      expect(screen.getByText(/無法載入PDF文件/i)).toBeInTheDocument();
    });
  });
}); 