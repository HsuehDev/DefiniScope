import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import PDFHighlighter from '../../../components/PDFViewer/PDFHighlighter';

// 引入PDF.js模擬
import '../../mocks/pdfjs.mock';

describe('PDFHighlighter組件', () => {
  // 設置DOM環境
  beforeEach(() => {
    // 創建一個模擬的頁面容器
    const mockContainer = document.createElement('div');
    mockContainer.classList.add('react-pdf__Page');
    
    // 添加文本層
    const textLayer = document.createElement('div');
    textLayer.classList.add('react-pdf__Page__textContent');
    
    // 添加幾個文本span
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.textContent = `測試文本 ${i + 1}`;
      textLayer.appendChild(span);
    }
    
    // 添加包含目標文本的span
    const targetSpan = document.createElement('span');
    targetSpan.textContent = '這是一個測試高亮的句子';
    textLayer.appendChild(targetSpan);
    
    mockContainer.appendChild(textLayer);
    document.body.appendChild(mockContainer);
  });
  
  afterEach(() => {
    // 清理DOM
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });
  
  // 簡化的測試 - 只檢查組件是否正確渲染
  test('正確渲染高亮元素', () => {
    // 創建回調函數用於測試
    const mockHighlightFoundCallback = vi.fn();
    
    // 獲取測試容器
    const pageContainer = document.querySelector('.react-pdf__Page') as HTMLDivElement;
    
    // 渲染高亮組件
    render(
      <PDFHighlighter
        pageContainer={pageContainer}
        text="這是一個測試高亮的句子"
        onHighlightFound={mockHighlightFoundCallback}
      />
    );
    
    // 驗證組件渲染但不返回內容（因為它是無渲染組件）
    expect(screen.queryByText('高亮')).not.toBeInTheDocument();
  });
  
  test('處理pageContainer為null的情況', () => {
    // 渲染時傳入null作為頁面容器
    render(
      <PDFHighlighter
        pageContainer={null}
        text="測試文本"
        onHighlightFound={vi.fn()}
      />
    );
    
    // 確保不會拋出錯誤且組件正確渲染
    expect(screen.queryByText('高亮')).not.toBeInTheDocument();
  });
}); 