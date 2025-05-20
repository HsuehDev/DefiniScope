import React from 'react';
import { FileProcessingStatus } from '../../types/progress';

interface ProgressBarProps {
  progress: number;
  status: FileProcessingStatus;
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status,
  showPercentage = true,
  className = ''
}) => {
  // 確保進度值在0-100之間
  const safeProgress = Math.min(100, Math.max(0, progress));
  
  // 根據狀態確定顏色
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative pt-1">
        <div className="flex items-center justify-between">
          {showPercentage && (
            <div className="text-xs font-semibold inline-block text-blue-600 ml-auto">
              {Math.round(safeProgress)}%
            </div>
          )}
        </div>
        <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-gray-200">
          <div 
            style={{ width: `${safeProgress}%` }}
            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ease-in-out ${getStatusColor()}`}
          />
        </div>
      </div>
    </div>
  );
}; 