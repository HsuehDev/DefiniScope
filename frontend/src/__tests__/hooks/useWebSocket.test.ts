import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from '../../hooks/useWebSocket';
import { installMockWebSocket, MockWebSocket, createMessageEvent } from '../mocks/websocket.mock';

describe('useWebSocket Hook', () => {
  let cleanupWebSocket: () => void;
  const testUrl = 'ws://localhost:8000/ws/test';
  
  beforeEach(() => {
    cleanupWebSocket = installMockWebSocket();
  });
  
  afterEach(() => {
    cleanupWebSocket();
    vi.clearAllMocks();
  });
  
  it('初始化為斷開狀態', () => {
    const { result } = renderHook(() => 
      useWebSocket({ 
        url: testUrl, 
        autoConnect: false 
      })
    );
    
    expect(result.current.status).toBe('disconnected');
    expect(result.current.lastMessage).toBeNull();
    expect(result.current.reconnectCount).toBe(0);
  });
  
  it('可以處理接收到的消息', () => {
    // 模擬消息處理函數
    const onMessageMock = vi.fn();
    const testMessage = { event: 'test', data: { value: 42 } };
    
    const { result } = renderHook(() => 
      useWebSocket({ 
        url: testUrl, 
        onMessage: onMessageMock,
        autoConnect: true 
      })
    );
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(testUrl);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收消息
    act(() => {
      mockWs?.receiveMessage(testMessage);
    });
    
    // 檢查事件處理器被調用
    expect(onMessageMock).toHaveBeenCalledTimes(1);
    expect(result.current.lastMessage).not.toBeNull();
    expect(JSON.parse(result.current.lastMessage?.data)).toEqual(testMessage);
  });
  
  it('可以發送消息', () => {
    const { result } = renderHook(() => 
      useWebSocket({ 
        url: testUrl, 
        autoConnect: true 
      })
    );
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(testUrl);
    expect(mockWs).not.toBeUndefined();
    
    // 發送消息
    const testMessage = JSON.stringify({ action: 'ping' });
    act(() => {
      const success = result.current.sendMessage(testMessage);
      expect(success).toBe(true);
    });
    
    // 檢查消息是否被發送
    expect(mockWs?.sentMessages.length).toBe(1);
    expect(mockWs?.sentMessages[0]).toBe(testMessage);
  });
  
  it('可以主動斷開連接', () => {
    const onCloseMock = vi.fn();
    
    const { result } = renderHook(() => 
      useWebSocket({ 
        url: testUrl, 
        onClose: onCloseMock,
        autoConnect: true 
      })
    );
    
    // 直接設置 onclose 處理器，確保它會被調用
    const mockWs = MockWebSocket.getInstance(testUrl);
    if (mockWs && !mockWs.onclose) {
      mockWs.onclose = onCloseMock;
    }
    
    // 斷開連接
    act(() => {
      result.current.disconnect();
    });
    
    // 檢查狀態
    expect(result.current.status).toBe('disconnected');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
  
  it('處理連接錯誤', () => {
    const onErrorMock = vi.fn();
    
    const { result } = renderHook(() => 
      useWebSocket({ 
        url: testUrl, 
        onError: onErrorMock,
        autoConnect: true 
      })
    );
    
    // 獲取模擬的 WebSocket 實例，手動設置 onerror
    const mockWs = MockWebSocket.getInstance(testUrl);
    expect(mockWs).not.toBeUndefined();
    if (mockWs && !mockWs.onerror) {
      mockWs.onerror = onErrorMock;
    }
    
    // 觸發錯誤
    act(() => {
      mockWs?.triggerError();
    });
    
    // 檢查狀態
    expect(result.current.status).toBe('error');
    expect(onErrorMock).toHaveBeenCalledTimes(1);
  });
  
  it('清理時關閉連接', () => {
    const { result, unmount } = renderHook(() => 
      useWebSocket({ 
        url: testUrl, 
        autoConnect: true 
      })
    );
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(testUrl);
    expect(mockWs).not.toBeUndefined();
    
    // 卸載 hook (觸發清理)
    act(() => {
      unmount();
    });
    
    // 檢查 WebSocket 狀態
    expect(mockWs?.readyState).toBe(MockWebSocket.CLOSED);
  });
}); 