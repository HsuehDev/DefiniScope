import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { StageIndicator } from './StageIndicator';
import { DetailPanel } from './DetailPanel';
import { SentenceData, ReferencedSentence, FileProcessingProgress, QueryProcessingProgress, FileProcessingStatus } from '../../types/progress';

interface CommonProps {
  error?: string | null;
  isFallbackMode?: boolean;
  onSentenceClick?: (sentence: SentenceData | ReferencedSentence) => void;
  className?: string;
}

interface FileProcessingProgressProps extends CommonProps {
  type: 'file';
  progress: FileProcessingProgress;
}

interface QueryProcessingProgressProps extends CommonProps {
  type: 'query';
  progress: QueryProcessingProgress;
}

type ProcessingProgressProps = FileProcessingProgressProps | QueryProcessingProgressProps;

export const ProcessingProgress: React.FC<ProcessingProgressProps> = (props) => {
  const [showDetails, setShowDetails] = useState(true);
  
  // 共用的狀態、進度等屬性
  const status = props.progress.status;
  const progress = props.progress.progress;
  const currentStep = props.progress.currentStep;
  const errorMessage = props.progress.errorMessage;
  
  // 顯示適當的詳細信息
  const renderDetailPanel = () => {
    if (props.type === 'file') {
      const { extractedSentences, classifiedSentences } = props.progress;
      return (
        <DetailPanel 
          extractedSentences={extractedSentences}
          classifiedSentences={classifiedSentences}
          onSentenceClick={props.onSentenceClick}
        />
      );
    } else {
      const { keywords, searchResults, referencedSentences, foundDefinitions } = props.progress;
      return (
        <DetailPanel 
          keywords={keywords}
          searchResults={searchResults}
          referencedSentences={referencedSentences}
          foundDefinitions={foundDefinitions}
          onSentenceClick={props.onSentenceClick}
        />
      );
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${props.className}`}>
      {/* 標題和摺疊按鈕 */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          {props.type === 'file' ? '文件處理進度' : '查詢處理進度'}
        </h3>
        <button 
          className="text-gray-500 hover:text-gray-700 focus:outline-none"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" 
                clipRule="evenodd" 
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" 
                clipRule="evenodd" 
              />
            </svg>
          )}
        </button>
      </div>
      
      {/* 進度條和狀態 */}
      <div className="px-4 py-3">
        <div className="mb-2">
          <ProgressBar progress={progress} status={status} />
        </div>
        
        <StageIndicator 
          currentStep={currentStep} 
          status={status}
          current={props.type === 'file' && 'current' in props.progress ? props.progress.current : undefined}
          total={props.type === 'file' && 'total' in props.progress ? props.progress.total : undefined}
        />
        
        {/* 錯誤信息 */}
        {status === 'failed' && errorMessage && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {errorMessage}
          </div>
        )}
        
        {/* WebSocket連接錯誤 */}
        {props.error && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md text-orange-700 text-sm flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                clipRule="evenodd" 
              />
            </svg>
            {props.error} {props.isFallbackMode && '(使用輪詢模式)'}
          </div>
        )}
      </div>
      
      {/* 詳細信息面板 */}
      {showDetails && <div className="border-t border-gray-200">{renderDetailPanel()}</div>}
      
      {/* 預估剩餘時間 (只在處理中顯示) */}
      {status === 'processing' && progress > 0 && progress < 100 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          預估剩餘時間: {getEstimatedTimeRemaining(progress)}
        </div>
      )}
    </div>
  );
};

// 預估剩餘時間函數
const getEstimatedTimeRemaining = (progress: number): string => {
  if (progress <= 0 || progress >= 100) return '計算中...';
  
  // 假設每1%進度需要5秒，這只是一個簡單的估算方法
  // 實際應用中可能需要根據過去的進度變化來動態計算
  const remainingSeconds = (100 - progress) * 5;
  
  if (remainingSeconds < 60) {
    return `約 ${Math.round(remainingSeconds)} 秒`;
  } else if (remainingSeconds < 3600) {
    return `約 ${Math.round(remainingSeconds / 60)} 分鐘`;
  } else {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.round((remainingSeconds % 3600) / 60);
    return `約 ${hours} 小時 ${minutes} 分鐘`;
  }
}; 