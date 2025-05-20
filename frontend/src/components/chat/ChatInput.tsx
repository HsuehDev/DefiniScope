import React, { useState, useRef, useEffect } from 'react';
import { ChatInputProps } from './types';

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isProcessing,
  placeholder = '請先在這裡輸入問題文字...',
}) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false); // 追踪輸入法組合狀態
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自動調整輸入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  // 處理輸入法組合開始
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  // 處理輸入法組合結束
  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 支持 Shift+Enter 換行，但只在非輸入法組合狀態下處理Enter發送
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isProcessing) {
      onSendMessage(trimmedMessage);
      setMessage('');
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4 rounded-b-lg shadow-inner">
      <div className="flex items-end space-x-2">
        <div className="flex-grow relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            disabled={isProcessing}
            className={`w-full p-3 border rounded-lg resize-none overflow-hidden transition-all
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${isProcessing ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                      ${isComposing ? 'border-yellow-300' : ''}`}
            rows={1}
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            按 Enter 鍵發送，Shift+Enter 換行
            {isComposing && <span className="ml-1 text-yellow-600">● 輸入中</span>}
          </div>
        </div>
        <button
          onClick={handleSendMessage}
          disabled={!message.trim() || isProcessing}
          className={`px-4 py-3 rounded-lg transition-colors focus:outline-none
                    ${
                      !message.trim() || isProcessing
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
        >
          {isProcessing ? '處理中...' : '發送'}
        </button>
      </div>
    </div>
  );
}; 