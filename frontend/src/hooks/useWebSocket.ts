import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketEvent } from '../components/chat/types';

interface WebSocketHookOptions {
  url: string;
  onOpen?: () => void;
  onMessage?: (event: WebSocketEvent) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketHookResult {
  connected: boolean;
  connecting: boolean;
  error: Event | null;
  sendMessage: (data: any) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export const useWebSocket = ({
  url,
  onOpen,
  onMessage,
  onClose,
  onError,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5
}: WebSocketHookOptions): WebSocketHookResult => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectIntervalRef = useRef<number | null>(null);
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      setConnecting(true);
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        if (onOpen) onOpen();
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as WebSocketEvent;
          if (onMessage) onMessage(parsedData);
        } catch (e) {
          console.error('WebSocket 消息解析錯誤:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        setConnected(false);
        if (onClose) onClose();
        
        // 重新連接邏輯
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectIntervalRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, reconnectInterval);
        }
      };
      
      wsRef.current.onerror = (err) => {
        setError(err);
        setConnecting(false);
        if (onError) onError(err);
      };
    } catch (err) {
      setConnecting(false);
      setError(err as Event);
      if (onError) onError(err as Event);
    }
  }, [url, onOpen, onMessage, onClose, onError, reconnectInterval, maxReconnectAttempts]);
  
  const disconnect = useCallback(() => {
    if (reconnectIntervalRef.current) {
      clearTimeout(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);
  
  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.error('WebSocket 未連接，無法發送消息');
    }
  }, []);
  
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);
  
  // 初始連接
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    connected,
    connecting,
    error,
    sendMessage,
    disconnect,
    reconnect
  };
}; 