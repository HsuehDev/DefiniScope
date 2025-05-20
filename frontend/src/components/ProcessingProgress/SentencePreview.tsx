import React from 'react';
import { SentenceData, ReferencedSentence, DefiningType } from '../../types/progress';

interface SentencePreviewProps {
  sentence: SentenceData | ReferencedSentence;
  onClick?: () => void;
  className?: string;
}

export const SentencePreview: React.FC<SentencePreviewProps> = ({
  sentence,
  onClick,
  className = ''
}) => {
  // 根據句子類型獲取標籤文本
  const getTypeBadgeText = (type?: DefiningType) => {
    switch (type) {
      case 'cd':
        return '概念型定義';
      case 'od':
        return '操作型定義';
      default:
        return '非定義句';
    }
  };

  // 根據句子類型獲取標籤顏色
  const getTypeBadgeClass = (type?: DefiningType) => {
    switch (type) {
      case 'cd':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'od':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // 根據句子類型獲取卡片左側邊框顏色
  const getBorderClass = (type?: DefiningType) => {
    switch (type) {
      case 'cd':
        return 'border-l-blue-500';
      case 'od':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-300';
    }
  };

  // 檢查是否有原文件名（只有ReferencedSentence才會有）
  const hasSourceFile = 'original_name' in sentence;

  // 檢查是否有reason（只有SentenceData才會有）
  const hasReason = 'reason' in sentence && sentence.reason;

  return (
    <div 
      data-testid="sentence-card"
      className={`relative bg-white border rounded-md shadow-sm p-3 mb-3 border-l-4 ${getBorderClass(sentence.defining_type)} hover:shadow-md transition-shadow duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div data-testid="sentence-text" className="text-sm text-gray-800 mb-1.5">
        {sentence.sentence.length > 150 
          ? `${sentence.sentence.substring(0, 150)}...` 
          : sentence.sentence}
      </div>
      
      <div className="flex flex-wrap items-center text-xs">
        <span data-testid="sentence-page" className="text-gray-600 mr-2">
          頁碼: {sentence.page}
        </span>
        
        {hasSourceFile && (
          <span data-testid="sentence-source" className="text-gray-600 mr-2">
            來源: {(sentence as ReferencedSentence).original_name}
          </span>
        )}
        
        {'relevance_score' in sentence && sentence.relevance_score && (
          <span data-testid="sentence-relevance" className="text-gray-600 mr-2">
            相關度: {(sentence.relevance_score * 100).toFixed(0)}%
          </span>
        )}
        
        {sentence.defining_type && (
          <span data-testid="sentence-type-badge" className={`px-2 py-0.5 rounded-full text-xs border ${getTypeBadgeClass(sentence.defining_type)}`}>
            {getTypeBadgeText(sentence.defining_type)}
          </span>
        )}
      </div>
      
      {hasReason && (
        <div data-testid="sentence-reason" className="mt-1.5 text-xs text-gray-600 border-t border-gray-100 pt-1.5">
          <span className="font-medium">分類理由:</span> {(sentence as SentenceData).reason}
        </div>
      )}
    </div>
  );
}; 