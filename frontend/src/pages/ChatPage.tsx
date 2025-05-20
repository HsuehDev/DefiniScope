import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatContainer } from '../components/chat';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  Conversation, 
  Reference, 
  WebSocketEvent, 
  DatabaseSearchResultEvent, 
  ReferencedSentencesEvent 
} from '../components/chat/types';
import axios from 'axios';
import { MessageList, ChatInput } from '../components/chat';
import { ReferencePanel } from '../components/ReferencePanel';
import { PDFPreviewModal } from '../components/PDFViewer';
import { fetchConversation } from '../services/chatService';
import { SentenceReference } from '../types/reference';

const ChatPage: React.FC = () => {
  const { conversationId } = useParams<{conversationId: string}>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<number | undefined>(undefined);
  const [processingStep, setProcessingStep] = useState<string | undefined>(undefined);
  const [currentQueryUuid, setCurrentQueryUuid] = useState<string | null>(null);
  const [referencedSentences, setReferencedSentences] = useState<Reference[]>([]);
  const [previewReference, setPreviewReference] = useState<Reference | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfPreviewData, setPdfPreviewData] = useState<{
    fileUuid: string;
    page: number;
    sentenceUuid?: string;
  }>({ fileUuid: '', page: 1 });
  const [loading, setLoading] = useState<boolean>(true);

  // 載入對話資料
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        if (!conversationId) {
          // 如果沒有ID則創建新對話
          setConversation({
            conversation_uuid: '',
            title: '新對話',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: []
          });
          return;
        }

        const response = await axios.get(`/api/chat/conversations/${conversationId}`);
        setConversation(response.data);
      } catch (error) {
        console.error('載入對話失敗:', error);
        // 導向到對話列表
        navigate('/conversations');
      }
    };

    fetchConversation();
  }, [conversationId, navigate]);

  // 處理WebSocket連接
  const handleWebSocketMessage = useCallback((event: WebSocketEvent) => {
    console.log('WebSocket 消息:', event);

    switch (event.event) {
      case 'query_processing_started':
        setIsProcessing(true);
        setProcessingStep('開始處理您的問題...');
        break;

      case 'keyword_extraction_completed':
        setProcessingStep(`已提取關鍵詞: ${event.keywords?.join(', ')}`);
        break;

      case 'database_search_progress':
        setProcessingProgress(event.progress);
        setProcessingStep(event.current_step);
        break;

      case 'database_search_result':
        // 處理資料庫搜尋結果
        const searchResultEvent = event as DatabaseSearchResultEvent;
        setProcessingStep(`找到與 "${searchResultEvent.keyword}" 相關的句子: ${searchResultEvent.found_sentences.length} 條`);
        break;

      case 'answer_generation_started':
        setProcessingStep('正在生成答案...');
        break;

      case 'referenced_sentences':
        // 處理參考句子
        const referencedEvent = event as ReferencedSentencesEvent;
        setReferencedSentences(referencedEvent.referenced_sentences);
        setProcessingStep('正在基於這些句子生成答案...');
        break;

      case 'query_completed':
        // 處理查詢完成
        setIsProcessing(false);
        setProcessingProgress(undefined);
        setProcessingStep(undefined);
        setReferencedSentences([]);
        // 重新加載對話以獲取最新的系統回覆
        refreshConversation();
        break;

      case 'query_failed':
        // 處理查詢失敗
        setIsProcessing(false);
        setProcessingProgress(undefined);
        setProcessingStep('處理問題時發生錯誤，請稍後再試');
        setTimeout(() => {
          setProcessingStep(undefined);
        }, 3000);
        break;

      default:
        break;
    }
  }, []);

  // 建立WebSocket連接
  const { connected } = useWebSocket({
    url: currentQueryUuid 
      ? `/ws/chat/${currentQueryUuid}`
      : `/ws/empty`,
    onMessage: handleWebSocketMessage,
    onOpen: () => console.log('WebSocket 連接已建立'),
    onClose: () => console.log('WebSocket 連接已關閉'),
    onError: (error) => console.error('WebSocket 錯誤:', error)
  });

  // 重新加載對話
  const refreshConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await axios.get(`/api/chat/conversations/${conversationId}`);
      setConversation(response.data);
    } catch (error) {
      console.error('重新載入對話失敗:', error);
    }
  }, [conversationId]);

  // 發送消息
  const handleSendMessage = async (message: string) => {
    if (isProcessing) return;

    try {
      // 先在UI中添加用戶消息
      const tempUserMessage = {
        message_uuid: `temp-${Date.now()}`,
        role: 'user' as const,
        content: message,
        created_at: new Date().toISOString()
      };

      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, tempUserMessage]
        };
      });

      // 發送消息到後端
      const response = await axios.post('/api/chat/query', {
        query: message,
        conversation_uuid: conversation?.conversation_uuid
      });

      // 設置當前查詢ID，用於WebSocket連接
      setCurrentQueryUuid(response.data.query_uuid);
      
      // 如果是新對話，更新ID並修改URL
      if (!conversationId && response.data.conversation_uuid) {
        navigate(`/chat/${response.data.conversation_uuid}`);
      }

      setIsProcessing(true);
    } catch (error) {
      console.error('發送消息失敗:', error);
      // 移除臨時消息
      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(m => !m.message_uuid.startsWith('temp-'))
        };
      });
    }
  };

  // 查看引用原文
  const handleViewReference = (reference: Reference) => {
    setPreviewReference(reference);
    setShowPreview(true);
  };

  // 關閉預覽
  const closePreview = () => {
    setShowPreview(false);
    setPreviewReference(null);
  };

  // 處理消息點擊，顯示參考面板
  const handleMessageClick = (messageUuid: string) => {
    // 如果已經選中該消息，則取消選中
    if (selectedMessageUuid === messageUuid) {
      setSelectedMessageUuid(null);
    } else {
      setSelectedMessageUuid(messageUuid);
    }
  };
  
  // 處理查看PDF
  const handleViewInPdf = (fileUuid: string, page: number, sentenceUuid: string) => {
    setPdfPreviewData({ fileUuid, page, sentenceUuid });
    setIsPdfModalOpen(true);
  };
  
  // 關閉PDF預覽模態框
  const handleClosePdfModal = () => {
    setIsPdfModalOpen(false);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden flex">
        {/* 聊天區域 - 佔據3/4的寬度 */}
        <div className="w-3/4 flex flex-col h-full border-r">
          {/* 聊天消息列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <MessageList 
                messages={conversation?.messages || []} 
                onMessageClick={handleMessageClick}
                selectedMessageUuid={selectedMessageUuid}
              />
            )}
          </div>
          
          {/* 聊天輸入區域 */}
          <div className="p-4 border-t">
            <ChatInput conversationId={conversationId} onMessageSent={() => setSelectedMessageUuid(null)} />
          </div>
        </div>
        
        {/* 參考面板區域 - 佔據1/4的寬度 */}
        <div className="w-1/4 h-full overflow-hidden p-4">
          {selectedMessageUuid ? (
            <ReferencePanel
              selectedMessageUuid={selectedMessageUuid}
              referenceSource="chat"
              onViewInPdf={handleViewInPdf}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>點擊消息查看參考資訊</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
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

export { ChatPage }; 