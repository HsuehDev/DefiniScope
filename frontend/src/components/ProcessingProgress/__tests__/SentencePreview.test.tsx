import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { SentencePreview } from '../SentencePreview';
import { SentenceData, ReferencedSentence } from '../../../types/progress';

describe('SentencePreview組件', () => {
  // 模擬基本句子數據
  const baseSentenceData: SentenceData = {
    sentence: '這是一個測試句子，用於測試SentencePreview組件',
    page: 5,
  };
  
  // 概念型定義句子
  const cdSentence: SentenceData = {
    ...baseSentenceData,
    sentence_uuid: 'cd-123',
    file_uuid: 'file-123',
    defining_type: 'cd',
    reason: '此句包含明確的概念定義'
  };
  
  // 操作型定義句子
  const odSentence: SentenceData = {
    ...baseSentenceData,
    sentence_uuid: 'od-123',
    file_uuid: 'file-123',
    defining_type: 'od',
    reason: '此句包含明確的操作型定義'
  };
  
  // 非定義句子
  const nonDefSentence: SentenceData = {
    ...baseSentenceData,
    sentence_uuid: 'non-123',
    file_uuid: 'file-123',
    defining_type: 'none',
  };
  
  // 引用型句子（含原文件名和相關度）
  const referencedSentence: ReferencedSentence = {
    sentence_uuid: 'ref-123',
    file_uuid: 'file-123',
    original_name: 'example.pdf',
    sentence: '這是一個從PDF文件引用的句子',
    page: 10,
    defining_type: 'cd',
    relevance_score: 0.85
  };
  
  it('應該正確顯示基本句子信息', () => {
    render(<SentencePreview sentence={baseSentenceData} />);
    
    // 檢查句子內容和頁碼是否正確顯示
    expect(screen.getByTestId('sentence-text')).toHaveTextContent(baseSentenceData.sentence);
    expect(screen.getByTestId('sentence-page')).toHaveTextContent('頁碼: 5');
  });
  
  it('應該正確顯示概念型定義標籤', () => {
    render(<SentencePreview sentence={cdSentence} />);
    
    // 檢查概念型定義標籤
    const badge = screen.getByTestId('sentence-type-badge');
    expect(badge).toHaveTextContent('概念型定義');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-800');
    
    // 檢查分類理由
    expect(screen.getByTestId('sentence-reason')).toBeInTheDocument();
    expect(screen.getByTestId('sentence-reason')).toHaveTextContent('此句包含明確的概念定義');
    
    // 檢查左側邊框顏色
    const card = screen.getByTestId('sentence-card');
    expect(card).toHaveClass('border-l-blue-500');
  });
  
  it('應該正確顯示操作型定義標籤', () => {
    render(<SentencePreview sentence={odSentence} />);
    
    // 檢查操作型定義標籤
    const badge = screen.getByTestId('sentence-type-badge');
    expect(badge).toHaveTextContent('操作型定義');
    expect(badge).toHaveClass('bg-green-100');
    expect(badge).toHaveClass('text-green-800');
    
    // 檢查分類理由
    expect(screen.getByTestId('sentence-reason')).toBeInTheDocument();
    expect(screen.getByTestId('sentence-reason')).toHaveTextContent('此句包含明確的操作型定義');
    
    // 檢查左側邊框顏色
    const card = screen.getByTestId('sentence-card');
    expect(card).toHaveClass('border-l-green-500');
  });
  
  it('應該正確顯示非定義句子標籤', () => {
    render(<SentencePreview sentence={nonDefSentence} />);
    
    // 檢查非定義句標籤
    const badge = screen.getByTestId('sentence-type-badge');
    expect(badge).toHaveTextContent('非定義句');
    expect(badge).toHaveClass('bg-gray-100');
    expect(badge).toHaveClass('text-gray-800');
    
    // 檢查左側邊框顏色
    const card = screen.getByTestId('sentence-card');
    expect(card).toHaveClass('border-l-gray-300');
  });
  
  it('應該正確顯示引用型句子的額外信息', () => {
    render(<SentencePreview sentence={referencedSentence} />);
    
    // 檢查引用句子的特殊字段
    expect(screen.getByTestId('sentence-text')).toHaveTextContent(referencedSentence.sentence);
    expect(screen.getByTestId('sentence-source')).toHaveTextContent('來源: example.pdf');
    expect(screen.getByTestId('sentence-relevance')).toHaveTextContent('相關度: 85%');
  });
  
  it('應該處理長句子顯示截斷', () => {
    // 創建一個真正的長句子，超過150個字符
    const veryLongSentence = '這是一個非常長的測試句子，'.repeat(25); // 大約300個字符
    
    const longSentence: SentenceData = {
      ...baseSentenceData,
      sentence: veryLongSentence
    };
    
    render(<SentencePreview sentence={longSentence} />);
    
    // 檢查句子是否被截斷顯示
    const displayedText = screen.getByTestId('sentence-text');
    expect(displayedText.textContent?.length).toBeLessThan(veryLongSentence.length);
    expect(displayedText.textContent?.endsWith('...')).toBeTruthy();
  });
  
  it('應該響應點擊事件', () => {
    const handleClick = vi.fn();
    
    render(
      <SentencePreview 
        sentence={cdSentence} 
        onClick={handleClick}
      />
    );
    
    // 檢查樣式有包含 cursor-pointer
    const card = screen.getByTestId('sentence-card');
    expect(card).toHaveClass('cursor-pointer');
    
    // 觸發點擊事件
    fireEvent.click(card);
    
    // 檢查是否調用了點擊處理函數
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('當沒有onClick時不應顯示指針光標', () => {
    render(<SentencePreview sentence={baseSentenceData} />);
    
    // 檢查樣式沒有包含 cursor-pointer
    const card = screen.getByTestId('sentence-card');
    expect(card).not.toHaveClass('cursor-pointer');
  });
  
  it('應該接受自定義CSS類別', () => {
    render(
      <SentencePreview 
        sentence={baseSentenceData} 
        className="custom-sentence-class"
      />
    );
    
    // 檢查自定義CSS類
    const sentenceCard = screen.getByTestId('sentence-card');
    expect(sentenceCard).toHaveClass('custom-sentence-class');
  });
}); 