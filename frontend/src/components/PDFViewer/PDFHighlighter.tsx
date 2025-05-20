import React, { useEffect, useRef } from 'react';

interface PDFHighlighterProps {
  pageContainer: HTMLDivElement | null;
  text: string;
  onHighlightFound?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

const PDFHighlighter: React.FC<PDFHighlighterProps> = ({
  pageContainer,
  text,
  onHighlightFound,
}) => {
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pageContainer || !text) return;

    // 清除現有高亮
    const cleanupHighlights = () => {
      const existingHighlights = document.querySelectorAll('.pdf-text-highlight');
      existingHighlights.forEach(el => el.remove());
    };

    cleanupHighlights();

    // 查找並高亮文本
    const findAndHighlightText = () => {
      const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) return;

      // 獲取頁面中的所有文本元素
      const textElements = textLayer.querySelectorAll('span');
      let fullText = '';

      // 收集所有文本內容
      textElements.forEach(span => {
        fullText += span.textContent + ' ';
      });

      // 檢查是否包含要查找的文本
      if (fullText.toLowerCase().includes(text.toLowerCase())) {
        const match = findBestTextMatch(textElements, text);
        
        if (match) {
          const { elements, rect } = match;
          
          // 創建高亮元素
          const highlight = document.createElement('div');
          highlight.className = 'pdf-text-highlight';
          highlight.style.position = 'absolute';
          highlight.style.backgroundColor = 'rgba(255, 255, 100, 0.4)';
          highlight.style.border = '2px solid rgba(255, 200, 0, 0.8)';
          highlight.style.borderRadius = '3px';
          highlight.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          highlight.style.animation = 'pulse 2s infinite';
          highlight.style.pointerEvents = 'none';
          highlight.style.zIndex = '1';
          
          // 設置高亮元素的位置和尺寸
          highlight.style.left = `${rect.x}px`;
          highlight.style.top = `${rect.y}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
          
          // 將高亮元素添加到頁面容器
          pageContainer.appendChild(highlight);
          highlightRef.current = highlight;
          
          // 滾動到高亮位置
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // 回調，傳遞高亮位置信息
          if (onHighlightFound) {
            onHighlightFound(rect);
          }
          
          return true;
        }
      }
      
      return false;
    };

    // 由於PDF.js可能需要時間來完全渲染文本層，我們使用延遲和重試
    let attempts = 0;
    const maxAttempts = 5;
    const attemptInterval = 300; // 毫秒

    const attemptHighlight = () => {
      if (attempts >= maxAttempts) {
        console.warn('無法在PDF頁面找到指定文本:', text);
        return;
      }

      attempts++;
      
      if (!findAndHighlightText()) {
        // 如果未找到，稍後再試
        setTimeout(attemptHighlight, attemptInterval);
      }
    };

    // 開始嘗試高亮
    setTimeout(attemptHighlight, 100);

    // 清理函數
    return () => {
      cleanupHighlights();
    };
  }, [pageContainer, text, onHighlightFound]);

  // 查找最佳文本匹配
  const findBestTextMatch = (
    textElements: NodeListOf<Element>,
    searchText: string
  ): { elements: Element[], rect: { x: number; y: number; width: number; height: number } } | null => {
    const normalizedSearchText = searchText.trim().toLowerCase();
    let currentMatch = '';
    let matchElements: Element[] = [];
    
    for (let i = 0; i < textElements.length; i++) {
      const element = textElements[i];
      const text = element.textContent || '';
      
      currentMatch += text + ' ';
      matchElements.push(element);
      
      if (currentMatch.toLowerCase().includes(normalizedSearchText)) {
        // 計算邊界框
        const rects = matchElements.map(el => el.getBoundingClientRect());
        
        const pageRect = matchElements[0].closest('.react-pdf__Page')?.getBoundingClientRect();
        if (!pageRect) return null;
        
        // 計算相對於頁面容器的位置
        const minX = Math.min(...rects.map(r => r.left)) - pageRect.left;
        const minY = Math.min(...rects.map(r => r.top)) - pageRect.top;
        const maxX = Math.max(...rects.map(r => r.right)) - pageRect.left;
        const maxY = Math.max(...rects.map(r => r.bottom)) - pageRect.top;
        
        return {
          elements: matchElements,
          rect: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          }
        };
      }
      
      // 如果當前匹配文本過長，重新開始
      if (currentMatch.length > normalizedSearchText.length * 3) {
        currentMatch = text + ' ';
        matchElements = [element];
      }
    }
    
    return null;
  };

  return null; // 此組件不直接渲染任何內容，只負責創建高亮效果
};

export default PDFHighlighter; 