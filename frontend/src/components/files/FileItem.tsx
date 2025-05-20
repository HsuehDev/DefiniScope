import React from 'react';
import { FileItem as FileItemType } from '../../types/files';

interface FileItemProps {
  file: FileItemType;
  onDelete: (file: FileItemType) => void;
  onPreview: (file: FileItemType) => void;
}

export const FileItem: React.FC<FileItemProps> = ({ file, onDelete, onPreview }) => {
  // 格式化檔案大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 取得狀態標籤樣式
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
      case 'timeout':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 取得狀態文字
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'pending':
        return '等待中';
      case 'in_progress':
        return '處理中';
      case 'failed':
        return '失敗';
      case 'timeout':
        return '逾時';
      default:
        return '未知';
    }
  };

  // 檢查檔案是否可預覽（上傳完成）
  const isPreviewable = file.upload_status === 'completed';
  
  // 檢查是否顯示處理狀態（僅在上傳完成時顯示）
  const showProcessingStatus = file.upload_status === 'completed';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium text-gray-900 truncate" title={file.original_name}>
            {file.original_name}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => onPreview(file)}
              disabled={!isPreviewable}
              className={`p-1.5 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${!isPreviewable ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-700'}`}
              title={isPreviewable ? '預覽檔案' : '無法預覽 - 檔案上傳尚未完成'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(file)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              title="刪除檔案"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="mt-2 flex items-center text-sm text-gray-500">
          <span>{formatFileSize(file.size_bytes)}</span>
          <span className="mx-2">•</span>
          <span>上傳於 {formatDate(file.created_at)}</span>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(file.upload_status)}`}>
            上傳：{getStatusText(file.upload_status)}
          </span>
          
          {showProcessingStatus && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(file.processing_status)}`}>
              處理：{getStatusText(file.processing_status)}
            </span>
          )}
        </div>
        
        {file.processing_status === 'completed' && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
            <div className="flex flex-col">
              <span className="font-medium">總句數</span>
              <span className="text-gray-900">{file.sentence_count}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-medium">概念定義</span>
              <span className="text-gray-900">{file.cd_count}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-medium">操作定義</span>
              <span className="text-gray-900">{file.od_count}</span>
            </div>
          </div>
        )}
        
        {file.error_message && (
          <div className="mt-2 text-xs text-red-600">
            <p className="font-medium">錯誤信息：</p>
            <p>{file.error_message}</p>
          </div>
        )}
      </div>
    </div>
  );
}; 