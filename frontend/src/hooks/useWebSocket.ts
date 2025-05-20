import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketEvent } from '../components/chat/types';
import { getAccessToken } from '../services/auth/authService';

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
      
      // 獲取認證令牌並添加到URL
      const token = getAccessToken();
      
      // 修正 WebSocket URL 格式
      let fullUrl = url;
      
      // 確保URL以"ws:"或"wss:"開頭
      if (!url.startsWith('ws:') && !url.startsWith('wss:')) {
        // 確定當前協議
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 確定主機地址
        const host = window.location.host;
        
        // 如果是相對路徑，轉換為絕對路徑
        if (url.startsWith('/')) {
          fullUrl = `${protocol}//${host}${url}`;
        } else {
          fullUrl = `${protocol}//${host}/${url}`;
        }
      }
      
      // 添加認證令牌
      const wsUrlWithToken = token 
        ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${token}` 
        : fullUrl;
      
      console.log('正在連接WebSocket:', wsUrlWithToken);
      
      wsRef.current = new WebSocket(wsUrlWithToken);
      
      wsRef.current.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        if (onOpen) onOpen();
        console.log('WebSocket連接成功');
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
        console.log('WebSocket連接關閉');
        
        // 重新連接邏輯
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectIntervalRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            console.log(`嘗試重新連接 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            connect();
          }, reconnectInterval);
        }
      };
      
      wsRef.current.onerror = (err) => {
        setError(err);
        setConnecting(false);
        console.error('WebSocket連接錯誤:', err);
        if (onError) onError(err);
      };
    } catch (err) {
      setConnecting(false);
      setError(err as Event);
      console.error('WebSocket連接例外:', err);
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