import React from 'react';
import { formatTime } from '../../utils/uploadUtils';

interface UploadTimeoutWarningProps {
  remainingTime: number;
  timeoutMinutes: number;
  onCancel: () => void;
  onContinue: () => void;
}

/**
 * 上傳超時警告組件
 * 當上傳接近超時時顯示警告
 */
export const UploadTimeoutWarning: React.FC<UploadTimeoutWarningProps> = ({
  remainingTime,
  timeoutMinutes,
  onCancel,
  onContinue
}) => {
  // 計算剩餘時間占總時間的百分比
  const remainingTimePercent = Math.round((remainingTime / (timeoutMinutes * 60)) * 100);
  
  return (
    <div 
      className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md my-3"
      data-testid="timeout-warning"
    >
      <div className="flex items-start">
        {/* 警告圖標 */}
        <div className="flex-shrink-0">
          <svg 
            className="h-5 w-5 text-yellow-400" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
        
        {/* 警告內容 */}
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            上傳即將超時
          </h3>
          
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              您的檔案上傳已進行 {timeoutMinutes - Math.ceil(remainingTime / 60)} 分鐘，
              即將達到 {timeoutMinutes} 分鐘的超時限制。
            </p>
            
            {/* 剩餘時間顯示 */}
            <div className="mt-2">
              <p className="font-medium">剩餘時間: {formatTime(remainingTime)}</p>
              
              {/* 進度條 */}
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="h-2 rounded-full bg-yellow-500" 
                  style={{ width: `${remainingTimePercent}%` }}
                  role="progressbar"
                />
              </div>
            </div>
            
            {/* 操作建議 */}
            <p className="mt-2">
              請選擇取消此上傳或繼續等待。超過 {timeoutMinutes} 分鐘後，上傳將自動取消。
            </p>
          </div>
          
          {/* 按鈕區域 */}
          <div className="mt-3 flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              data-testid="cancel-upload-btn"
            >
              取消上傳
            </button>
            
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              data-testid="continue-upload-btn"
            >
              繼續上傳
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 