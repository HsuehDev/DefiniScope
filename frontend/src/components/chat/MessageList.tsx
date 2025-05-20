import React from 'react';

interface Message {
  message_uuid: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  references?: any[];
}

interface MessageListProps {
  messages: Message[];
  onMessageClick: (messageUuid: string) => void;
  selectedMessageUuid: string | null;
}

/**
 * 聊天消息列表組件
 * 顯示用戶和系統的消息，支持點擊查看參考信息
 */
const MessageList: React.FC<MessageListProps> = ({ messages, onMessageClick, selectedMessageUuid }) => {
  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          還沒有任何消息，開始您的對話吧！
        </div>
      ) : (
        messages.map((message) => (
          <div 
            key={message.message_uuid}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-50 ml-10' 
                : 'bg-white border mr-10 shadow-sm'
            } ${
              selectedMessageUuid === message.message_uuid
                ? 'ring-2 ring-blue-400'
                : ''
            }`}
            onClick={() => {
              // 只有系統回覆的消息才能點擊查看參考信息
              if (message.role === 'assistant' && message.references && message.references.length > 0) {
                onMessageClick(message.message_uuid);
              }
            }}
          >
            <div className="flex items-center mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                message.role === 'user' ? 'bg-blue-500' : 'bg-green-500'
              }`}>
                {message.role === 'user' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="font-medium text-gray-900">
                {message.role === 'user' ? '您' : '文件助手'}
              </span>
              <span className="ml-2 text-xs text-gray-500">
                {new Date(message.created_at).toLocaleString()}
              </span>
            </div>
            
            <div className="pl-10 whitespace-pre-wrap">{message.content}</div>
            
            {/* 顯示引用標記（僅對系統回覆） */}
            {message.role === 'assistant' && message.references && message.references.length > 0 && (
              <div 
                className="mt-2 pl-10 flex items-center text-xs text-blue-600 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessageClick(message.message_uuid);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {message.references.length} 個參考引用
                {selectedMessageUuid === message.message_uuid && (
                  <span className="ml-1 text-gray-500">（點擊查看）</span>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default MessageList; 