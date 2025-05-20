import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

interface PDFThumbnailSidebarProps {
  fileUuid: string;
  numPages: number;
  currentPage: number;
  pdfUrl: string;
  onPageSelect: (pageNumber: number) => void;
}

const PDFThumbnailSidebar: React.FC<PDFThumbnailSidebarProps> = ({
  fileUuid,
  numPages,
  currentPage,
  pdfUrl,
  onPageSelect,
}) => {
  const [pages, setPages] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [visiblePages, setVisiblePages] = useState<{ start: number; end: number }>({
    start: 1,
    end: Math.min(20, numPages),
  });

  // 初始加載頁面範圍
  useEffect(() => {
    if (numPages > 0) {
      const initialPages = Array.from({ length: Math.min(20, numPages) }, (_, i) => i + 1);
      setPages(initialPages);
      setLoading(false);

      // 如果當前頁不在可見範圍內，調整範圍
      if (currentPage < visiblePages.start || currentPage > visiblePages.end) {
        updateVisibleRange(currentPage);
      }
    }
  }, [numPages, currentPage]);

  // 根據滾動位置更新可見頁面範圍
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPosition = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollMax = container.scrollHeight;
    
    // 如果已經滾動到底部，加載更多頁面
    if (scrollPosition + containerHeight >= scrollMax - 20) {
      loadMorePages();
    }
  };

  // 加載更多頁面
  const loadMorePages = () => {
    if (pages.length < numPages) {
      const newPages = Array.from(
        { length: Math.min(10, numPages - pages.length) },
        (_, i) => pages.length + i + 1
      );
      setPages([...pages, ...newPages]);
    }
  };

  // 更新可見範圍
  const updateVisibleRange = (centerPage: number) => {
    const buffer = 10; // 上下各顯示幾頁
    let start = Math.max(1, centerPage - buffer);
    let end = Math.min(numPages, centerPage + buffer);
    
    // 確保總是顯示至少 2*buffer+1 頁（如果有那麼多頁的話）
    const rangeSize = end - start + 1;
    if (rangeSize < Math.min(2 * buffer + 1, numPages)) {
      if (start === 1) {
        end = Math.min(numPages, start + 2 * buffer);
      } else if (end === numPages) {
        start = Math.max(1, end - 2 * buffer);
      }
    }
    
    setVisiblePages({ start, end });
    
    // 確保需要的頁面在頁面數組中
    const maxPage = Math.max(...pages, 0); // 使用0作為空數組時的默認值
    if (end > maxPage && end > 0 && maxPage >= 0 && (end - maxPage) > 0) {
      try {
        const newPages = Array.from(
          { length: end - maxPage },
          (_, i) => maxPage + i + 1
        );
        setPages([...pages, ...newPages]);
      } catch (error) {
        console.error('生成頁面數組時出錯:', error, { end, maxPage, numPages });
      }
    }
  };

  // 頁面選擇處理
  const handlePageClick = (pageNumber: number) => {
    onPageSelect(pageNumber);
  };

  // 渲染縮略圖
  const renderThumbnail = (pageNumber: number) => {
    const isActive = pageNumber === currentPage;
    
    return (
      <div
        key={`thumbnail-${pageNumber}`}
        className={`cursor-pointer mb-2 ${
          isActive ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'
        }`}
        onClick={() => handlePageClick(pageNumber)}
      >
        <div className="text-xs text-center bg-gray-200 py-1">
          第 {pageNumber} 頁
        </div>
        <div className="thumbnail-container">
          <Page
            key={`page_${pageNumber}`}
            pageNumber={pageNumber}
            width={150}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </div>
      </div>
    );
  };

  // 當前頁面更改時，確保該頁的縮略圖在視窗中
  useEffect(() => {
    const thumbnailElement = document.getElementById(`thumbnail-container-${currentPage}`);
    if (thumbnailElement) {
      thumbnailElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // 更新可見範圍
    updateVisibleRange(currentPage);
  }, [currentPage]);

  return (
    <div
      className="w-48 h-full overflow-y-auto border-r border-gray-200 bg-gray-50 p-2"
      onScroll={handleScroll}
    >
      <h3 className="font-medium text-sm mb-2 text-center text-gray-700">頁面縮略圖</h3>
      
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">載入中...</span>
        </div>
      ) : error ? (
        <div className="text-red-500 text-sm text-center">{error}</div>
      ) : (
        <Document
          file={pdfUrl}
          loading={
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm text-gray-600">載入中...</span>
            </div>
          }
          onLoadError={(error) => {
            console.error('縮略圖加載失敗:', error);
            setError('縮略圖加載失敗');
          }}
        >
          {pages
            .filter((page) => page >= visiblePages.start && page <= visiblePages.end)
            .map((pageNumber) => (
              <div id={`thumbnail-container-${pageNumber}`} key={`container-${pageNumber}`}>
                {renderThumbnail(pageNumber)}
              </div>
            ))}
          
          {pages.length < numPages && (
            <div
              className="text-center py-2 text-sm text-blue-500 cursor-pointer hover:underline"
              onClick={loadMorePages}
            >
              載入更多頁面...
            </div>
          )}
        </Document>
      )}
      
      <style>{`
        .thumbnail-container {
          display: flex;
          justify-content: center;
          background-color: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .react-pdf__Page__canvas {
          width: 100% !important;
          height: auto !important;
        }
      `}</style>
    </div>
  );
};

export default PDFThumbnailSidebar; 