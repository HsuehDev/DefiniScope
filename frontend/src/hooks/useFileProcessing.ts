import { useState, useCallback, useEffect } from 'react';
import { useWebSocket, WebSocketStatus } from './useWebSocket';

export interface SentenceData {
  sentence_uuid: string;
  sentence: string;
  defining_type: 'cd' | 'od' | 'none';
  reason?: string;
  page: number;
}

export interface FileProcessingProgress {
  progress: number;
  current: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  errorMessage?: string;
  extractedSentences: SentenceData[];
  classifiedSentences: SentenceData[];
  timestamp?: string;
}

interface UseFileProcessingOptions {
  fileUuid: string;
  onComplete?: () => void;
  onFail?: (errorMessage: string) => void;
  apiBaseUrl?: string;
}

export const useFileProcessing = ({
  fileUuid,
  onComplete,
  onFail,
  apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '',
}: UseFileProcessingOptions) => {
  const [progress, setProgress] = useState<FileProcessingProgress>({
    progress: 0,
    current: 0,
    total: 0,
    status: 'pending',
    currentStep: '等待處理',
    extractedSentences: [],
    classifiedSentences: []
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
        case 'processing_started':
          setProgress(prev => ({
            ...prev,
            status: 'processing',
            currentStep: '處理開始',
            timestamp: data.timestamp
          }));
          break;
          
        case 'pdf_extraction_progress':
          setProgress(prev => ({
            ...prev,
            progress: data.progress,
            current: data.current,
            total: data.total,
            currentStep: 'PDF 文本提取',
            timestamp: data.timestamp
          }));
          break;
          
        case 'sentence_extraction_detail':
          setProgress(prev => ({
            ...prev,
            extractedSentences: [...prev.extractedSentences, ...data.sentences],
            timestamp: data.timestamp
          }));
          break;
          
        case 'sentence_classification_progress':
          setProgress(prev => ({
            ...prev,
            progress: data.progress,
            current: data.current,
            total: data.total,
            currentStep: '句子分類',
            timestamp: data.timestamp
          }));
          break;
          
        case 'sentence_classification_detail':
          setProgress(prev => ({
            ...prev,
            classifiedSentences: [...prev.classifiedSentences, ...data.sentences],
            timestamp: data.timestamp
          }));
          break;
          
        case 'processing_completed':
          setProgress(prev => ({
            ...prev,
            progress: 100,
            status: 'completed',
            currentStep: '處理完成',
            timestamp: data.timestamp
          }));
          if (onComplete) onComplete();
          break;
          
        case 'processing_failed':
          setProgress(prev => ({
            ...prev,
            status: 'failed',
            currentStep: '處理失敗',
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
  
  const wsUrl = `${apiBaseUrl.replace(/^http/, 'ws')}/ws/processing/${fileUuid}`;
  
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
          const response = await fetch(`${apiBaseUrl}/files/${fileUuid}/progress`);
          if (response.ok) {
            const data = await response.json();
            setProgress(prev => ({
              ...prev,
              progress: data.progress,
              current: data.current,
              total: data.total,
              status: data.status,
              currentStep: data.current_step,
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
  }, [fallbackMode, fileUuid, apiBaseUrl, progress.status, onComplete, onFail]);
  
  return {
    progress,
    wsStatus,
    connectionError,
    fallbackMode
  };
}; 