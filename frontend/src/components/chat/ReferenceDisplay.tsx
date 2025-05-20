import React from 'react';
import { ReferenceDisplayProps } from './types';

export const ReferenceDisplay: React.FC<ReferenceDisplayProps> = ({
  reference,
  onClick,
}) => {
  const { original_name, page, defining_type, sentence } = reference;
  
  // 根據定義類型設置不同的顏色標示
  const typeColors = {
    cd: 'bg-blue-100 border-blue-300 text-blue-700',
    od: 'bg-green-100 border-green-300 text-green-700',
    none: 'bg-gray-100 border-gray-300 text-gray-700',
  };
  
  const typeLabels = {
    cd: '概念型定義',
    od: '操作型定義',
    none: '一般句子',
  };
  
  return (
    <div 
      className={`
        p-3 my-2 rounded-lg border ${typeColors[defining_type]}
        transition-all hover:shadow-md cursor-pointer
      `}
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium">{original_name}</span>
          <span className="ml-2 text-sm opacity-70">第 {page} 頁</span>
        </div>
        <span className={`
          px-2 py-1 text-xs rounded-full border 
          ${typeColors[defining_type]}
        `}>
          {typeLabels[defining_type]}
        </span>
      </div>
      
      <p className="text-sm mt-1 line-clamp-3">{sentence}</p>
      
      <div className="mt-2 text-xs flex justify-end">
        <span className="inline-flex items-center opacity-70 hover:opacity-100">
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          點擊查看完整內容
        </span>
      </div>
    </div>
  );
}; 