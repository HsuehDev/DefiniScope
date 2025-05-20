import React from 'react';
import { ReferenceItemProps } from '../../types/reference';

// 定義類型標籤顏色
const DEFINING_TYPE_COLORS = {
  cd: 'bg-blue-100 text-blue-800 border-blue-300',
  od: 'bg-green-100 text-green-800 border-green-300',
  none: 'bg-gray-100 text-gray-800 border-gray-300'
};

// 定義類型標籤文字
const DEFINING_TYPE_LABELS = {
  cd: '概念型定義',
  od: '操作型定義',
  none: '一般句子'
};

/**
 * 單個參考項組件
 * 顯示引用的句子內容、來源文件、頁碼和定義類型
 */
const ReferenceItem: React.FC<ReferenceItemProps> = ({ reference, onViewInPdf }) => {
  // 處理「在PDF中查看」按鈕點擊
  const handleViewInPdf = () => {
    if (onViewInPdf) {
      onViewInPdf(reference.file_uuid, reference.page, reference.sentence_uuid);
    }
  };

  return (
    <div className="border rounded-md p-3 mb-2 bg-white shadow-sm hover:shadow transition-shadow">
      {/* 句子內容 */}
      <p className="text-gray-700 mb-2 leading-relaxed">{reference.sentence}</p>
      
      <div className="flex flex-wrap items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          {/* 定義類型標籤 */}
          <span 
            className={`text-xs px-2 py-1 rounded-full border ${DEFINING_TYPE_COLORS[reference.defining_type]}`}
          >
            {DEFINING_TYPE_LABELS[reference.defining_type]}
          </span>
          
          {/* 文件來源和頁碼 */}
          <span className="text-xs text-gray-500">
            來源: {reference.original_name} (第 {reference.page} 頁)
          </span>
        </div>
        
        {/* 「在PDF中查看」按鈕 */}
        <button
          onClick={handleViewInPdf}
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-1 px-2 rounded border border-blue-200 transition-colors flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          在PDF中查看
        </button>
      </div>
      
      {/* 顯示分類原因（如果有） */}
      {reference.reason && (
        <div className="mt-2 text-xs text-gray-500 italic pt-1 border-t">
          <span className="font-medium">分類原因:</span> {reference.reason}
        </div>
      )}
    </div>
  );
};

export default ReferenceItem; 