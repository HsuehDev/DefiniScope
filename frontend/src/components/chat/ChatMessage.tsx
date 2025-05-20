import React, { useState } from 'react';
import { Message } from '../../types/reference';
import ReferenceTag from '../reference/ReferenceTag';
import ReferencePopover from '../reference/ReferencePopover';
import ReferenceContextViewer from '../reference/ReferenceContextViewer';
import PDFPreviewModal from '../reference/PDFPreviewModal';
import { useReferenceManager } from '../../hooks/useReferenceManager';

interface Citation {
  id: string;
  text: string;
  source: string;
  page: string;
}

interface ChatMessageProps {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  citations?: Citation[];
}

/**
 * 聊天消息組件
 * 顯示用戶查詢或系統回答，並集成引用標籤和引用管理功能
 */
const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  content,
  sender,
  timestamp,
  citations = []
}) => {
  const {
    hoveredReference,
    popoverPosition,
    showPopover,
    handleReferenceHover,
    selectedReference,
    showContextViewer,
    handleReferenceClick,
    closeContextViewer,
    pdfReference,
    showPdfPreview,
    handleViewPdf,
    closePdfPreview
  } = useReferenceManager();

  const [showCitations, setShowCitations] = useState(false);

  const toggleCitations = () => {
    setShowCitations(!showCitations);
  };

  if (sender === 'user') {
    return (
      <div className="flex justify-end mb-5">
        <div className="max-w-2xl px-5 py-4 rounded-2xl shadow-tech bg-tech-700 text-white rounded-tr-sm">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
          <div className="flex justify-end items-center mt-2">
            <p className="text-xs text-tech-100">{timestamp}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-tech-700 flex items-center justify-center ml-3 shadow-tech">
          <span className="text-white text-xs font-semibold">您</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-5">
      <div className="w-8 h-8 rounded-full bg-tech-700 flex items-center justify-center mr-3 shadow-tech">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="max-w-2xl px-5 py-4 rounded-2xl shadow-tech bg-white text-tech-800 rounded-tl-sm border border-tech-500/30">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
        
        {citations.length > 0 && (
          <div className="mt-3 border-t border-tech-500/20 pt-3">
            <button 
              className="flex items-center text-tech-700 text-xs hover:text-tech-500 transition-colors duration-200"
              onClick={toggleCitations}
            >
              {citations.length} 個引用來源 ({showCitations ? '收起' : '展開'})
            </button>
            
            {showCitations && (
              <div className="mt-2 space-y-2">
                {citations.map((citation) => (
                  <div key={citation.id} className="p-2 bg-tech-100/50 rounded-lg text-xs citation-item">
                    <p className="text-tech-800 mb-1 truncate" title={citation.text}>{citation.text}</p>
                    <div className="flex justify-between items-center text-tech-700">
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {citation.source}
                      </span>
                      <span className="px-1.5 py-0.5 bg-tech-500/20 text-tech-800 rounded">P.{citation.page}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end items-center mt-2">
          <p className="text-xs text-tech-500">{timestamp}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 