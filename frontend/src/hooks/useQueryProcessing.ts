import { useState, useCallback, useEffect } from 'react';
import { useWebSocket, WebSocketStatus } from './useWebSocket';

export interface ReferencedSentence {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: 'cd' | 'od' | 'none';
  relevance_score?: number;
}

export interface QueryProcessingProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  progress: number;
  keywords: string[];
  foundDefinitions: {
    cd: number;
    od: number;
  };
  searchResults: {
    [keyword: string]: ReferencedSentence[];
  };
  referencedSentences: ReferencedSentence[];
  errorMessage?: string;
  timestamp?: string;
}

interface UseQueryProcessingOptions {
  queryUuid: string;
  onComplete?: () => void;
  onFail?: (errorMessage: string) => void;
  apiBaseUrl?: string;
}

export const useQueryProcessing = ({
  queryUuid,
  onComplete,
  onFail,
  apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '',
}: UseQueryProcessingOptions) => {
  const [progress, setProgress] = useState<QueryProcessingProgress>({
    status: 'pending',
    currentStep: '等待處理',
    progress: 0,
    keywords: [],
    foundDefinitions: { cd: 0, od: 0 },
    searchResults: {},
    referencedSentences: []
  });
  
  const [fallbackMode, setFallbackMode] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // 處理WebSocket消息
  const handleMessage = useCallback((event: WebSocketEventMap['message']) => {
    try {
      const data = JSON.parse(event.data);
      const { event: eventType } = data;
      
      // 根據事件類型更新狀態
      switch (eventType) {
        case 'query_processing_started':
          setProgress(prev => ({
            ...prev,
            status: 'processing',
            currentStep: '查詢處理開始',
            timestamp: data.timestamp
          }));
          break;
          
        case 'keyword_extraction_completed':
          setProgress(prev => ({
            ...prev,
            keywords: data.keywords,
            currentStep: '關鍵詞提取完成',
            progress: 20,
            timestamp: data.timestamp
          }));
          break;
          
        case 'database_search_progress':
          setProgress(prev => ({
            ...prev,
            progress: data.progress,
            currentStep: data.current_step,
            foundDefinitions: data.found_definitions,
            timestamp: data.timestamp
          }));
          break;
          
        case 'database_search_result':
          setProgress(prev => {
            const updatedSearchResults = { ...prev.searchResults };
            updatedSearchResults[data.keyword] = data.found_sentences;
            
            return {
              ...prev,
              searchResults: updatedSearchResults,
              timestamp: data.timestamp
            };
          });
          break;
          
        case 'answer_generation_started':
          setProgress(prev => ({
            ...prev,
            currentStep: '開始生成答案',
            progress: 80,
            timestamp: data.timestamp
          }));
          break;
          
        case 'referenced_sentences':
          setProgress(prev => ({
            ...prev,
            referencedSentences: data.referenced_sentences,
            timestamp: data.timestamp
          }));
          break;
          
        case 'query_completed':
          setProgress(prev => ({
            ...prev,
            status: 'completed',
            currentStep: '查詢完成',
            progress: 100,
            timestamp: data.timestamp
          }));
          if (onComplete) onComplete();
          break;
          
        case 'query_failed':
          setProgress(prev => ({
            ...prev,
            status: 'failed',
            currentStep: '查詢失敗',
            errorMessage: data.error_message,
            timestamp: data.timestamp
          }));
          if (onFail) onFail(data.error_message);
          break;
          
        default:
          console.warn('Unknown event type:', eventType);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [onComplete, onFail]);
  
  // 處理WebSocket連接錯誤
  const handleError = useCallback((error: WebSocketEventMap['error']) => {
    setConnectionError('WebSocket連接出錯，將使用輪詢方式獲取進度');
    setFallbackMode(true);
  }, []);
  
  const wsUrl = `${apiBaseUrl.replace(/^http/, 'ws')}/ws/chat/${queryUuid}`;
  
  const { status: wsStatus } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onError: handleError,
    reconnectAttempts: 3
  });
  
  // 輪詢機制（當WebSocket失敗時的降級策略）
  useEffect(() => {
    let pollInterval: number | null = null;
    
    if (fallbackMode && progress.status !== 'completed' && progress.status !== 'failed') {
      pollInterval = window.setInterval(async () => {
        try {
          const response = await fetch(`${apiBaseUrl}/chat/queries/${queryUuid}/progress`);
          if (response.ok) {
            const data = await response.json();
            setProgress(prev => ({
              ...prev,
              status: data.status,
              currentStep: data.current_step,
              progress: data.progress,
              keywords: data.keywords || [],
              foundDefinitions: data.found_definitions || { cd: 0, od: 0 },
              errorMessage: data.error_message,
            }));
            
            if (data.status === 'completed' && onComplete) {
              onComplete();
              if (pollInterval) clearInterval(pollInterval);
            } else if (data.status === 'failed' && onFail) {
              onFail(data.error_message);
              if (pollInterval) clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Failed to poll progress:', error);
        }
      }, 2000); // 每2秒輪詢一次
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [fallbackMode, queryUuid, apiBaseUrl, progress.status, onComplete, onFail]);
  
  return {
    progress,
    wsStatus,
    connectionError,
    fallbackMode
  };
}; 