import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useNavigate, useLocation } from 'react-router-dom';
import PDFThumbnailSidebar from './PDFThumbnailSidebar';
import PDFToolbar from './PDFToolbar';
import PDFHighlighter from './PDFHighlighter';
import { debounce } from 'lodash';
import { useSwipeable } from 'react-swipeable';

// 設定PDF.js worker路徑
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  fileUuid: string;
  highlightSentenceUuid?: string;
  initialPage?: number;
  onClose?: () => void;
  isModal?: boolean;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUuid,
  highlightSentenceUuid,
  initialPage = 1,
  onClose,
  isModal = false,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [highlightInfo, setHighlightInfo] = useState<{
    page: number;
    text: string;
    rect?: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const documentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // 處理URL參數
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const page = searchParams.get('page');
    const highlight = searchParams.get('highlight');
    
    if (page) {
      setPageNumber(parseInt(page, 10));
    }
    
    if (highlight) {
      fetchSentenceInfo(highlight);
    }
  }, [location, fileUuid]);
  
  // 獲取PDF預覽URL
  useEffect(() => {
    setLoading(true);
    fetch(`/api/files/${fileUuid}/preview`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('無法載入PDF文件');
        }
        // 生成Blob URL或直接使用返回的URL
        if (response.headers.get('content-type') === 'application/pdf') {
          return response.blob().then(blob => URL.createObjectURL(blob));
        } else {
          return response.json().then(data => data.preview_url);
        }
      })
      .then(url => {
        setPdfUrl(url);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [fileUuid]);
  
  // 獲取句子信息
  const fetchSentenceInfo = async (sentenceUuid: string) => {
    try {
      const response = await fetch(`/api/files/${fileUuid}/sentences/${sentenceUuid}/view`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('無法獲取句子信息');
      }
      
      const data = await response.json();
      setHighlightInfo({
        page: data.page,
        text: data.sentence,
        // 這裡的rect將在PDF載入後通過文字搜索獲取
      });
      
      // 跳轉到句子所在頁面
      setPageNumber(data.page);
    } catch (err) {
      console.error('獲取句子信息失敗:', err);
    }
  };
  
  // 文檔加載完成的處理函數
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    
    // 初始化頁面引用數組
    pageRefs.current = Array(numPages).fill(null);
    
    // 如果有需要高亮的句子，先跳轉到對應頁面
    if (highlightInfo) {
      setPageNumber(highlightInfo.page);
    }
  };
  
  // 處理頁面變化
  const changePage = (offset: number) => {
    const newPage = pageNumber + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      // 更新URL參數，但不重新載入頁面
      updateUrlParams(newPage, highlightSentenceUuid);
    }
  };
  
  // 更新URL參數
  const updateUrlParams = (page: number, highlight?: string) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('page', page.toString());
    if (highlight) {
      searchParams.set('highlight', highlight);
    }
    
    // 使用replace而不是push，避免每次翻頁都創建新的歷史記錄
    navigate(`?${searchParams.toString()}`, { replace: true });
  };
  
  // 頁面渲染完成的處理函數
  const onPageRenderSuccess = (page: number) => {
    // 如果需要高亮的句子在當前頁，查找並高亮文本
    if (highlightInfo && highlightInfo.page === page) {
      setTimeout(() => {
        // 延遲執行以確保頁面文本層已完全渲染
        findAndHighlightText(highlightInfo.text, page);
      }, 500);
    }
  };
  
  // 查找並高亮文本
  const findAndHighlightText = (text: string, page: number) => {
    const pageContainer = pageRefs.current[page - 1];
    if (!pageContainer) return;
    
    const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) return;
    
    // 首先移除所有現有的高亮
    const existingHighlights = document.querySelectorAll('.pdf-text-highlight');
    existingHighlights.forEach(el => el.remove());
    
    // 查找包含指定文本的所有文本節點
    const textElements = textLayer.querySelectorAll('span');
    let found = false;
    let fullText = '';
    
    // 收集所有文本以進行全文搜索
    textElements.forEach(span => {
      fullText += span.textContent + ' ';
    });
    
    // 如果全文中包含目標文本
    if (fullText.includes(text)) {
      // 創建一個高亮元素
      const highlight = document.createElement('div');
      highlight.className = 'pdf-text-highlight';
      highlight.style.position = 'absolute';
      highlight.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      highlight.style.pointerEvents = 'none';
      highlight.style.zIndex = '1';
      
      // 尋找最佳匹配的元素組並創建高亮
      let match = findBestTextMatch(textElements, text);
      if (match) {
        const { elements, rect } = match;
        
        // 設置高亮元素的位置和尺寸
        highlight.style.left = `${rect.x}px`;
        highlight.style.top = `${rect.y}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        
        // 將高亮元素添加到頁面容器中
        pageContainer.appendChild(highlight);
        
        // 更新高亮信息
        setHighlightInfo({
          ...highlightInfo!,
          rect: rect
        });
        
        // 滾動到高亮位置
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        found = true;
      }
    }
    
    if (!found) {
      console.warn('無法在頁面中找到指定文本:', text);
    }
  };
  
  // 查找最佳文本匹配
  const findBestTextMatch = (
    textElements: NodeListOf<Element>,
    searchText: string
  ): { elements: Element[], rect: { x: number; y: number; width: number; height: number } } | null => {
    // 簡化的文本匹配算法
    // 實際應用中，這需要更複雜的實現來處理PDF文本分段問題
    
    const normalizedSearchText = searchText.trim().toLowerCase();
    let currentMatch = '';
    let matchElements: Element[] = [];
    
    for (let i = 0; i < textElements.length; i++) {
      const element = textElements[i];
      const text = element.textContent || '';
      
      currentMatch += text + ' ';
      matchElements.push(element);
      
      if (currentMatch.toLowerCase().includes(normalizedSearchText)) {
        // 找到匹配，計算邊界框
        const rects = matchElements.map(el => el.getBoundingClientRect());
        
        // 取得所有匹配元素的最小邊界框
        const minX = Math.min(...rects.map(r => r.left));
        const minY = Math.min(...rects.map(r => r.top));
        const maxX = Math.max(...rects.map(r => r.right));
        const maxY = Math.max(...rects.map(r => r.bottom));
        
        // 相對於頁面容器的位置
        const container = pageRefs.current[pageNumber - 1];
        const containerRect = container?.getBoundingClientRect();
        
        if (containerRect) {
          return {
            elements: matchElements,
            rect: {
              x: minX - containerRect.left,
              y: minY - containerRect.top,
              width: maxX - minX,
              height: maxY - minY
            }
          };
        }
        
        break;
      }
      
      // 如果累積的文本超過搜索文本的三倍長度，則重新開始匹配
      if (currentMatch.length > normalizedSearchText.length * 3) {
        currentMatch = text + ' ';
        matchElements = [element];
      }
    }
    
    return null;
  };
  
  // 縮放處理函數
  const handleZoom = (newScale: number) => {
    setScale(newScale);
  };
  
  // 旋轉處理函數
  const handleRotate = () => {
    setRotation((prevRotation) => (prevRotation + 90) % 360);
  };
  
  // 切換縮略圖側邊欄
  const toggleThumbnails = () => {
    setShowThumbnails(!showThumbnails);
  };
  
  // 處理滑動手勢
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => changePage(1), // 向左滑動，下一頁
    onSwipedRight: () => changePage(-1), // 向右滑動，上一頁
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });
  
  // 處理鍵盤事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在輸入框中觸發快捷鍵
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowRight':
          changePage(1);
          break;
        case 'ArrowLeft':
          changePage(-1);
          break;
        case '+':
          handleZoom(scale + 0.1);
          break;
        case '-':
          handleZoom(Math.max(0.5, scale - 0.1));
          break;
        case 'r':
          handleRotate();
          break;
        case 'Escape':
          if (isModal && onClose) {
            onClose();
          }
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scale, pageNumber, numPages, isModal, onClose]);
  
  // 處理窗口大小變化
  useEffect(() => {
    const handleResize = debounce(() => {
      // 重新計算高亮位置
      if (highlightInfo && highlightInfo.page === pageNumber) {
        findAndHighlightText(highlightInfo.text, pageNumber);
      }
    }, 150);
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel();
    };
  }, [highlightInfo, pageNumber]);
  
  return (
    <div className="flex flex-col h-full">
      <PDFToolbar
        pageNumber={pageNumber}
        numPages={numPages}
        scale={scale}
        onZoomIn={() => handleZoom(scale + 0.1)}
        onZoomOut={() => handleZoom(Math.max(0.5, scale - 0.1))}
        onRotate={handleRotate}
        onChangePage={(page) => {
          setPageNumber(page);
          updateUrlParams(page, highlightSentenceUuid);
        }}
        onToggleThumbnails={toggleThumbnails}
        onClose={isModal ? onClose : undefined}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {showThumbnails && (
          <PDFThumbnailSidebar
            fileUuid={fileUuid}
            numPages={numPages}
            currentPage={pageNumber}
            pdfUrl={pdfUrl}
            onPageSelect={(page) => {
              setPageNumber(page);
              updateUrlParams(page, highlightSentenceUuid);
            }}
          />
        )}
        
        <div
          ref={documentRef}
          className="flex-1 overflow-auto"
          {...swipeHandlers}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-700">載入中...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-500">{error}</div>
            </div>
          ) : (
            <div className="min-h-full flex justify-center p-4">
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => setError('載入PDF失敗: ' + error.message)}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-700">載入PDF中...</span>
                  </div>
                }
              >
                <Page
                  key={`page_${pageNumber}`}
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  inputRef={(ref) => {
                    if (ref) {
                      pageRefs.current[pageNumber - 1] = ref;
                    }
                  }}
                  onRenderSuccess={() => onPageRenderSuccess(pageNumber)}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-lg"
                />
              </Document>
            </div>
          )}
        </div>
      </div>

      {/* 顯示頁碼 */}
      <div className="flex justify-center items-center py-2 bg-gray-100">
        <button
          onClick={() => changePage(-1)}
          disabled={pageNumber <= 1}
          className="px-3 py-1 mr-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          上一頁
        </button>
        <span className="text-gray-700">
          {pageNumber} / {numPages}
        </span>
        <button
          onClick={() => changePage(1)}
          disabled={pageNumber >= numPages}
          className="px-3 py-1 ml-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          下一頁
        </button>
      </div>
      
      {/* 全局樣式 */}
      <style>{`
        .pdf-text-highlight {
          position: absolute;
          background-color: rgba(255, 255, 100, 0.4);
          border: 2px solid rgba(255, 200, 0, 0.8);
          border-radius: 3px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          animation: pulse 2s infinite;
          pointer-events: none;
          z-index: 1;
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 200, 0, 0.6); }
          70% { box-shadow: 0 0 0 10px rgba(255, 200, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 200, 0, 0); }
        }
        
        .react-pdf__Page {
          margin: 0 auto;
          position: relative;
          overflow: visible;
          background-color: white;
        }
        
        .react-pdf__Page__textContent {
          z-index: 0;
        }
      `}</style>
    </div>
  );
};

export default PDFViewer; 