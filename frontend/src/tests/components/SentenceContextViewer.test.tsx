import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SentenceContextViewer from '../../components/SentenceContextViewer';

describe('SentenceContextViewer', () => {
  const mockReference = {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
    file_uuid: '123e4567-e89b-12d3-a456-426614174001',
    original_name: 'test-document.pdf',
    sentence: '這是一個測試引用句子。',
    page: 5,
    defining_type: 'cd' as const
  };

  const mockContext = {
    beforeContext: [
      '這是引用句子前的第一個句子。',
      '這是引用句子前的第二個句子。'
    ],
    afterContext: [
      '這是引用句子後的第一個句子。',
      '這是引用句子後的第二個句子。'
    ],
    isLoading: false
  };

  const onViewInPdfMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('當isOpen為false時不渲染內容', () => {
    const { container } = render(
      <SentenceContextViewer
        isOpen={false}
        reference={mockReference}
        context={mockContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );

    // 檢查容器是否為空或不可見
    expect(container.firstChild).toBeNull();
  });

  it('當isOpen為true時正確渲染內容', () => {
    render(
      <SentenceContextViewer
        isOpen={true}
        reference={mockReference}
        context={mockContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );

    // 檢查標題是否正確
    expect(screen.getByText(/上下文查看/)).toBeInTheDocument();
    
    // 檢查引用句子是否高亮顯示
    const highlightedSentence = screen.getByText(mockReference.sentence);
    expect(highlightedSentence).toBeInTheDocument();
    expect(highlightedSentence).toHaveClass('highlighted-sentence');
    
    // 檢查前後上下文是否正確顯示
    mockContext.beforeContext.forEach(sentence => {
      expect(screen.getByText(sentence)).toBeInTheDocument();
    });
    
    mockContext.afterContext.forEach(sentence => {
      expect(screen.getByText(sentence)).toBeInTheDocument();
    });
  });

  it('點擊關閉按鈕時調用onClose', async () => {
    render(
      <SentenceContextViewer
        isOpen={true}
        reference={mockReference}
        context={mockContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('關閉'));
    
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('點擊「在PDF中查看」按鈕時調用onViewInPdf', async () => {
    render(
      <SentenceContextViewer
        isOpen={true}
        reference={mockReference}
        context={mockContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByText(/在PDF中查看/));
    
    expect(onViewInPdfMock).toHaveBeenCalledTimes(1);
    expect(onViewInPdfMock).toHaveBeenCalledWith(mockReference);
  });

  it('正確顯示文件名和頁碼信息', () => {
    render(
      <SentenceContextViewer
        isOpen={true}
        reference={mockReference}
        context={mockContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );
    
    expect(screen.getByText(/test-document.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/第5頁/)).toBeInTheDocument();
  });

  it('當context.isLoading為true時顯示載入狀態', () => {
    const loadingContext = { ...mockContext, isLoading: true };
    
    render(
      <SentenceContextViewer
        isOpen={true}
        reference={mockReference}
        context={loadingContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );
    
    expect(screen.getByText(/正在載入上下文/)).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('當上下文為空時顯示適當提示', () => {
    const emptyContext = {
      beforeContext: [],
      afterContext: [],
      isLoading: false
    };
    
    render(
      <SentenceContextViewer
        isOpen={true}
        reference={mockReference}
        context={emptyContext}
        onViewInPdf={onViewInPdfMock}
        onClose={onCloseMock}
      />
    );
    
    expect(screen.getByText(/無法取得更多上下文/)).toBeInTheDocument();
  });
}); 