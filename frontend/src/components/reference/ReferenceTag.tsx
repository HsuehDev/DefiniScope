import React, { useState } from 'react';
import { ReferenceTagProps } from '../../types/reference';

/**
 * 引用標籤組件
 * 顯示引用的來源文件、頁碼和定義類型
 * 支持點擊跳轉到PDF對應位置和懸停預覽
 */
const ReferenceTag: React.FC<ReferenceTagProps> = ({ reference, onClick, onHover }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // 根據定義類型顯示不同的標籤顏色
  const getTagColor = () => {
    switch (reference.defining_type) {
      case 'cd':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'od':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // 獲取定義類型的顯示文本
  const getDefiningTypeText = () => {
    switch (reference.defining_type) {
      case 'cd':
        return '概念型定義';
      case 'od':
        return '操作型定義';
      default:
        return '未分類';
    }
  };

  // 截取文件名，如果太長則顯示省略號
  const truncateFileName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    return `${name.substring(0, maxLength)}...`;
  };

  return (
    <div 
      className={`inline-flex items-center px-2 py-1 rounded-md border cursor-pointer 
                 transition-all duration-200 mx-1 my-1 text-xs 
                 ${getTagColor()} 
                 ${isHovered ? 'shadow-md transform scale-105' : ''}`}
      onClick={() => onClick(reference)}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover(reference);
      }}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`參考出處：${reference.original_name}，第 ${reference.page} 頁`}
      role="button"
      tabIndex={0}
    >
      <div className="flex flex-col">
        <div className="flex items-center space-x-1">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-3 w-3" 
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
          <span className="font-medium">{truncateFileName(reference.original_name)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs">第 {reference.page} 頁</span>
          <span className="ml-2 text-xxs px-1 rounded bg-opacity-50 bg-white">
            {getDefiningTypeText()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReferenceTag; 