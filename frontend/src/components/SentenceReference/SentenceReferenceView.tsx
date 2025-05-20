import React, { useState } from 'react';
import { PDFPreviewModal } from '../PDFViewer';

interface SentenceReference {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: string;
}

interface SentenceReferenceViewProps {
  reference: SentenceReference;
}

const SentenceReferenceView: React.FC<SentenceReferenceViewProps> = ({ reference }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  
  const handleOpenPreview = () => {
    setIsPreviewOpen(true);
  };
  
  const handleClosePreview = () => {
    setIsPreviewOpen(false);
  };
  
  // 根據句子定義類型顯示不同樣式
  const getDefiningTypeLabel = () => {
    switch (reference.defining_type) {
      case 'cd':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">概念型定義</span>;
      case 'od':
        return <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">操作型定義</span>;
      default:
        return null;
    }
  };
  
  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50 hover:bg-gray-100 transition cursor-pointer" onClick={handleOpenPreview}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-gray-800 truncate">
          {reference.original_name}
        </h4>
        <div className="flex items-center">
          <span className="text-gray-500 text-sm mr-2">第 {reference.page} 頁</span>
          {getDefiningTypeLabel()}
        </div>
      </div>
      
      <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700">
        {reference.sentence}
      </blockquote>
      
      <div className="flex justify-end mt-2">
        <button 
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenPreview();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          在原文中查看
        </button>
      </div>
      
      {/* PDF 預覽模態框 */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        fileUuid={reference.file_uuid}
        sentenceUuid={reference.sentence_uuid}
        initialPage={reference.page}
      />
    </div>
  );
};

export default SentenceReferenceView; 