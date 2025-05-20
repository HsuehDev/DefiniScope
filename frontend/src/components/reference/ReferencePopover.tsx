import React from 'react';
import { Reference } from '../../types/reference';

interface ReferencePopoverProps {
  reference: Reference | null;
  position: { x: number; y: number } | null;
  isVisible: boolean;
}

/**
 * 引用懸停預覽組件
 * 在用戶將鼠標懸停在引用標籤上時顯示引用的句子內容預覽
 */
const ReferencePopover: React.FC<ReferencePopoverProps> = ({ 
  reference, 
  position, 
  isVisible 
}) => {
  if (!reference || !position || !isVisible) return null;

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

  // 獲取定義類型的標籤顏色
  const getTagColor = () => {
    switch (reference.defining_type) {
      case 'cd':
        return 'bg-blue-100 text-blue-800';
      case 'od':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div 
      className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 p-3 max-w-md"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 text-gray-600" 
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
          <span className="font-medium text-sm">{reference.original_name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${getTagColor()}`}>
          {getDefiningTypeText()}
        </span>
      </div>
      
      <div className="text-sm border-l-2 border-gray-300 pl-3 italic bg-gray-50 p-2 rounded">
        "{reference.sentence}"
      </div>
      
      <div className="mt-2 text-xs text-gray-600 flex justify-between">
        <span>第 {reference.page} 頁</span>
        <span className="text-blue-600">點擊查看原文上下文</span>
      </div>
      
      <div className="absolute bottom-0 left-1/2 transform translate-x-[-50%] translate-y-[95%]">
        <div className="w-3 h-3 bg-white rotate-45 transform border-b border-r border-gray-200"></div>
      </div>
    </div>
  );
};

export default ReferencePopover; 