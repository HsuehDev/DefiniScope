import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// 導入測試組件
import ChatMessage from '../../components/ChatMessage';
import PDFViewer from '../../components/PDFViewer';

// 模擬API服務
vi.mock('../../services/api', () => ({
  fetchSentenceContext: vi.fn().mockResolvedValue({
    beforeContext: ['這是前一個句子。'],
    afterContext: ['這是後一個句子。'],
    isLoading: false
  }),
  getFilePreviewUrl: vi.fn().mockResolvedValue('http://localhost/preview/test-file'),
  highlightSentenceInPdf: vi.fn().mockResolvedValue(true)
}));

// 模擬全局狀態 (如使用Context或Redux)
const mockSetPdfViewerState = vi.fn();
vi.mock('../../contexts/PDFViewerContext', () => ({
  usePDFViewerContext: () => ({
    setPdfViewerState: mockSetPdfViewerState,
    pdfViewerState: {
      isOpen: false,
      fileUuid: '',
      pageNumber: 1,
      highlightedSentenceUuid: '',
    }
  })
}));

describe('PDF查看功能集成測試', () => {
  const mockMessage = {
    messageId: 'msg-123',
    role: 'assistant',
    content: '根據資料顯示，自適應專業知識定義為一種高度靈活的專業知識形態。',
    references: [
      {
        sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
        file_uuid: '123e4567-e89b-12d3-a456-426614174001',
        original_name: 'test-document.pdf',
        sentence: '自適應專業知識定義為一種高度靈活的專業知識形態。',
        page: 5,
        defining_type: 'cd'
      }
    ],
    timestamp: new Date().toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('點擊引用標籤並選擇在PDF中查看應打開PDF查看器', async () => {
    // 設置測試環境
    render(
      <MemoryRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              <>
                <ChatMessage message={mockMessage} />
                <PDFViewer />
              </>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    // 點擊引用標籤
    const user = userEvent.setup();
    const referenceTag = screen.getByText(/自適應專業知識定義/);
    await user.click(referenceTag);

    // 點擊「在PDF中查看」選項
    const viewInPdfButton = screen.getByText('在PDF中查看');
    await user.click(viewInPdfButton);

    // 驗證PDF查看器狀態是否被正確設置
    await waitFor(() => {
      expect(mockSetPdfViewerState).toHaveBeenCalledWith(expect.objectContaining({
        isOpen: true,
        fileUuid: '123e4567-e89b-12d3-a456-426614174001',
        pageNumber: 5,
        highlightedSentenceUuid: '123e4567-e89b-12d3-a456-426614174000'
      }));
    });
  });
  
  it('在PDF查看器中應正確顯示文件名和頁碼', async () => {
    // 模擬PDF查看器已打開的狀態
    vi.mock('../../contexts/PDFViewerContext', () => ({
      usePDFViewerContext: () => ({
        setPdfViewerState: mockSetPdfViewerState,
        pdfViewerState: {
          isOpen: true,
          fileUuid: '123e4567-e89b-12d3-a456-426614174001',
          pageNumber: 5,
          highlightedSentenceUuid: '123e4567-e89b-12d3-a456-426614174000',
          fileName: 'test-document.pdf'
        }
      })
    }), { virtual: true });
    
    render(
      <MemoryRouter>
        <PDFViewer />
      </MemoryRouter>
    );
    
    // 驗證PDF查看器顯示了正確的文件信息
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText(/第 5 頁/)).toBeInTheDocument();
  });
  
  it('從聊天消息到PDF查看器的端到端流程測試', async () => {
    const { getFilePreviewUrl, highlightSentenceInPdf } = await import('../../services/api');
    
    render(
      <MemoryRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              <>
                <ChatMessage message={mockMessage} />
                <PDFViewer />
              </>
            } 
          />
        </Routes>
      </MemoryRouter>
    );
    
    const user = userEvent.setup();
    
    // 1. 點擊引用標籤
    const referenceTag = screen.getByText(/自適應專業知識定義/);
    await user.click(referenceTag);
    
    // 2. 選擇在PDF中查看
    const viewPdfOption = screen.getByText('在PDF中查看');
    await user.click(viewPdfOption);
    
    // 3. 驗證API調用
    await waitFor(() => {
      expect(getFilePreviewUrl).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174001');
      expect(highlightSentenceInPdf).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001', 
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });
    
    // 4. 驗證PDF查看器狀態更新
    expect(mockSetPdfViewerState).toHaveBeenCalledWith(expect.objectContaining({
      isOpen: true,
      fileUuid: '123e4567-e89b-12d3-a456-426614174001',
      pageNumber: 5,
    }));
  });

  it('測試PDF查看器中的導航功能', async () => {
    // 模擬PDF查看器已打開的狀態
    vi.mock('../../contexts/PDFViewerContext', () => ({
      usePDFViewerContext: () => ({
        setPdfViewerState: mockSetPdfViewerState,
        pdfViewerState: {
          isOpen: true,
          fileUuid: '123e4567-e89b-12d3-a456-426614174001',
          pageNumber: 5,
          highlightedSentenceUuid: '123e4567-e89b-12d3-a456-426614174000',
          fileName: 'test-document.pdf',
          totalPages: 10
        }
      })
    }), { virtual: true });
    
    render(
      <MemoryRouter>
        <PDFViewer />
      </MemoryRouter>
    );
    
    const user = userEvent.setup();
    
    // 測試下一頁按鈕
    const nextPageButton = screen.getByLabelText('下一頁');
    await user.click(nextPageButton);
    
    expect(mockSetPdfViewerState).toHaveBeenCalledWith(expect.objectContaining({
      pageNumber: 6,
    }));
    
    // 測試上一頁按鈕
    const prevPageButton = screen.getByLabelText('上一頁');
    await user.click(prevPageButton);
    
    expect(mockSetPdfViewerState).toHaveBeenCalledWith(expect.objectContaining({
      pageNumber: 5,
    }));
  });
}); 