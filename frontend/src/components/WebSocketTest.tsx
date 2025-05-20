import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getAccessToken } from '../services/auth/authService';

const WebSocketTest: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [wsUrl, setWsUrl] = useState<string>('/ws/test');
  
  // 使用 WebSocket 連接
  const { connected, connecting, error, sendMessage } = useWebSocket({
    url: wsUrl,
    onOpen: () => {
      addLog('WebSocket 連接已建立');
    },
    onMessage: (event) => {
      addLog(`收到消息: ${JSON.stringify(event)}`);
    },
    onClose: () => {
      addLog('WebSocket 連接已關閉');
    },
    onError: (e) => {
      addLog(`WebSocket 錯誤: ${e}`);
    },
  });
  
  // 添加日誌
  const addLog = (log: string) => {
    setLogs((prevLogs) => [...prevLogs, `${new Date().toLocaleTimeString()}: ${log}`]);
  };
  
  // 處理發送消息
  const handleSendMessage = () => {
    if (message.trim() && connected) {
      sendMessage({ type: 'ping', message });
      addLog(`發送消息: ${message}`);
      setMessage('');
    }
  };
  
  // 顯示網絡和連接資訊
  const getConnectionInfo = () => {
    const connectionInfo: string[] = [];
    
    // 檢查網絡連接
    if (navigator.onLine) {
      connectionInfo.push('網絡狀態: 已連接');
    } else {
      connectionInfo.push('網絡狀態: 未連接');
    }
    
    // 拿到當前頁面URL
    connectionInfo.push(`頁面URL: ${window.location.href}`);
    
    // 檢查當前協議
    connectionInfo.push(`當前協議: ${window.location.protocol}`);
    
    // 計算WebSocket完整URL
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss://' : 'ws://';
    const host = window.location.host;
    const fullWsUrl = wsUrl.startsWith('ws') ? wsUrl : `${wsProtocol}${host}${wsUrl.startsWith('/') ? wsUrl : '/' + wsUrl}`;
    connectionInfo.push(`WebSocket完整URL: ${fullWsUrl}`);
    
    return connectionInfo;
  };
  
  // 顯示 Token
  useEffect(() => {
    const token = getAccessToken();
    addLog(`當前 Token: ${token ? '已存在' : '不存在'}`);
    
    // 添加連接信息
    getConnectionInfo().forEach(info => addLog(info));
  }, []);
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">WebSocket 測試</h2>
      
      <div className="mb-4">
        <label className="block mb-2">WebSocket URL:</label>
        <div className="flex">
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <button 
            onClick={() => window.location.reload()}
            className="ml-2 bg-blue-500 text-white p-2 rounded"
          >
            重新連接
          </button>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          提示: 使用相對路徑 (例如 "/ws/test") 或絕對路徑 (例如 "ws://localhost:8000/ws/test")
        </div>
      </div>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">連接狀態:</h3>
        <div className="flex items-center mb-2">
          <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{connected ? '已連接' : connecting ? '連接中...' : '未連接'}</span>
        </div>
        
        {error && (
          <div className="text-red-500 mb-2">{`錯誤: ${error}`}</div>
        )}
        
        <div className="text-sm mt-2">
          <div><strong>認證狀態:</strong> {getAccessToken() ? '已認證' : '未認證'}</div>
          {getConnectionInfo().map((info, index) => (
            <div key={index}>{info}</div>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block mb-2">發送消息:</label>
        <div className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 p-2 border rounded-l"
            disabled={!connected}
          />
          <button
            onClick={handleSendMessage}
            className="bg-blue-500 text-white p-2 rounded-r"
            disabled={!connected || !message.trim()}
          >
            發送
          </button>
        </div>
      </div>
      
      <div>
        <h3 className="font-bold mb-2">日誌:</h3>
        <div className="border p-2 rounded h-64 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest; 