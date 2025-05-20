import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReferenceContextViewer from '../../../components/reference/ReferenceContextViewer';

// 模擬API服務
vi.mock('../../../services/api', () => ({
  getSentenceContext: vi.fn().mockResolvedValue({
    before: ['這是前一個句子。'],
    sentence: '這是一個測試引用句子。',
    after: ['這是後一個句子。']
  })
}));

describe('ReferenceContextViewer', () => {
  const mockReference = {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
    file_uuid: '123e4567-e89b-12d3-a456-426614174001',
    original_name: 'test-document.pdf',
    sentence: '這是一個測試引用句子。',
    page: 5,
    defining_type: 'cd' as const
  };

  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('當isOpen為false時不渲染內容', () => {
    const { container } = render(
      <ReferenceContextViewer
        isOpen={false}
        reference={mockReference}
        onClose={onCloseMock}
      />
    );

    // 檢查容器是否為空或不可見
    expect(container.firstChild).toBeNull();
  });

  it('當isOpen為true時正確渲染內容', async () => {
    render(
      <ReferenceContextViewer
        isOpen={true}
        reference={mockReference}
        onClose={onCloseMock}
      />
    );

    // 等待加載完成
    await screen.findByText(/上下文查看/);
    
    // 檢查標題是否正確
    expect(screen.getByText(/上下文查看/)).toBeInTheDocument();
    
    // 檢查引用句子是否高亮顯示
    const highlightedSentence = await screen.findByText(mockReference.sentence);
    expect(highlightedSentence).toBeInTheDocument();
    expect(highlightedSentence).toHaveClass('bg-yellow-100');
  });

  it('點擊關閉按鈕時調用onClose', async () => {
    render(
      <ReferenceContextViewer
        isOpen={true}
        reference={mockReference}
        onClose={onCloseMock}
      />
    );

    // 等待加載完成
    await screen.findByText(/上下文查看/);
    
    const user = userEvent.setup();
    const closeButton = screen.getByRole('button', { name: /關閉/ });
    
    await user.click(closeButton);
    
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('正確顯示文件名和頁碼信息', async () => {
    render(
      <ReferenceContextViewer
        isOpen={true}
        reference={mockReference}
        onClose={onCloseMock}
      />
    );
    
    // 等待加載完成
    await screen.findByText(/上下文查看/);
    
    expect(screen.getByText(/test-document.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/第5頁/)).toBeInTheDocument();
  });

  it('顯示載入中狀態', () => {
    // 模擬加載狀態
    vi.spyOn(React, 'useState').mockImplementationOnce(() => [true, vi.fn()]);
    
    render(
      <ReferenceContextViewer
        isOpen={true}
        reference={mockReference}
        onClose={onCloseMock}
      />
    );
    
    expect(screen.getByText(/正在載入上下文/)).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
}); 