import React, { useEffect, useState } from 'react';
import PDFViewer from './PDFViewer';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUuid: string;
  sentenceUuid?: string;
  initialPage?: number;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  fileUuid,
  sentenceUuid,
  initialPage = 1,
}) => {
  const [fileName, setFileName] = useState<string>('');
  
  // 獲取文件名稱
  useEffect(() => {
    if (isOpen && fileUuid) {
      // 從API獲取文件詳情
      fetch(`/api/files/${fileUuid}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('無法獲取文件信息');
          }
          return response.json();
        })
        .then(data => {
          setFileName(data.original_name || '文件預覽');
        })
        .catch(err => {
          console.error('獲取文件信息失敗:', err);
          setFileName('文件預覽');
        });
    }
  }, [isOpen, fileUuid]);
  
  // 處理按ESC鍵關閉模態框
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);
  
  // 如果模態框未開啟，不渲染任何內容
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div role="dialog" aria-modal="true" className="relative bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col max-w-7xl">
        {/* 模態框標題 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800">
            {fileName}
          </h3>
          <button
            onClick={onClose}
            className="p-1 ml-auto bg-transparent border-0 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* PDF 預覽器 */}
        <div className="flex-1 overflow-hidden">
          <PDFViewer
            fileUuid={fileUuid}
            highlightSentenceUuid={sentenceUuid}
            initialPage={initialPage}
            onClose={onClose}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal; 