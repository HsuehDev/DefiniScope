import React from 'react';
import { FileProcessingStatus } from '../../types/progress';

interface StageIndicatorProps {
  currentStep: string;
  status: FileProcessingStatus;
  current?: number;
  total?: number;
  className?: string;
}

export const StageIndicator: React.FC<StageIndicatorProps> = ({
  currentStep,
  status,
  current,
  total,
  className = ''
}) => {
  // 根據狀態確定文字顏色
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-700';
      case 'failed':
        return 'text-red-700';
      case 'processing':
        return 'text-blue-700';
      default:
        return 'text-gray-600';
    }
  };

  // 根據狀態確定圖標
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path 
              fillRule="evenodd" 
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
              clipRule="evenodd" 
            />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path 
              fillRule="evenodd" 
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
              clipRule="evenodd" 
            />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path 
              fillRule="evenodd" 
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" 
              clipRule="evenodd" 
            />
          </svg>
        );
    }
  };

  // 處理文本顯示
  const getStatusText = () => {
    if (status === 'pending') return '等待處理';
    if (status === 'completed') return '處理完成';
    if (status === 'failed') return '處理失敗';
    
    // 處理中狀態顯示當前步驟以及進度信息
    let text = currentStep;
    if (current !== undefined && total !== undefined) {
      text += ` (${current}/${total})`;
    }
    return text;
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div>{getStatusIcon()}</div>
      <div className={`font-medium ${getStatusColor()}`} data-testid="current-step">
        {getStatusText()}
      </div>
    </div>
  );
}; 