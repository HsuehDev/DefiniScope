import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { DetailPanel } from '../DetailPanel';
import { SentenceData, ReferencedSentence, DefiningType } from '../../../types/progress';

describe('DetailPanel組件', () => {
  // 模擬測試數據
  const extractedSentences: SentenceData[] = [
    {
      sentence_uuid: 'ext-1',
      file_uuid: 'file-1',
      sentence: '這是提取的第一個句子',
      page: 1,
    },
    {
      sentence_uuid: 'ext-2',
      file_uuid: 'file-1',
      sentence: '這是提取的第二個句子',
      page: 2,
    }
  ];
  
  const classifiedSentences: SentenceData[] = [
    {
      sentence_uuid: 'cls-1',
      file_uuid: 'file-1',
      sentence: '這是一個概念型定義句子',
      page: 1,
      defining_type: 'cd' as DefiningType,
      reason: '包含明確的概念定義'
    },
    {
      sentence_uuid: 'cls-2',
      file_uuid: 'file-1',
      sentence: '這是一個操作型定義句子',
      page: 2,
      defining_type: 'od' as DefiningType,
      reason: '包含明確的操作過程'
    }
  ];
  
  const keywords = ['自適應專業知識', '概念定義', '操作定義'];
  
  const referencedSentences: ReferencedSentence[] = [
    {
      sentence_uuid: 'ref-1',
      file_uuid: 'file-1',
      original_name: 'document1.pdf',
      sentence: '這是參考的第一個句子',
      page: 5,
      defining_type: 'cd' as DefiningType
    },
    {
      sentence_uuid: 'ref-2',
      file_uuid: 'file-2',
      original_name: 'document2.pdf',
      sentence: '這是參考的第二個句子',
      page: 10,
      defining_type: 'od' as DefiningType
    }
  ];
  
  const searchResults: Record<string, ReferencedSentence[]> = {
    '自適應專業知識': [
      {
        sentence_uuid: 'search-1',
        file_uuid: 'file-1',
        original_name: 'document1.pdf',
        sentence: '自適應專業知識指的是...',
        page: 15,
        defining_type: 'cd' as DefiningType,
        relevance_score: 0.95
      }
    ],
    '概念定義': [
      {
        sentence_uuid: 'search-2',
        file_uuid: 'file-2',
        original_name: 'document2.pdf',
        sentence: '概念定義是一種...',
        page: 20,
        defining_type: 'cd' as DefiningType,
        relevance_score: 0.85
      }
    ]
  };
  
  const foundDefinitions = { cd: 3, od: 2 };
  
  it('應該顯示PDF提取的句子', async () => {
    render(
      <DetailPanel 
        extractedSentences={extractedSentences}
      />
    );
    
    // 檢查標題和計數
    const headerElement = screen.getByTestId('extracted-sentences-header');
    expect(headerElement).toHaveTextContent('已提取句子');
    expect(headerElement).toHaveTextContent('2');
    
    // 因為默認可能是摺疊的，先點擊展開
    fireEvent.click(headerElement);
    
    // 等待內容出現
    const contentElement = await screen.findByTestId('extracted-sentences-content');
    
    // 檢查句子內容
    expect(contentElement).toHaveTextContent('這是提取的第一個句子');
    expect(contentElement).toHaveTextContent('這是提取的第二個句子');
  });
  
  it('應該顯示分類後的句子', () => {
    render(
      <DetailPanel 
        classifiedSentences={classifiedSentences}
      />
    );
    
    // 檢查標題和計數
    const headerElement = screen.getByTestId('classified-sentences-header');
    expect(headerElement).toHaveTextContent('已分類句子');
    expect(headerElement).toHaveTextContent('2');
    
    // 因為已分類句子默認展開
    const contentElement = screen.getByTestId('classified-sentences-content');
    expect(contentElement).toBeInTheDocument();
    
    // 檢查句子卡片在內容區域中
    const sentenceCards = within(contentElement).getAllByTestId('sentence-card');
    expect(sentenceCards.length).toBe(2);
    
    // 檢查第一個句子內容
    const firstCard = sentenceCards[0];
    expect(firstCard).toHaveTextContent('這是一個概念型定義句子');
    expect(firstCard).toHaveTextContent('概念型定義');
    
    // 檢查第二個句子內容
    const secondCard = sentenceCards[1];
    expect(secondCard).toHaveTextContent('這是一個操作型定義句子');
    expect(secondCard).toHaveTextContent('操作型定義');
  });
  
  it('應該顯示關鍵詞和定義統計', () => {
    render(
      <DetailPanel 
        keywords={keywords}
        foundDefinitions={foundDefinitions}
      />
    );
    
    // 檢查關鍵詞顯示
    const keywordsSection = screen.getByTestId('keywords-section');
    expect(keywordsSection).toHaveTextContent('關鍵詞');
    
    // 檢查所有關鍵詞都存在
    expect(screen.getByTestId('keyword-自適應專業知識')).toBeInTheDocument();
    expect(screen.getByTestId('keyword-概念定義')).toBeInTheDocument();
    expect(screen.getByTestId('keyword-操作定義')).toBeInTheDocument();
    
    // 檢查定義統計
    const cdStats = screen.getByTestId('definition-stats-cd');
    const odStats = screen.getByTestId('definition-stats-od');
    
    expect(cdStats).toHaveTextContent('3');
    expect(odStats).toHaveTextContent('2');
    expect(cdStats).toHaveTextContent('概念型定義');
    expect(odStats).toHaveTextContent('操作型定義');
  });
  
  it('應該顯示搜尋結果', async () => {
    render(
      <DetailPanel 
        searchResults={searchResults}
      />
    );
    
    // 檢查搜尋結果區段
    const searchResultsHeader = screen.getByTestId('search-results-header');
    expect(searchResultsHeader).toHaveTextContent('搜尋結果');
    expect(searchResultsHeader).toHaveTextContent('2'); // 總結果數
    
    // 搜尋結果默認應該是展開的
    const contentElement = screen.getByTestId('search-results-content');
    expect(contentElement).toBeInTheDocument();
    
    // 檢查關鍵詞標題存在
    expect(contentElement).toHaveTextContent(/關鍵詞: 自適應專業知識/);
    expect(contentElement).toHaveTextContent(/關鍵詞: 概念定義/);
    
    // 檢查句子內容
    expect(contentElement).toHaveTextContent('自適應專業知識指的是');
    expect(contentElement).toHaveTextContent('概念定義是一種');
  });
  
  it('應該顯示生成答案時參考的句子', () => {
    render(
      <DetailPanel 
        referencedSentences={referencedSentences}
      />
    );
    
    // 檢查參考句子區段
    const referencedHeader = screen.getByTestId('referenced-sentences-header');
    expect(referencedHeader).toHaveTextContent('生成答案參考句子');
    expect(referencedHeader).toHaveTextContent('2'); // 句子數量
    
    // 參考句子默認應該是展開的
    const contentElement = screen.getByTestId('referenced-sentences-content');
    expect(contentElement).toBeInTheDocument();
    
    // 檢查句子卡片在內容區域中
    const sentenceCards = within(contentElement).getAllByTestId('sentence-card');
    expect(sentenceCards.length).toBe(2);
    
    // 檢查句子內容和來源
    const firstCard = sentenceCards[0];
    expect(firstCard).toHaveTextContent('這是參考的第一個句子');
    expect(firstCard).toHaveTextContent('來源: document1.pdf');
    
    const secondCard = sentenceCards[1];
    expect(secondCard).toHaveTextContent('這是參考的第二個句子');
    expect(secondCard).toHaveTextContent('來源: document2.pdf');
  });
  
  it('應該處理句子點擊事件', () => {
    const handleSentenceClick = vi.fn();
    
    render(
      <DetailPanel 
        classifiedSentences={classifiedSentences}
        onSentenceClick={handleSentenceClick}
      />
    );
    
    // 在分類句子內容區域中找到句子卡片元素
    const contentElement = screen.getByTestId('classified-sentences-content');
    const sentenceCards = within(contentElement).getAllByTestId('sentence-card');
    
    // 點擊第一個句子卡片
    fireEvent.click(sentenceCards[0]);
    
    // 驗證回調被調用，並且傳入正確的句子數據
    expect(handleSentenceClick).toHaveBeenCalledTimes(1);
    expect(handleSentenceClick).toHaveBeenCalledWith(classifiedSentences[0]);
  });
  
  it('應該接受自定義CSS類別', () => {
    render(
      <DetailPanel 
        keywords={keywords}
        className="custom-detail-panel"
      />
    );
    
    const panelContainer = screen.getByTestId('detail-panel-container');
    expect(panelContainer).toHaveClass('custom-detail-panel');
  });
  
  it('應該處理折疊和展開功能', async () => {
    render(
      <DetailPanel 
        extractedSentences={extractedSentences}
        classifiedSentences={classifiedSentences}
      />
    );
    
    // 已提取句子默認應該是折疊的
    expect(screen.queryByTestId('extracted-sentences-content')).not.toBeInTheDocument();
    
    // 點擊展開已提取句子區塊
    const extractedHeader = screen.getByTestId('extracted-sentences-header');
    fireEvent.click(extractedHeader);
    
    // 驗證內容現在可見
    const extractedContent = await screen.findByTestId('extracted-sentences-content');
    expect(extractedContent).toBeInTheDocument();
    expect(extractedContent).toHaveTextContent('這是提取的第一個句子');
    
    // 已分類句子默認應該是展開的
    const classifiedContent = screen.getByTestId('classified-sentences-content');
    expect(classifiedContent).toBeInTheDocument();
    
    // 點擊折疊已分類句子區塊
    const classifiedHeader = screen.getByTestId('classified-sentences-header');
    fireEvent.click(classifiedHeader);
    
    // 驗證內容不再可見
    await waitFor(() => {
      expect(screen.queryByTestId('classified-sentences-content')).not.toBeInTheDocument();
    });
  });
  
  it('當提供空數據時應該正確渲染', () => {
    // 不提供任何數據
    render(<DetailPanel />);
    
    // 不應該顯示任何區段
    expect(screen.queryByTestId('keywords-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('extracted-sentences-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('classified-sentences-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-results-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('referenced-sentences-header')).not.toBeInTheDocument();
  });
}); 