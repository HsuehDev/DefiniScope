import React from 'react';
import { ChatMessageProps, Reference } from './types';
import { ReferenceDisplay } from './ReferenceDisplay';

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onViewReference,
}) => {
  const { role, content, references = [], created_at } = message;
  
  // 格式化時間
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  
  // 處理消息內容中的換行
  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };
  
  return (
    <div className={`flex w-full mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-[80%] md:max-w-[70%] lg:max-w-[60%] 
        rounded-lg px-4 py-3 shadow-sm
        ${role === 'user' 
          ? 'bg-blue-600 text-white rounded-tr-none' 
          : 'bg-white border border-gray-200 rounded-tl-none'}
      `}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium text-sm">
            {role === 'user' ? '您' : '智能助手'}
          </span>
          <span className={`text-xs ${role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
            {formatTime(created_at)}
          </span>
        </div>
        
        <div className={`text-sm ${role === 'user' ? 'text-white' : 'text-gray-800'}`}>
          {formatContent(content)}
        </div>
        
        {/* 引用展示區 */}
        {role === 'assistant' && references && references.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">引用來源：</div>
            <div className="space-y-2">
              {references.map((reference) => (
                <ReferenceDisplay
                  key={reference.sentence_uuid}
                  reference={reference}
                  onClick={() => onViewReference && onViewReference(reference)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 