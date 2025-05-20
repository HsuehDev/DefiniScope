import React, { useState, useEffect } from 'react';
import { ContextViewerParams } from '../../types/reference';

/**
 * 句子上下文查看器組件
 * 顯示引用句子的前後文和PDF查看選項
 */
const ReferenceContextViewer: React.FC<ContextViewerParams> = ({ 
  reference, 
  isOpen, 
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<{
    before: string[];
    sentence: string;
    after: string[];
  }>({
    before: [],
    sentence: reference?.sentence || "",
    after: []
  });

  useEffect(() => {
    if (isOpen && reference) {
      fetchSentenceContext(reference.file_uuid, reference.sentence_uuid);
    }
  }, [isOpen, reference]);

  // 模擬從API獲取句子上下文
  const fetchSentenceContext = async (fileUuid: string, sentenceUuid: string) => {
    setLoading(true);
    try {
      // 這裡應該是實際的API調用
      // const response = await fetch(`/api/files/${fileUuid}/sentences/${sentenceUuid}/context`);
      // const data = await response.json();
      
      // 模擬API回應
      setTimeout(() => {
        setContext({
          before: [
            "這是引用句子的前一個句子。",
            "這是引用句子的前第二個句子。"
          ],
          sentence: reference.sentence,
          after: [
            "這是引用句子的後一個句子。",
            "這是引用句子的後第二個句子。"
          ]
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error("獲取句子上下文時出錯:", error);
      setLoading(false);
    }
  };

  // 處理查看PDF
  const handleViewPdf = () => {
    if (!reference) return;
    
    // 生成PDF預覽URL
    const pdfPreviewUrl = `/files/${reference.file_uuid}/preview?page=${reference.page}&highlight=${reference.sentence_uuid}`;
    
    // 在新標籤打開PDF預覽頁面
    window.open(pdfPreviewUrl, '_blank');
  };

  if (!isOpen || !reference) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 text-gray-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
              />
            </svg>
            <h3 className="text-lg font-medium">{reference.original_name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="關閉"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>
        
        {/* 內容區 */}
        <div className="flex-1 p-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <svg className="animate-spin h-8 w-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-700 space-y-2">
                <h4 className="font-medium text-gray-900">句子上下文</h4>
                
                {/* 前文 */}
                {context.before.map((sentence, index) => (
                  <p key={`before-${index}`} className="text-gray-500">
                    {sentence}
                  </p>
                ))}
                
                {/* 引用句子 */}
                <p className="bg-yellow-100 p-2 border-l-4 border-yellow-400 font-medium">
                  {context.sentence}
                </p>
                
                {/* 後文 */}
                {context.after.map((sentence, index) => (
                  <p key={`after-${index}`} className="text-gray-500">
                    {sentence}
                  </p>
                ))}
              </div>
              
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">
                      出自第 <span className="font-medium text-gray-900">{reference.page}</span> 頁
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {reference.defining_type === 'cd' ? '概念型定義' : '操作型定義'}
                    </p>
                  </div>
                  <button
                    onClick={handleViewPdf}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                  >
                    在PDF中查看
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferenceContextViewer; 