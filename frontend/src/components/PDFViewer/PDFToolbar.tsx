import React, { useState } from 'react';

interface PDFToolbarProps {
  pageNumber: number;
  numPages: number;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onChangePage: (page: number) => void;
  onToggleThumbnails: () => void;
  onClose?: () => void;
}

const PDFToolbar: React.FC<PDFToolbarProps> = ({
  pageNumber,
  numPages,
  scale,
  onZoomIn,
  onZoomOut,
  onRotate,
  onChangePage,
  onToggleThumbnails,
  onClose,
}) => {
  const [inputPage, setInputPage] = useState<string>(pageNumber.toString());

  // 處理頁碼輸入變化
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  // 處理頁碼跳轉
  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(inputPage, 10);
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      onChangePage(page);
    } else {
      // 如果輸入無效，重置為當前頁
      setInputPage(pageNumber.toString());
    }
  };

  // 當pageNumber變化時，更新輸入框的值
  React.useEffect(() => {
    setInputPage(pageNumber.toString());
  }, [pageNumber]);

  return (
    <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-200">
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleThumbnails}
          className="p-1 bg-white rounded border border-gray-300 hover:bg-gray-50"
          title="切換縮略圖側邊欄"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="flex items-center border rounded overflow-hidden">
          <button
            onClick={onZoomOut}
            className="p-1 bg-white hover:bg-gray-50"
            title="縮小"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <span className="px-2 py-1 text-sm">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={onZoomIn}
            className="p-1 bg-white hover:bg-gray-50"
            title="放大"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        <button
          onClick={onRotate}
          className="p-1 bg-white rounded border border-gray-300 hover:bg-gray-50"
          title="旋轉 90 度"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      <form onSubmit={handlePageSubmit} className="flex items-center">
        <label className="text-sm text-gray-600 mr-2">
          頁碼:
        </label>
        <input
          type="text"
          value={inputPage}
          onChange={handlePageInputChange}
          className="w-12 text-center border border-gray-300 rounded px-2 py-1 text-sm"
          aria-label="頁碼"
        />
        <span className="mx-2 text-sm text-gray-600">
          / {numPages}
        </span>
        <button
          type="submit"
          className="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          跳轉
        </button>
      </form>
      
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 bg-white rounded border border-gray-300 hover:bg-gray-50 ml-2"
          title="關閉"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default PDFToolbar; 