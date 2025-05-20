import React from 'react';
import { Message } from '../../types/reference';
import ReferenceTag from '../reference/ReferenceTag';
import ReferencePopover from '../reference/ReferencePopover';
import ReferenceContextViewer from '../reference/ReferenceContextViewer';
import PDFPreviewModal from '../reference/PDFPreviewModal';
import { useReferenceManager } from '../../hooks/useReferenceManager';

interface ChatMessageProps {
  message: Message;
}

/**
 * 聊天消息組件
 * 顯示用戶查詢或系統回答，並集成引用標籤和引用管理功能
 */
const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
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

  // 判斷是否為用戶消息
  const isUserMessage = message.role === 'user';

  // 處理消息內容，將引用標記替換為引用組件
  const renderMessageContent = () => {
    // 如果是用戶消息或沒有引用，直接顯示內容
    if (isUserMessage || !message.references || message.references.length === 0) {
      return <p className="whitespace-pre-wrap">{message.content}</p>;
    }

    // 處理系統回答中的引用
    return (
      <div>
        <p className="whitespace-pre-wrap">{message.content}</p>
        
        {/* 顯示引用標籤 */}
        <div className="mt-2 flex flex-wrap">
          <div className="text-sm text-gray-600 mr-1 mt-1">引用來源：</div>
          {message.references.map((reference, index) => (
            <ReferenceTag 
              key={`${reference.sentence_uuid}-${index}`}
              reference={reference}
              onClick={handleReferenceClick}
              onHover={(ref) => {
                const event = window.event as MouseEvent;
                handleReferenceHover(ref, {
                  clientX: event.clientX,
                  clientY: event.clientY
                } as React.MouseEvent);
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`py-4 ${isUserMessage ? 'bg-gray-50' : 'bg-white'}`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex space-x-3">
          {/* 頭像 */}
          <div className="flex-shrink-0">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center
                ${isUserMessage ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}
            >
              {isUserMessage ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
              )}
            </div>
          </div>
          
          {/* 消息內容 */}
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-gray-700 mb-1">
              {isUserMessage ? '你' : '助理'}
            </div>
            <div className="text-sm text-gray-800">
              {renderMessageContent()}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {new Date(message.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
      
      {/* 引用懸停預覽 */}
      <ReferencePopover 
        reference={hoveredReference}
        position={popoverPosition}
        isVisible={showPopover}
      />
      
      {/* 引用上下文查看器 */}
      {selectedReference && (
        <ReferenceContextViewer 
          reference={selectedReference}
          isOpen={showContextViewer}
          onClose={closeContextViewer}
        />
      )}
      
      {/* PDF預覽模態框 */}
      <PDFPreviewModal 
        reference={pdfReference}
        isOpen={showPdfPreview}
        onClose={closePdfPreview}
      />
    </div>
  );
};

export default ChatMessage; 