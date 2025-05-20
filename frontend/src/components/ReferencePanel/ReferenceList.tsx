import React from 'react';
import { ReferenceListProps } from '../../types/reference';
import ReferenceItem from './ReferenceItem';

/**
 * 參考列表組件
 * 顯示多個參考句子項目
 */
const ReferenceList: React.FC<ReferenceListProps> = ({ references, onViewInPdf }) => {
  // 如果沒有參考句子，顯示提示信息
  if (!references || references.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 italic">
        沒有找到相關參考句子
      </div>
    );
  }

  return (
    <div className="space-y-3 px-1 py-2">
      {/* 參考句子數量 */}
      <div className="text-sm text-gray-500 mb-2">
        共找到 {references.length} 個參考句子
      </div>
      
      {/* 參考句子列表 */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {references.map((reference) => (
          <ReferenceItem 
            key={reference.sentence_uuid} 
            reference={reference} 
            onViewInPdf={onViewInPdf} 
          />
        ))}
      </div>
    </div>
  );
};

export default ReferenceList; 