import React from 'react';
import { formatFileSize, formatTime, formatSpeed } from '../../utils/uploadUtils';
import { UploadStatus } from '../../types/upload';

interface UploadProgressBarProps {
  progress: number;
  status: UploadStatus;
  fileSize: number;
  uploadedBytes: number;
  speed: number;
  remainingTime: number;
  timeoutWarning: boolean;
  errorMessage?: string;
}

/**
 * 上傳進度條組件
 * 顯示上傳進度、速度和剩餘時間
 */
export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  status,
  fileSize,
  uploadedBytes,
  speed,
  remainingTime,
  timeoutWarning,
  errorMessage
}) => {
  // 根據上傳狀態決定進度條的顏色
  const getProgressBarColor = () => {
    switch (status) {
      case UploadStatus.SUCCESS:
        return 'bg-green-500';
      case UploadStatus.UPLOADING:
        return timeoutWarning ? 'bg-yellow-500' : 'bg-blue-500';
      case UploadStatus.ERROR:
      case UploadStatus.TIMEOUT:
        return 'bg-red-500';
      case UploadStatus.PAUSED:
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  // 獲取狀態文本
  const getStatusText = () => {
    switch (status) {
      case UploadStatus.IDLE:
        return '準備上傳';
      case UploadStatus.PREPARING:
        return '準備中...';
      case UploadStatus.UPLOADING:
        return timeoutWarning 
          ? `上傳中 (警告: 接近超時)` 
          : '上傳中';
      case UploadStatus.PAUSED:
        return '已暫停';
      case UploadStatus.SUCCESS:
        return '上傳完成';
      case UploadStatus.ERROR:
        return `錯誤: ${errorMessage || '上傳失敗'}`;
      case UploadStatus.TIMEOUT:
        return '上傳超時 (10分鐘)';
      default:
        return '';
    }
  };

  // 使用 upload-progress 作為測試 ID
  return (
    <div className="w-full" data-testid="upload-progress">
      {/* 進度條 */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
        <div 
          className={`h-2.5 rounded-full ${getProgressBarColor()}`} 
          style={{ width: `${progress}%` }}
          data-testid="progress-bar"
        />
      </div>
      
      {/* 進度信息 */}
      <div className="flex justify-between text-xs text-gray-600">
        <div data-testid="status-text">
          {getStatusText()}
        </div>
        
        <div className="flex space-x-3" data-testid="progress-info">
          {/* 顯示已上傳/總大小 */}
          <span>
            {formatFileSize(uploadedBytes)} / {formatFileSize(fileSize)}
          </span>
          
          {/* 上傳速度 (僅在上傳中顯示) */}
          {status === UploadStatus.UPLOADING && (
            <span data-testid="upload-speed">
              {formatSpeed(speed)}
            </span>
          )}
          
          {/* 剩餘時間 (僅在上傳中顯示) */}
          {status === UploadStatus.UPLOADING && (
            <span 
              className={timeoutWarning ? 'text-red-500 font-bold' : ''}
              data-testid="remaining-time"
            >
              剩餘 {formatTime(remainingTime)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}; 