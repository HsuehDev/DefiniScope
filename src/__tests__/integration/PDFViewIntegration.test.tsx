import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// 導入組件
import ReferenceTag from '../../components/reference/ReferenceTag';
import PDFPreviewModal from '../../components/reference/PDFPreviewModal';

// 模擬API服務
vi.mock('../../services/api', () => ({
  getFileInfo: vi.fn().mockResolvedValue({
    file_uuid: 'test-file-uuid',
    original_name: 'test-document.pdf',
    page_count: 10
  }),
  getSentenceContext: vi.fn().mockResolvedValue({
    before: ['這是前一個句子。'],
    after: ['這是後一個句子。']
  })
}));

// 模擬PDF查看器組件
vi.mock('../../components/reference/PDFViewer', () => ({
  default: (props: any) => (
    <div 
      data-testid="mock-pdf-viewer" 
      data-file-uuid={props.file_uuid} 
      data-sentence-uuid={props.sentence_uuid}
      data-page={props.page}
    >
      模擬的PDF查看器
    </div>
  )
}));

describe('PDF查看功能集成測試', () => {
  const mockReference = {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
    file_uuid: '123e4567-e89b-12d3-a456-426614174001',
    original_name: 'test-document.pdf',
    sentence: '自適應專業知識定義為一種高度靈活的專業知識形態。',
    page: 5,
    defining_type: 'cd' as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('從引用標籤到PDF預覽的完整流程', async () => {
    // 創建測試組件，模擬實際用例
    const TestComponent = () => {
      const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
      const [selectedReference, setSelectedReference] = React.useState<any>(null);
      
      return (
        <>
          <ReferenceTag 
            reference={mockReference} 
            onClick={(ref) => {
              setSelectedReference(ref);
              setIsPreviewOpen(true);
            }}
            onHover={vi.fn()}
          />
          
          {selectedReference && (
            <PDFPreviewModal
              reference={selectedReference}
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
            />
          )}
        </>
      );
    };
    
    render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>
    );
    
    const user = userEvent.setup();
    
    // 1. 點擊引用標籤
    const referenceTag = screen.getByText(/自適應專業知識定義/);
    await user.click(referenceTag);
    
    // 2. 驗證PDF預覽模態框已打開
    await waitFor(() => {
      const pdfModal = screen.getByRole('dialog');
      expect(pdfModal).toBeInTheDocument();
    });
    
    // 3. 驗證正確的文件和句子信息被傳遞給PDF查看器
    const pdfViewer = screen.getByTestId('mock-pdf-viewer');
    expect(pdfViewer).toBeInTheDocument();
    expect(pdfViewer.getAttribute('data-file-uuid')).toBe(mockReference.file_uuid);
    expect(pdfViewer.getAttribute('data-sentence-uuid')).toBe(mockReference.sentence_uuid);
    expect(pdfViewer.getAttribute('data-page')).toBe(mockReference.page.toString());
  });
  
  it('關閉PDF預覽模態框', async () => {
    // 模擬已打開的PDF預覽模態框
    const TestComponent = () => {
      const [isPreviewOpen, setIsPreviewOpen] = React.useState(true);
      
      return (
        <PDFPreviewModal
          reference={mockReference}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      );
    };
    
    render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>
    );
    
    // 等待模態框加載
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    const user = userEvent.setup();
    
    // 點擊關閉按鈕
    const closeButton = screen.getByRole('button', { name: /關閉/ });
    await user.click(closeButton);
    
    // 驗證模態框已關閉
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
}); 