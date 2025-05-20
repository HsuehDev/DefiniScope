import { vi } from 'vitest';
import React from 'react';

// 模擬PDF.js的Document和Page組件
vi.mock('react-pdf', () => {
  const Document = ({ file, onLoadSuccess, onLoadError, children }: any) => {
    // 模擬文檔載入成功
    if (typeof onLoadSuccess === 'function') {
      setTimeout(() => {
        onLoadSuccess({ numPages: 5 });
      }, 0);
    }
    return React.createElement('div', { 'data-testid': 'mock-pdf-document' }, children);
  };

  const Page = ({
    pageNumber,
    scale,
    rotate,
    onRenderSuccess,
    renderTextLayer,
    renderAnnotationLayer,
    inputRef,
    ...props
  }: any) => {
    // 模擬頁面渲染成功
    if (typeof onRenderSuccess === 'function') {
      setTimeout(() => {
        onRenderSuccess(pageNumber);
      }, 0);
    }

    // 模擬ref回調
    if (typeof inputRef === 'function') {
      setTimeout(() => {
        const mockPageDiv = document.createElement('div');
        mockPageDiv.classList.add('react-pdf__Page');
        
        // 創建模擬文本層
        const textLayer = document.createElement('div');
        textLayer.classList.add('react-pdf__Page__textContent');
        
        // 添加一些模擬的文本元素
        for (let i = 0; i < 5; i++) {
          const span = document.createElement('span');
          span.textContent = `模擬文本 ${i + 1}`;
          span.style.position = 'absolute';
          span.style.left = `${i * 20}px`;
          span.style.top = `${i * 30}px`;
          textLayer.appendChild(span);
        }
        
        // 添加一個包含特定文本的元素，用於測試高亮功能
        const targetSpan = document.createElement('span');
        targetSpan.textContent = '這是一個測試高亮的句子';
        targetSpan.style.position = 'absolute';
        targetSpan.style.left = '50px';
        targetSpan.style.top = '100px';
        textLayer.appendChild(targetSpan);
        
        mockPageDiv.appendChild(textLayer);
        inputRef(mockPageDiv);
      }, 0);
    }

    return React.createElement('div', {
      'data-testid': 'mock-pdf-page',
      'data-page-number': pageNumber,
      'data-scale': scale,
      'data-rotation': rotate
    }, `模擬的PDF頁面 ${pageNumber}`);
  };

  const pdfjs = {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
    version: '2.16.105',
  };

  return {
    Document,
    Page,
    pdfjs,
  };
});

// 模擬getBoundingClientRect方法
Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function() {
  // 為不同的元素返回不同的位置信息
  if (this.classList.contains('react-pdf__Page')) {
    return {
      left: 0,
      top: 0,
      right: 800,
      bottom: 1000,
      width: 800,
      height: 1000,
      x: 0,
      y: 0,
    };
  } else if (this.textContent?.includes('測試高亮')) {
    return {
      left: 50,
      top: 100,
      right: 300,
      bottom: 130,
      width: 250,
      height: 30,
      x: 50,
      y: 100,
    };
  } else {
    // 默認值
    return {
      left: 10,
      top: 20,
      right: 110,
      bottom: 50,
      width: 100,
      height: 30,
      x: 10,
      y: 20,
    };
  }
});

// 模擬查詢選擇器方法
const originalQuerySelector = Element.prototype.querySelector;
Element.prototype.querySelector = vi.fn().mockImplementation(function(selector: string) {
  if (selector === '.react-pdf__Page__textContent') {
    const div = document.createElement('div');
    div.classList.add('react-pdf__Page__textContent');
    return div;
  }
  return originalQuerySelector.call(this, selector);
});

const originalQuerySelectorAll = Element.prototype.querySelectorAll;
Element.prototype.querySelectorAll = vi.fn().mockImplementation(function(selector: string) {
  if (selector === 'span') {
    const spans = [];
    for (let i = 0; i < 5; i++) {
      const span = document.createElement('span');
      span.textContent = `模擬文本 ${i + 1}`;
      spans.push(span);
    }
    
    // 添加測試高亮的元素
    const targetSpan = document.createElement('span');
    targetSpan.textContent = '這是一個測試高亮的句子';
    spans.push(targetSpan);
    
    return spans as any;
  }
  return originalQuerySelectorAll.call(this, selector);
});

// 模擬scrollIntoView方法
Element.prototype.scrollIntoView = vi.fn();

export {}; 