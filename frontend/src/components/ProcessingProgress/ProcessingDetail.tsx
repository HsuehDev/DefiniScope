import React, { useState } from 'react';
import { ReferencePanel } from '../ReferencePanel';
import { PDFPreviewModal } from '../PDFViewer';
import { ProcessingReference } from '../../types/reference';

interface ProcessingDetailProps {
  processingEvent: any; // 處理事件數據
}

/**
 * 處理過程詳情組件
 * 顯示處理過程中的詳細資訊和參考句子
 */
const ProcessingDetail: React.FC<ProcessingDetailProps> = ({ processingEvent }) => {
  // PDF預覽模態框狀態
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfPreviewData, setPdfPreviewData] = useState<{
    fileUuid: string;
    page: number;
    sentenceUuid?: string;
  }>({ fileUuid: '', page: 1 });
  
  // 轉換為參考面板需要的格式
  const processingReference: ProcessingReference = {
    event: processingEvent.event,
    file_uuid: processingEvent.file_uuid || processingEvent.query_uuid || '',
    sentences: processingEvent.sentences || 
               processingEvent.found_sentences || 
               processingEvent.referenced_sentences || [],
    timestamp: processingEvent.timestamp
  };
  
  // 處理在PDF中查看
  const handleViewInPdf = (fileUuid: string, page: number, sentenceUuid: string) => {
    setPdfPreviewData({ fileUuid, page, sentenceUuid });
    setIsPdfModalOpen(true);
  };
  
  // 關閉PDF預覽模態框
  const handleClosePdfModal = () => {
    setIsPdfModalOpen(false);
  };
  
  // 判斷是否有參考句子數據
  const hasReferenceData = processingReference.sentences && 
                           processingReference.sentences.length > 0;
  
  return (
    <div className="mt-4 bg-white rounded-lg border p-4">
      {/* 事件類型標題 */}
      <div className="mb-4 pb-2 border-b">
        <h3 className="text-lg font-medium text-gray-800">
          {processingEvent.event === 'database_search_result' && '資料庫搜尋結果'}
          {processingEvent.event === 'referenced_sentences' && '答案生成參考'}
          {processingEvent.event === 'sentence_classification_detail' && '句子分類結果'}
          {!['database_search_result', 'referenced_sentences', 'sentence_classification_detail'].includes(processingEvent.event) && 
            '處理詳情'}
        </h3>
        <div className="text-sm text-gray-500">
          {new Date(processingEvent.timestamp).toLocaleString()}
        </div>
      </div>
      
      {/* 處理進度詳情 */}
      {processingEvent.progress !== undefined && (
        <div className="mb-4">
          <div className="text-sm font-medium mb-1">處理進度: {processingEvent.progress}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${processingEvent.progress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* 關鍵詞信息 (如果有) */}
      {processingEvent.keywords && (
        <div className="mb-4">
          <div className="text-sm font-medium mb-1">關鍵詞:</div>
          <div className="flex flex-wrap gap-2">
            {processingEvent.keywords.map((keyword: string, index: number) => (
              <span 
                key={index} 
                className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* 參考面板 */}
      {hasReferenceData && (
        <div className="mt-4">
          <ReferencePanel
            processingReference={processingReference}
            referenceSource="processing"
            onViewInPdf={handleViewInPdf}
          />
        </div>
      )}
      
      {/* PDF預覽模態框 */}
      <PDFPreviewModal
        isOpen={isPdfModalOpen}
        onClose={handleClosePdfModal}
        fileUuid={pdfPreviewData.fileUuid}
        sentenceUuid={pdfPreviewData.sentenceUuid}
        initialPage={pdfPreviewData.page}
      />
    </div>
  );
};

export default ProcessingDetail; 