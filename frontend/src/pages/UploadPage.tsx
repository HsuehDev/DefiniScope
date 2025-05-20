import React, { useState } from 'react';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { FileProcessingProgress } from '../components/FileProcessingProgress';

/**
 * 檔案上傳頁面
 */
export const UploadPage: React.FC = () => {
  const [currentFileUuid, setCurrentFileUuid] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 處理檔案上傳完成
  const handleUploadComplete = (fileUuid: string) => {
    setCurrentFileUuid(fileUuid);
    setIsProcessing(true);
  };
  
  // 處理檔案處理完成
  const handleProcessingComplete = () => {
    setIsProcessing(false);
  };
  
  return (
    <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            上傳文件
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            上傳 PDF 文件進行處理和分析
          </p>
        </div>
      </div>
      
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <FileUploadZone onUploadComplete={handleUploadComplete} />
        </div>
      </div>
      
      {isProcessing && currentFileUuid && (
        <div className="mt-6 bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-3">
              處理進度
            </h3>
            <FileProcessingProgress 
              fileUuid={currentFileUuid} 
              onProcessingComplete={handleProcessingComplete} 
            />
          </div>
        </div>
      )}
    </div>
  );
}; 