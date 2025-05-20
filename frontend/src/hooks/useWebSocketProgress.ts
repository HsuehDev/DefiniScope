import { useEffect, useRef, useState, useCallback } from 'react';
import { FileProcessingProgress, QueryProcessingProgress, WebSocketMessage } from '../types/progress';
import { getAccessToken } from '../services/auth/authService';
import { useWebSocket } from './useWebSocket';
import { QueryProcessingEvent } from '../types/progress';

// 通用的WebSocket進度鉤子
export function useWebSocketBase<T>(
  url: string, 
  initialState: T,
  onMessage: (message: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 2000; // 2秒

  // 清理重連計時器
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // 連接WebSocket
  const connect = useCallback(() => {
    if (!url || !navigator.onLine) return;

    try {
      // 獲取認證令牌並添加到URL
      const token = getAccessToken();
      const wsUrlWithToken = token ? `${url}?token=${token}` : url;
      
      wsRef.current = new WebSocket(wsUrlWithToken);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          console.error('解析WebSocket消息失敗:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        if (!event.wasClean && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          setError(`WebSocket連接已關閉，嘗試重新連接...（${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS}）`);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, RECONNECT_INTERVAL);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('WebSocket連接失敗，已切換到輪詢模式');
          setIsFallbackMode(true);
        }
      };

      wsRef.current.onerror = () => {
        setError('WebSocket連接錯誤');
        wsRef.current?.close();
      };
    } catch (e) {
      console.error('創建WebSocket連接失敗:', e);
      setError('創建WebSocket連接失敗');
      setIsFallbackMode(true);
    }
  }, [url, clearReconnectTimeout, onMessage]);

  // 斷開連接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearReconnectTimeout();
    setIsConnected(false);
  }, [clearReconnectTimeout]);

  // 手動發送消息
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未連接，無法發送消息');
    }
  }, []);

  // 建立連接和清理
  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  // 網絡狀態變化監聽
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected && !wsRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        connect();
      }
    };

    const handleOffline = () => {
      setError('網絡連接已斷開');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, connect]);

  return {
    isConnected,
    error,
    isFallbackMode,
    sendMessage
  };
}

// 獲取WebSocket基礎URL
const getWebSocketBaseUrl = (): string => {
  // 使用相對路徑，讓代理處理轉發
  return '';
};

// 文件處理進度鉤子
export function useFileProcessingWebSocket(fileUuid: string | null) {
  const [progress, setProgress] = useState<FileProcessingProgress>({
    file_uuid: fileUuid || '',
    progress: 0,
    status: 'pending',
    currentStep: '等待處理',
    extractedSentences: [],
    classifiedSentences: []
  });

  const wsUrl = fileUuid ? `${getWebSocketBaseUrl()}/ws/processing/${fileUuid}` : '';

  const handleMessage = useCallback((message: WebSocketMessage<any>) => {
    switch (message.event) {
      case 'processing_started':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '開始處理文件',
          progress: 5
        }));
        break;
      
      case 'pdf_extraction_progress':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '正在提取PDF文本',
          progress: message.data.progress || prev.progress,
          current: message.data.current,
          total: message.data.total
        }));
        break;
      
      case 'sentence_extraction_detail':
        setProgress(prev => ({
          ...prev,
          extractedSentences: [...prev.extractedSentences, ...message.data.sentences]
        }));
        break;
      
      case 'sentence_classification_progress':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '正在進行句子分類',
          progress: message.data.progress || prev.progress,
          current: message.data.current,
          total: message.data.total
        }));
        break;
      
      case 'sentence_classification_detail':
        setProgress(prev => ({
          ...prev,
          classifiedSentences: [...prev.classifiedSentences, ...message.data.sentences]
        }));
        break;
      
      case 'processing_completed':
        setProgress(prev => ({
          ...prev,
          status: 'completed',
          currentStep: '處理完成',
          progress: 100
        }));
        break;
      
      case 'processing_failed':
        setProgress(prev => ({
          ...prev,
          status: 'failed',
          currentStep: '處理失敗',
          errorMessage: message.data.error_message || '處理過程中發生錯誤'
        }));
        break;
      
      default:
        console.warn('未知的事件類型:', message.event);
    }
  }, []);

  const { isConnected, error, isFallbackMode, sendMessage } = useWebSocketBase<FileProcessingProgress>(
    wsUrl,
    progress,
    handleMessage
  );

  return { progress, isConnected, error, isFallbackMode, sendMessage };
}

// 查詢處理進度鉤子
export function useQueryProcessingWebSocket(queryUuid: string | null) {
  const [progress, setProgress] = useState<QueryProcessingProgress>({
    query_uuid: queryUuid || '',
    progress: 0,
    status: 'pending',
    currentStep: '等待處理',
    keywords: [],
    foundDefinitions: { cd: 0, od: 0 },
    searchResults: {},
    referencedSentences: []
  });

  const wsUrl = queryUuid ? `${getWebSocketBaseUrl()}/ws/chat/${queryUuid}` : '';

  const handleMessage = useCallback((message: WebSocketMessage<any>) => {
    switch (message.event) {
      case 'query_processing_started':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '開始處理查詢',
          progress: 5
        }));
        break;
      
      case 'keyword_extraction_completed':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '已提取關鍵詞',
          progress: 20,
          keywords: message.data.keywords || []
        }));
        break;
      
      case 'database_search_progress':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '正在搜尋相關定義',
          progress: message.data.progress || prev.progress,
          foundDefinitions: message.data.found_definitions || prev.foundDefinitions
        }));
        break;
      
      case 'database_search_result':
        setProgress(prev => {
          const keyword = message.data.keyword;
          const foundSentences = message.data.found_sentences || [];
          
          return {
            ...prev,
            searchResults: {
              ...prev.searchResults,
              [keyword]: foundSentences
            }
          };
        });
        break;
      
      case 'answer_generation_started':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          currentStep: '正在生成答案',
          progress: 75
        }));
        break;
      
      case 'referenced_sentences':
        setProgress(prev => ({
          ...prev,
          referencedSentences: message.data.referenced_sentences || []
        }));
        break;
      
      case 'query_completed':
        setProgress(prev => ({
          ...prev,
          status: 'completed',
          currentStep: '處理完成',
          progress: 100
        }));
        break;
      
      case 'query_failed':
        setProgress(prev => ({
          ...prev,
          status: 'failed',
          currentStep: '處理失敗',
          errorMessage: message.data.error_message || '處理過程中發生錯誤'
        }));
        break;
      
      default:
        console.warn('未知的事件類型:', message.event);
    }
  }, []);

  const { isConnected, error, isFallbackMode, sendMessage } = useWebSocketBase<QueryProcessingProgress>(
    wsUrl,
    progress,
    handleMessage
  );

  return { progress, isConnected, error, isFallbackMode, sendMessage };
}

interface UseWebSocketProgressOptions {
  queryUuid?: string | null;
  conversationId?: string;
}

interface UseWebSocketProgressResult {
  isProcessing: boolean;
  progress: number | undefined;
  currentStep: string | undefined;
  referencedSentences: any[];
  error: Event | null;
}

export const useWebSocketProgress = ({ 
  queryUuid, 
  conversationId 
}: UseWebSocketProgressOptions): UseWebSocketProgressResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState<string | undefined>(undefined);
  const [referencedSentences, setReferencedSentences] = useState<any[]>([]);

  // 構造WebSocket URL
  const wsUrl = queryUuid 
    ? `/ws/chat/${queryUuid}` 
    : `/ws/empty`;

  // 處理WebSocket消息
  const handleWebSocketMessage = useCallback((event: any) => {
    console.log('進度WebSocket消息:', event);

    switch (event.event) {
      case 'query_processing_started':
        setIsProcessing(true);
        setCurrentStep('開始處理您的問題...');
        break;

      case 'keyword_extraction_completed':
        setCurrentStep(`已提取關鍵詞: ${event.keywords?.join(', ')}`);
        break;

      case 'database_search_progress':
        setProgress(event.progress);
        setCurrentStep(event.current_step);
        break;

      case 'database_search_result':
        setCurrentStep(`找到與 "${event.keyword}" 相關的句子: ${event.found_sentences.length} 條`);
        break;

      case 'answer_generation_started':
        setCurrentStep('正在生成答案...');
        break;

      case 'referenced_sentences':
        setReferencedSentences(event.referenced_sentences);
        setCurrentStep('正在基於這些句子生成答案...');
        break;

      case 'query_completed':
        setIsProcessing(false);
        setProgress(undefined);
        setCurrentStep(undefined);
        setReferencedSentences([]);
        break;

      case 'query_failed':
        setIsProcessing(false);
        setProgress(undefined);
        setCurrentStep('處理問題時發生錯誤，請稍後再試');
        setTimeout(() => {
          setCurrentStep(undefined);
        }, 3000);
        break;

      default:
        break;
    }
  }, []);

  // 使用基礎WebSocket鉤子
  const { error } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    onOpen: () => console.log('進度WebSocket連接已建立', wsUrl),
    onClose: () => console.log('進度WebSocket連接已關閉'),
    onError: (error) => console.error('進度WebSocket錯誤:', error)
  });

  // 當queryUuid變更時重置狀態
  useEffect(() => {
    if (!queryUuid) {
      setIsProcessing(false);
      setProgress(undefined);
      setCurrentStep(undefined);
      setReferencedSentences([]);
    }
  }, [queryUuid]);

  return {
    isProcessing,
    progress,
    currentStep,
    referencedSentences,
    error
  };
}; 