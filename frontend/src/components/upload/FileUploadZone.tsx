import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileUpload } from '../../hooks/useFileUpload';
import { UploadProgressBar } from './UploadProgressBar';
import { UploadTimeoutWarning } from './UploadTimeoutWarning';
import { formatFileSize } from '../../utils/uploadUtils';
import { UploadStatus } from '../../types/upload';
import { getDefaultUploadConfig } from '../../utils/uploadUtils';

/**
 * 檔案上傳區域組件
 * 支援拖放上傳和按鈕上傳
 */
export const FileUploadZone: React.FC = () => {
  // 獲取默認配置
  const config = getDefaultUploadConfig();
  
  // 錯誤訊息
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 使用檔案上傳 Hook
  const { 
    files, 
    addFiles, 
    cancelUpload,
    retryUpload,
    pauseUpload,
    resumeUpload
  } = useFileUpload();
  
  // 處理檔案拖放
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // 清除錯誤訊息
    setErrorMessage(null);
    
    // 處理被拒絕的檔案
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(rejection => {
        if (rejection.errors[0].code === 'file-too-large') {
          return `檔案 ${rejection.file.name} 超過大小限制 (${formatFileSize(config.maxFileSize)})`;
        }
        if (rejection.errors[0].code === 'file-invalid-type') {
          return `檔案 ${rejection.file.name} 類型不支援 (僅支援 PDF)`;
        }
        return `檔案 ${rejection.file.name} ${rejection.errors[0].message}`;
      });
      
      setErrorMessage(errors.join('; '));
      return;
    }
    
    // 添加文件到上傳列表
    if (acceptedFiles.length > 0) {
      const { invalidFiles } = addFiles(acceptedFiles);
      
      // 檢查是否有無效檔案
      if (invalidFiles.length > 0) {
        const errors = invalidFiles.map(invalid => 
          `檔案 ${invalid.file.name}: ${invalid.reason}`
        );
        
        setErrorMessage(errors.join('; '));
      }
    }
  }, [addFiles, config.maxFileSize]);
  
  // 配置 Dropzone
  const { 
    getRootProps, 
    getInputProps, 
    isDragActive,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: config.maxFileSize,
    multiple: true
  });
  
  // 獲取 Dropzone 樣式
  const getDropzoneClassName = () => {
    let className = 'border-2 border-dashed rounded-lg p-6 text-center transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400 outline-none';
    
    if (isDragActive) {
      className += ' bg-blue-50';
    }
    
    if (isDragAccept) {
      className += ' border-green-500';
    } else if (isDragReject) {
      className += ' border-red-500';
    } else {
      className += ' border-gray-300';
    }
    
    return className;
  };
  
  // 處理取消上傳
  const handleCancelUpload = useCallback((fileId: string) => {
    cancelUpload(fileId);
  }, [cancelUpload]);
  
  // 處理重試上傳
  const handleRetryUpload = useCallback((fileId: string) => {
    retryUpload(fileId);
  }, [retryUpload]);
  
  // 處理暫停/繼續上傳
  const handleTogglePause = useCallback((fileId: string, status: UploadStatus) => {
    if (status === UploadStatus.UPLOADING) {
      pauseUpload(fileId);
    } else if (status === UploadStatus.PAUSED) {
      resumeUpload(fileId);
    }
  }, [pauseUpload, resumeUpload]);
  
  // 處理上傳超時警告的取消
  const handleTimeoutCancel = useCallback((fileId: string) => {
    cancelUpload(fileId);
  }, [cancelUpload]);
  
  // 處理上傳超時警告的繼續
  const handleTimeoutContinue = useCallback((fileId: string) => {
    // 關閉警告，繼續上傳
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex >= 0) {
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = {
        ...updatedFiles[fileIndex],
        timeoutWarning: false
      };
    }
  }, [files]);
  
  return (
    <div className="w-full">
      {/* 拖放區域 */}
      <div
        {...getRootProps()}
        className={getDropzoneClassName()}
        data-testid="dropzone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        
        <div className="space-y-2">
          {/* 圖標 */}
          <svg 
            className="mx-auto h-12 w-12 text-gray-400" 
            stroke="currentColor" 
            fill="none" 
            viewBox="0 0 48 48"
          >
            <path 
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
          
          {/* 提示文字 */}
          <p className="text-gray-600">
            拖放 PDF 檔案至此處，或
            <span className="text-blue-500 font-medium mx-1 cursor-pointer">點擊選擇檔案</span>
          </p>
          
          {/* 檔案限制說明 */}
          <p className="text-xs text-gray-500">
            僅支援 PDF 檔案，單檔大小上限 {formatFileSize(config.maxFileSize)}
          </p>
        </div>
      </div>
      
      {/* 錯誤訊息 */}
      {errorMessage && (
        <div 
          className="bg-red-50 border-l-4 border-red-500 p-4 mt-4 rounded" 
          data-testid="upload-error"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg 
                className="h-5 w-5 text-red-500" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                  clipRule="evenodd" 
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 上傳檔案列表 */}
      {files.length > 0 && (
        <div className="mt-6 space-y-4" data-testid="file-list">
          {files.map(file => (
            <div 
              key={file.id} 
              className="border rounded-lg p-4 bg-white"
              data-testid={`file-item-${file.id}`}
            >
              {/* 檔案資訊 */}
              <div className="flex justify-between mb-2">
                <div className="flex items-center">
                  {/* PDF 圖標 */}
                  <svg 
                    className="h-6 w-6 text-red-500" 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                  
                  {/* 檔案名稱和大小 */}
                  <div className="ml-2">
                    <p className="text-sm font-medium text-gray-900">{file.file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>
                  </div>
                </div>
                
                {/* 操作按鈕 */}
                <div className="flex space-x-2">
                  {/* 如果上傳中或暫停，顯示暫停/繼續按鈕 */}
                  {(file.status === UploadStatus.UPLOADING || file.status === UploadStatus.PAUSED) && (
                    <button
                      type="button"
                      onClick={() => handleTogglePause(file.id, file.status)}
                      className="text-gray-500 hover:text-gray-700"
                      title={file.status === UploadStatus.UPLOADING ? '暫停' : '繼續'}
                      data-testid={`toggle-pause-${file.id}`}
                    >
                      {file.status === UploadStatus.UPLOADING ? (
                        <svg 
                          className="h-5 w-5" 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                      ) : (
                        <svg 
                          className="h-5 w-5" 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                      )}
                    </button>
                  )}
                  
                  {/* 如果錯誤或超時，顯示重試按鈕 */}
                  {(file.status === UploadStatus.ERROR || file.status === UploadStatus.TIMEOUT) && (
                    <button
                      type="button"
                      onClick={() => handleRetryUpload(file.id)}
                      className="text-blue-500 hover:text-blue-700"
                      title="重試"
                      data-testid={`retry-${file.id}`}
                    >
                      <svg 
                        className="h-5 w-5" 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </button>
                  )}
                  
                  {/* 取消/刪除按鈕 */}
                  <button
                    type="button"
                    onClick={() => handleCancelUpload(file.id)}
                    className="text-red-500 hover:text-red-700"
                    title="取消"
                    data-testid={`cancel-${file.id}`}
                  >
                    <svg 
                      className="h-5 w-5" 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* 上傳進度條 */}
              <UploadProgressBar
                progress={file.progress}
                status={file.status}
                fileSize={file.file.size}
                uploadedBytes={file.uploadedBytes}
                speed={file.speed}
                remainingTime={file.remainingTime}
                timeoutWarning={file.timeoutWarning}
                errorMessage={file.errorMessage}
              />
              
              {/* 超時警告 */}
              {file.timeoutWarning && file.status === UploadStatus.UPLOADING && (
                <UploadTimeoutWarning
                  remainingTime={file.remainingTime}
                  timeoutMinutes={config.timeoutMinutes}
                  onCancel={() => handleTimeoutCancel(file.id)}
                  onContinue={() => handleTimeoutContinue(file.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 