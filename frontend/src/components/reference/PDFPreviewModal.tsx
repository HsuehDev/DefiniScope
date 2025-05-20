import React from 'react';
import PDFViewer from './PDFViewer';
import { Reference } from '../../types/reference';

interface PDFPreviewModalProps {
  reference: Reference | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PDF預覽模態框組件
 * 用於在不離開當前頁面的情況下顯示PDF和高亮句子
 */
const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  reference,
  isOpen,
  onClose
}) => {
  if (!isOpen || !reference) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div role="dialog" aria-modal="true" className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 text-gray-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
              />
            </svg>
            <h3 className="text-lg font-medium truncate max-w-md">
              {reference.original_name}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {reference.defining_type === 'cd' ? '概念型定義' : '操作型定義'}
            </span>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="關閉"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
        </div>
        
        {/* PDF顯示區域 */}
        <div className="flex-1 overflow-hidden">
          <PDFViewer 
            file_uuid={reference.file_uuid} 
            page={reference.page} 
            sentence_uuid={reference.sentence_uuid} 
          />
        </div>
        
        {/* 底部信息 */}
        <div className="p-2 bg-gray-50 border-t flex items-center justify-between text-sm text-gray-600">
          <span>第 {reference.page} 頁</span>
          <span className="italic">{reference.sentence}</span>
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal; 