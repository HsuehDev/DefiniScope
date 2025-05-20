import React, { useEffect, useRef, useState } from 'react';
import { ChatContainerProps, Reference } from './types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ReferenceDisplay } from './ReferenceDisplay';

export const ChatContainer: React.FC<ChatContainerProps> = ({
  conversation,
  isProcessing,
  onSendMessage,
  onViewReference,
  processingProgress,
  processingStep,
  referencedSentences,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // 處理消息容器滾動
  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setShowScrollButton(!isAtBottom && (conversation?.messages?.length ?? 0) > 2);
    
    if (isAtBottom) {
      setHasNewMessage(false);
    }
  };

  // 滾動到最底部
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      setHasNewMessage(false);
    }
  };

  // 當消息更新時，檢查是否需要滾動
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (isAtBottom) {
      scrollToBottom();
    } else if ((conversation?.messages?.length ?? 0) > 0) {
      setHasNewMessage(true);
    }
  }, [conversation?.messages]);

  // 當處理完成後自動滾動到底部
  useEffect(() => {
    if (!isProcessing && (conversation?.messages?.length ?? 0) > 0) {
      scrollToBottom();
    }
  }, [isProcessing, conversation?.messages?.length]);

  // 組件掛載後初始滾動到底部
  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg shadow-md">
      {/* 聊天標題 */}
      <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-800">
          {conversation?.title || '新對話'}
        </h2>
      </div>

      {/* 消息列表 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleMessagesScroll}
      >
        {!conversation?.messages?.length ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            開始一個新的對話吧！
          </div>
        ) : (
          <React.Fragment>
            {conversation.messages.map((message) => (
              <ChatMessage
                key={message.message_uuid}
                message={message}
                onViewReference={onViewReference}
              />
            ))}
          </React.Fragment>
        )}
        
        {/* 處理進度顯示 */}
        {isProcessing && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 animate-pulse">
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-gray-700">處理中...</span>
              {processingProgress !== undefined && (
                <span className="text-sm text-blue-600">{processingProgress}%</span>
              )}
            </div>
            
            {processingProgress !== undefined && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
            )}
            
            {processingStep && (
              <div className="text-sm text-gray-600 mb-2">{processingStep}</div>
            )}

            {/* 正在參考的句子 */}
            {referencedSentences && referencedSentences.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2">正在參考的句子：</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {referencedSentences.map((reference) => (
                    <ReferenceDisplay
                      key={reference.sentence_uuid}
                      reference={reference}
                      onClick={() => onViewReference(reference)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* 用於滾動的參考元素 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 滾動到底部按鈕 */}
      {showScrollButton && (
        <div className="absolute bottom-24 right-6">
          <button
            className={`
              p-3 rounded-full bg-blue-600 text-white shadow-lg
              hover:bg-blue-700 transition-all
              ${hasNewMessage ? 'animate-bounce' : ''}
            `}
            onClick={() => scrollToBottom()}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {hasNewMessage && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3"></span>
            )}
          </button>
        </div>
      )}

      {/* 輸入框 */}
      <ChatInput
        onSendMessage={onSendMessage}
        isProcessing={isProcessing}
        placeholder="請輸入您的問題..."
      />
    </div>
  );
}; 