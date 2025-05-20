import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatContainer } from '../components/chat';
import { useWebSocket } from '../hooks/useWebsocket';
import { 
  Conversation, 
  Reference, 
  WebSocketEvent, 
  DatabaseSearchResultEvent, 
  ReferencedSentencesEvent 
} from '../components/chat/types';
import axios from 'axios';

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
      ? `ws://${window.location.host}/ws/chat/${currentQueryUuid}`
      : `ws://${window.location.host}/ws/empty`,
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

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <ChatContainer
          conversation={conversation}
          isProcessing={isProcessing}
          onSendMessage={handleSendMessage}
          onViewReference={handleViewReference}
          processingProgress={processingProgress}
          processingStep={processingStep}
          referencedSentences={referencedSentences}
        />
      </div>

      {/* PDF 預覽模態框 */}
      {showPreview && previewReference && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-3/4 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold">
                {previewReference.original_name} (第 {previewReference.page} 頁)
              </h2>
              <button onClick={closePreview} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* 這裡應該實現PDF查看器，使用iframe或PDF.js等 */}
              <iframe
                src={`/api/files/${previewReference.file_uuid}/preview?page=${previewReference.page}&highlight=${previewReference.sentence_uuid}`}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage; 