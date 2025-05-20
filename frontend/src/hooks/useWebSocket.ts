import { useState, useEffect, useRef, useCallback } from 'react';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

interface UseWebSocketOptions {
  url: string;
  onOpen?: (event: WebSocketEventMap['open']) => void;
  onMessage?: (event: WebSocketEventMap['message']) => void;
  onClose?: (event: WebSocketEventMap['close']) => void;
  onError?: (event: WebSocketEventMap['error']) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
  protocols?: string | string[];
}

export const useWebSocket = ({
  url,
  onOpen,
  onMessage,
  onClose,
  onError,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
  autoConnect = true,
  protocols,
}: UseWebSocketOptions) => {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  // 清理重連計時器
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // 連接WebSocket
  const connect = useCallback(() => {
    // 清理現有連接
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    try {
      setStatus('connecting');
      socketRef.current = new WebSocket(url, protocols);
      
      socketRef.current.onopen = (event) => {
        setStatus('connected');
        setReconnectCount(0);
        if (onOpen) onOpen(event);
      };
      
      socketRef.current.onmessage = (event) => {
        setLastMessage(event);
        if (onMessage) onMessage(event);
      };
      
      socketRef.current.onclose = (event) => {
        setStatus('disconnected');
        
        // 自動重連邏輯
        if (reconnectCount < reconnectAttempts) {
          setStatus('reconnecting');
          clearReconnectTimeout();
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setReconnectCount((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        }
        
        if (onClose) onClose(event);
      };
      
      socketRef.current.onerror = (event) => {
        setStatus('error');
        if (onError) onError(event);
      };
    } catch (error) {
      setStatus('error');
      console.error('WebSocket connection error:', error);
    }
  }, [url, protocols, onOpen, onMessage, onClose, onError, reconnectCount, reconnectAttempts, reconnectInterval, clearReconnectTimeout]);

  // 發送消息
  const sendMessage = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(data);
      return true;
    }
    return false;
  }, []);
  
  // 主動斷開連接
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('disconnected');
  }, [clearReconnectTimeout]);

  // 初始化連接
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    // 清理函數
    return () => {
      clearReconnectTimeout();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url, autoConnect, connect, clearReconnectTimeout]);

  return {
    status,
    lastMessage,
    reconnectCount,
    sendMessage,
    connect,
    disconnect
  };
}; 