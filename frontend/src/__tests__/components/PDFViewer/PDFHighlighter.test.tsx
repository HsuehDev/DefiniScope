import React from 'react';
import { render, waitFor } from '@testing-library/react';
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
  
  test('成功高亮指定文本', async () => {
    // 模擬appendChild方法，用於檢測高亮元素的創建
    const appendChildSpy = vi.spyOn(HTMLDivElement.prototype, 'appendChild');
    
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
    
    // 等待高亮過程完成 - 增加超時時間
    await waitFor(() => {
      // 驗證是否創建了高亮元素
      expect(appendChildSpy).toHaveBeenCalled();
    }, { timeout: 10000 });
    
    const highlightDiv = document.querySelector('.pdf-text-highlight');
    expect(highlightDiv).not.toBeNull();
    
    // 驗證高亮元素的樣式和位置
    if (highlightDiv) {
      expect(highlightDiv.style.backgroundColor).toBe('rgba(255, 255, 100, 0.4)');
      expect(highlightDiv.style.position).toBe('absolute');
    }
    
    // 驗證回調函數是否被調用
    expect(mockHighlightFoundCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number)
      })
    );
  }, 10000); // 增加測試超時時間
  
  test('處理找不到文本的情況', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pageContainer = document.querySelector('.react-pdf__Page') as HTMLDivElement;
    
    render(
      <PDFHighlighter
        pageContainer={pageContainer}
        text="這個文本不存在於頁面中"
        onHighlightFound={vi.fn()}
      />
    );
    
    // 將等待時間減少，避免測試超時
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    }, { timeout: 10000 });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('無法在PDF頁面找到指定文本'),
      expect.anything()
    );
    
    // 驗證沒有創建高亮元素
    const highlightDiv = document.querySelector('.pdf-text-highlight');
    expect(highlightDiv).toBeNull();
  }, 10000); // 增加測試超時時間
  
  test('處理pageContainer為null的情況', () => {
    // 渲染時傳入null作為頁面容器
    render(
      <PDFHighlighter
        pageContainer={null}
        text="測試文本"
        onHighlightFound={vi.fn()}
      />
    );
    
    // 確保不會拋出錯誤
    const highlightDiv = document.querySelector('.pdf-text-highlight');
    expect(highlightDiv).toBeNull();
  });
  
  test('多次嘗試直到找到文本', async () => {
    // 創建動態更新文本的測試場景
    const pageContainer = document.querySelector('.react-pdf__Page') as HTMLDivElement;
    const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent') as HTMLDivElement;
    
    // 先清空文本層
    textLayer.innerHTML = '';
    
    const mockHighlightFoundCallback = vi.fn();
    
    render(
      <PDFHighlighter
        pageContainer={pageContainer}
        text="延遲添加的目標文本"
        onHighlightFound={mockHighlightFoundCallback}
      />
    );
    
    // 延遲添加目標文本
    setTimeout(() => {
      const targetSpan = document.createElement('span');
      targetSpan.textContent = '延遲添加的目標文本';
      textLayer.appendChild(targetSpan);
    }, 100);
    
    // 等待高亮過程完成 - 使用更長的超時時間
    await waitFor(() => {
      expect(mockHighlightFoundCallback).toHaveBeenCalled();
    }, { timeout: 10000 });
    
    // 驗證高亮元素已創建
    const highlightDiv = document.querySelector('.pdf-text-highlight');
    expect(highlightDiv).not.toBeNull();
  }, 10000); // 增加測試超時時間
}); 