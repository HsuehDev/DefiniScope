import React, { useState, useEffect, useRef } from 'react';
import { PDFPreviewParams } from '../../types/reference';

/**
 * PDF預覽組件
 * 顯示PDF文件並高亮顯示特定句子
 */
const PDFViewer: React.FC<PDFPreviewParams> = ({ 
  file_uuid, 
  page,
  sentence_uuid
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page || 1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 使用pdfjs加載PDF文件
  useEffect(() => {
    let isMounted = true;
    
    const loadPdf = async () => {
      setLoading(true);
      
      try {
        // 動態導入pdfjs以減少初始加載時間
        const pdfjs = await import('pdfjs-dist');
        const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
        
        pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        
        // 獲取PDF URL
        const pdfUrl = `/api/files/${file_uuid}/download`;
        
        // 加載PDF文檔
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        if (isMounted) {
          setTotalPages(pdf.numPages);
          
          // 渲染當前頁面
          renderPage(pdf, currentPage);
          
          // 如果有指定句子UUID，高亮顯示
          if (sentence_uuid) {
            highlightSentence(sentence_uuid);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('加載PDF時出錯:', err);
          setError('無法加載PDF文件。請稍後重試。');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadPdf();
    
    return () => {
      isMounted = false;
    };
  }, [file_uuid, currentPage]);

  // 渲染PDF頁面
  const renderPage = async (pdf: any, pageNum: number) => {
    try {
      const page = await pdf.getPage(pageNum);
      
      if (!containerRef.current) return;
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('無法獲取canvas上下文');
      }
      
      // 計算比例以適應容器寬度
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current.clientWidth;
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });
      
      // 設置canvas尺寸
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;
      
      // 清空容器並添加新的canvas
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(canvas);
      
      // 渲染PDF頁面到canvas
      await page.render({
        canvasContext: context,
        viewport: scaledViewport
      }).promise;
    } catch (err) {
      console.error('渲染PDF頁面時出錯:', err);
      setError('渲染頁面時發生錯誤。');
    }
  };

  // 高亮顯示特定句子
  const highlightSentence = async (sentenceUuid: string) => {
    try {
      // 從API獲取句子位置信息
      const response = await fetch(`/api/files/${file_uuid}/sentences/${sentenceUuid}/position`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 在canvas上繪製高亮
      if (containerRef.current && data.position) {
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // 使用50%透明度的黃色作為高亮顏色
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            
            // 繪製高亮矩形
            const { x, y, width, height } = data.position;
            ctx.fillRect(x, y, width, height);
            
            // 滾動到高亮位置
            setTimeout(() => {
              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: y - 100, // 上方留出一些空間
                  behavior: 'smooth'
                });
              }
            }, 100);
          }
        }
      }
    } catch (err) {
      console.error('高亮句子時出錯:', err);
    }
  };

  // 頁面導航
  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 工具欄 */}
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            aria-label="上一頁"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="text-sm">
            <span>第 </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  goToPage(val);
                }
              }}
              className="w-12 text-center border rounded p-1"
              aria-label="頁碼"
            />
            <span> / {totalPages} 頁</span>
          </div>
          
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            aria-label="下一頁"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center">
          <select
            className="text-sm border rounded p-1"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              // 這裡可以實現縮放功能
            }}
            aria-label="縮放"
          >
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1" selected>100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
        </div>
      </div>
      
      {/* PDF內容顯示區域 */}
      <div 
        className="flex-1 overflow-auto bg-gray-200 flex justify-center"
        ref={containerRef}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <svg className="animate-spin h-10 w-10 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full text-red-500">
            <p>{error}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PDFViewer; 