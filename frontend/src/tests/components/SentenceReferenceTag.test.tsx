import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SentenceReferenceTag from '../../components/SentenceReferenceTag';

describe('SentenceReferenceTag', () => {
  const mockReference = {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
    file_uuid: '123e4567-e89b-12d3-a456-426614174001',
    original_name: 'test-document.pdf',
    sentence: '這是一個測試引用句子。',
    page: 5,
    defining_type: 'cd' as const
  };

  const onViewContextMock = vi.fn();
  const onViewInPdfMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染引用標籤並顯示正確的標識', () => {
    render(
      <SentenceReferenceTag 
        reference={mockReference}
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    // 檢查是否渲染了引用標籤
    const tagElement = screen.getByText(/測試引用句子/);
    expect(tagElement).toBeInTheDocument();
    
    // 檢查是否顯示了正確的文件名和頁碼
    expect(screen.getByText(/test-document.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/p.5/)).toBeInTheDocument();
    
    // 檢查是否顯示了正確的定義類型
    expect(screen.getByText(/CD/)).toBeInTheDocument();
  });

  it('滑鼠懸停時顯示完整引用內容', async () => {
    render(
      <SentenceReferenceTag 
        reference={mockReference}
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    const user = userEvent.setup();
    const tagElement = screen.getByText(/測試引用句子/);
    
    // 懸停在標籤上
    await user.hover(tagElement);
    
    // 檢查是否顯示了完整引用內容
    expect(screen.getByText(mockReference.sentence)).toBeInTheDocument();
    
    // 懸停離開
    await user.unhover(tagElement);
    
    // 檢查懸停內容是否消失
    // 注意：實際測試中可能需要檢查元素的visibility或opacity
  });

  it('點擊「查看上下文」按鈕時調用onViewContext', async () => {
    render(
      <SentenceReferenceTag 
        reference={mockReference}
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    const user = userEvent.setup();
    
    // 點擊標籤打開菜單
    await user.click(screen.getByText(/測試引用句子/));
    
    // 點擊「查看上下文」按鈕
    await user.click(screen.getByText('查看上下文'));
    
    // 檢查是否調用了onViewContext並傳入正確參數
    expect(onViewContextMock).toHaveBeenCalledTimes(1);
    expect(onViewContextMock).toHaveBeenCalledWith(mockReference);
  });

  it('點擊「在PDF中查看」按鈕時調用onViewInPdf', async () => {
    render(
      <SentenceReferenceTag 
        reference={mockReference}
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    const user = userEvent.setup();
    
    // 點擊標籤打開菜單
    await user.click(screen.getByText(/測試引用句子/));
    
    // 點擊「在PDF中查看」按鈕
    await user.click(screen.getByText('在PDF中查看'));
    
    // 檢查是否調用了onViewInPdf並傳入正確參數
    expect(onViewInPdfMock).toHaveBeenCalledTimes(1);
    expect(onViewInPdfMock).toHaveBeenCalledWith(mockReference);
  });

  it('處理長句子時正確截斷顯示', () => {
    const longSentenceRef = {
      ...mockReference,
      sentence: '這是一個非常長的句子，長度超過了標籤的顯示限制，應該被截斷並顯示省略號。這一部分不應該被直接顯示，除非用戶懸停查看完整內容。'
    };

    render(
      <SentenceReferenceTag 
        reference={longSentenceRef}
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    // 檢查顯示的文本是否被截斷
    const displayedText = screen.getByText(/這是一個非常長的句子/).textContent;
    expect(displayedText?.length).toBeLessThan(longSentenceRef.sentence.length);
    expect(displayedText?.endsWith('...')).toBeTruthy();
  });

  it('處理不同定義類型的樣式差異', () => {
    const odReference = {
      ...mockReference,
      defining_type: 'od' as const
    };

    const { rerender } = render(
      <SentenceReferenceTag 
        reference={mockReference} // CD類型
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    // 檢查CD類型的樣式
    let tagElement = screen.getByText(/CD/);
    expect(tagElement).toHaveClass('cd-tag'); // 假設有這個類名

    // 重新渲染OD類型
    rerender(
      <SentenceReferenceTag 
        reference={odReference}
        onViewContext={onViewContextMock}
        onViewInPdf={onViewInPdfMock}
      />
    );

    // 檢查OD類型的樣式
    tagElement = screen.getByText(/OD/);
    expect(tagElement).toHaveClass('od-tag'); // 假設有這個類名
  });
}); 