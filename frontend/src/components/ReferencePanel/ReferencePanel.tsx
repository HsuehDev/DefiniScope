import React, { useEffect, useState } from 'react';
import { ReferencePanelProps, SentenceReference } from '../../types/reference';
import ReferenceList from './ReferenceList';
import { fetchMessageReferences } from '../../services/chatService';

/**
 * 參考信息面板組件
 * 顯示聊天回答或處理過程中參考的原文句子
 */
const ReferencePanel: React.FC<ReferencePanelProps> = ({
  selectedMessageUuid,
  processingReference,
  onViewInPdf,
  referenceSource
}) => {
  // 參考句子列表狀態
  const [references, setReferences] = useState<SentenceReference[]>([]);
  // 加載狀態
  const [loading, setLoading] = useState<boolean>(false);
  // 錯誤狀態
  const [error, setError] = useState<string | null>(null);

  // 根據選中的消息ID獲取參考信息
  useEffect(() => {
    // 如果是從處理過程來的參考，直接使用processingReference
    if (referenceSource === 'processing' && processingReference) {
      setReferences(processingReference.sentences);
      return;
    }

    // 如果是從聊天來的參考，需要請求API獲取
    if (referenceSource === 'chat' && selectedMessageUuid) {
      setLoading(true);
      setError(null);

      fetchMessageReferences(selectedMessageUuid)
        .then(data => {
          setReferences(data.references || []);
        })
        .catch(err => {
          console.error('獲取參考信息失敗:', err);
          setError('無法加載參考信息，請稍後再試');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedMessageUuid, processingReference, referenceSource]);

  // 渲染面板頭部
  const renderHeader = () => {
    let title = '';
    
    if (referenceSource === 'chat') {
      title = '回答參考資訊';
    } else if (referenceSource === 'processing') {
      // 根據處理事件類型顯示不同標題
      if (processingReference?.event === 'database_search_result') {
        title = '資料庫搜尋結果';
      } else if (processingReference?.event === 'referenced_sentences') {
        title = '答案生成參考句子';
      } else if (processingReference?.event === 'sentence_classification_detail') {
        title = '句子分類結果';
      } else {
        title = '處理參考資訊';
      }
    }
    
    return (
      <div className="px-4 py-3 border-b">
        <h3 className="text-lg font-medium text-gray-800">
          {title}
        </h3>
        {processingReference?.event === 'database_search_result' && (
          <p className="text-sm text-gray-500 mt-1">
            搜尋關鍵詞: {processingReference?.file_uuid || ''}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-50 border rounded-md shadow-sm h-full flex flex-col">
      {/* 面板頭部 */}
      {renderHeader()}
      
      {/* 內容區域 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">正在加載參考資訊...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            {error}
          </div>
        ) : (
          <ReferenceList 
            references={references}
            onViewInPdf={onViewInPdf}
          />
        )}
      </div>
    </div>
  );
};

export default ReferencePanel; 