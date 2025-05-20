import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface ChatInputProps {
  conversationId?: string;
  onMessageSent: () => void;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

/**
 * 聊天輸入組件
 * 用於發送查詢到後端
 */
const ChatInput: React.FC<ChatInputProps> = ({ conversationId, onMessageSent }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自動調整輸入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(120, textareaRef.current.scrollHeight)}px`;
    }
  }, [message]);

  // 發送消息
  const sendMessage = async () => {
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/chat/query`,
        {
          query: message,
          conversation_uuid: conversationId
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      if (response.status === 202) {
        setMessage('');
        onMessageSent();
      }
    } catch (error) {
      console.error('發送消息失敗:', error);
      alert('發送失敗，請稍後再試');
    } finally {
      setIsSending(false);
    }
  };

  // 處理按鍵事件（Enter發送，Shift+Enter換行）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="輸入您的問題..."
        className="w-full border border-gray-300 rounded-lg py-3 px-4 pr-12 resize-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        rows={1}
        disabled={isSending}
      />
      <button
        onClick={sendMessage}
        disabled={!message.trim() || isSending}
        className={`absolute right-3 bottom-3 p-1 rounded-full ${
          !message.trim() || isSending
            ? 'text-gray-400'
            : 'text-blue-500 hover:bg-blue-50'
        }`}
      >
        {isSending ? (
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
      <div className="text-xs text-gray-500 mt-2">
        按 Enter 發送，Shift + Enter 換行
      </div>
    </div>
  );
};

export default ChatInput; 