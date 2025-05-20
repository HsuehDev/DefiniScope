import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useFileProcessing } from '../../hooks/useFileProcessing';
import { installMockWebSocket, MockWebSocket } from '../mocks/websocket.mock';
import { server } from '../setup';
import { rest } from 'msw';

const API_BASE_URL = 'http://localhost:8000';
const mockFileUuid = 'test-file-uuid';

describe('useFileProcessing Hook', () => {
  let cleanupWebSocket: () => void;
  
  beforeEach(() => {
    cleanupWebSocket = installMockWebSocket();
  });
  
  afterEach(() => {
    cleanupWebSocket();
    vi.clearAllMocks();
  });
  
  it('初始狀態設置正確', () => {
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    expect(result.current.progress).toEqual({
      progress: 0,
      current: 0,
      total: 0,
      status: 'pending',
      currentStep: '等待處理',
      extractedSentences: [],
      classifiedSentences: []
    });
    expect(result.current.fallbackMode).toBe(false);
    expect(result.current.connectionError).toBeNull();
  });
  
  it('處理 WebSocket processing_started 事件', () => {
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 processing_started 事件
    act(() => {
      mockWs?.receiveMessage({
        event: 'processing_started',
        file_uuid: mockFileUuid,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.status).toBe('processing');
    expect(result.current.progress.currentStep).toBe('處理開始');
  });
  
  it('處理 WebSocket pdf_extraction_progress 事件', () => {
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 pdf_extraction_progress 事件
    act(() => {
      mockWs?.receiveMessage({
        event: 'pdf_extraction_progress',
        file_uuid: mockFileUuid,
        progress: 30,
        current: 3,
        total: 10,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.progress).toBe(30);
    expect(result.current.progress.current).toBe(3);
    expect(result.current.progress.total).toBe(10);
    expect(result.current.progress.currentStep).toBe('PDF 文本提取');
  });
  
  it('處理 WebSocket sentence_extraction_detail 事件', () => {
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 sentence_extraction_detail 事件
    const sentences = [
      {
        sentence_uuid: 'sentence-1',
        sentence: '這是第一個句子',
        defining_type: 'none',
        page: 1
      },
      {
        sentence_uuid: 'sentence-2',
        sentence: '這是第二個句子',
        defining_type: 'none',
        page: 1
      }
    ];
    
    act(() => {
      mockWs?.receiveMessage({
        event: 'sentence_extraction_detail',
        file_uuid: mockFileUuid,
        sentences,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.extractedSentences).toEqual(sentences);
  });
  
  it('處理 WebSocket sentence_classification_progress 事件', () => {
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 sentence_classification_progress 事件
    act(() => {
      mockWs?.receiveMessage({
        event: 'sentence_classification_progress',
        file_uuid: mockFileUuid,
        progress: 60,
        current: 6,
        total: 10,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.progress).toBe(60);
    expect(result.current.progress.current).toBe(6);
    expect(result.current.progress.total).toBe(10);
    expect(result.current.progress.currentStep).toBe('句子分類');
  });
  
  it('處理 WebSocket sentence_classification_detail 事件', () => {
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 sentence_classification_detail 事件
    const sentences = [
      {
        sentence_uuid: 'sentence-1',
        sentence: '概念型定義是指...',
        defining_type: 'cd',
        reason: '包含明確的定義',
        page: 1
      },
      {
        sentence_uuid: 'sentence-2',
        sentence: '操作型定義是指...',
        defining_type: 'od',
        reason: '包含操作性的解釋',
        page: 2
      }
    ];
    
    act(() => {
      mockWs?.receiveMessage({
        event: 'sentence_classification_detail',
        file_uuid: mockFileUuid,
        sentences,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.classifiedSentences).toEqual(sentences);
  });
  
  it('處理 WebSocket processing_completed 事件並調用回調', () => {
    const onCompleteMock = vi.fn();
    
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      onComplete: onCompleteMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 processing_completed 事件
    act(() => {
      mockWs?.receiveMessage({
        event: 'processing_completed',
        file_uuid: mockFileUuid,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.status).toBe('completed');
    expect(result.current.progress.currentStep).toBe('處理完成');
    expect(result.current.progress.progress).toBe(100);
    
    // 驗證回調被調用
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });
  
  it('處理 WebSocket processing_failed 事件並調用回調', () => {
    const onFailMock = vi.fn();
    const errorMessage = '檔案處理時發生錯誤';
    
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      onFail: onFailMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 processing_failed 事件
    act(() => {
      mockWs?.receiveMessage({
        event: 'processing_failed',
        file_uuid: mockFileUuid,
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.status).toBe('failed');
    expect(result.current.progress.currentStep).toBe('處理失敗');
    expect(result.current.progress.errorMessage).toBe(errorMessage);
    
    // 驗證回調被調用
    expect(onFailMock).toHaveBeenCalledTimes(1);
    expect(onFailMock).toHaveBeenCalledWith(errorMessage);
  });
  
  it('處理 WebSocket 連接錯誤並切換到輪詢模式', () => {
    // 設置 API 回應模擬
    server.use(
      rest.get(`${API_BASE_URL}/files/${mockFileUuid}/progress`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            progress: 65,
            current: 6,
            total: 10,
            status: 'processing',
            current_step: '正在處理第6頁',
            error_message: null
          })
        );
      })
    );
    
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬 WebSocket 錯誤
    act(() => {
      mockWs?.triggerError();
    });
    
    // 驗證切換到輪詢模式
    expect(result.current.fallbackMode).toBe(true);
    expect(result.current.connectionError).not.toBeNull();
  });
  
  it('輪詢檢測到處理完成時調用回調', () => {
    const onCompleteMock = vi.fn();
    
    // 設置 API 回應模擬
    server.use(
      rest.get(`${API_BASE_URL}/files/${mockFileUuid}/progress`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            progress: 100,
            current: 10,
            total: 10,
            status: 'completed',
            current_step: '處理完成',
            error_message: null
          })
        );
      })
    );
    
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      onComplete: onCompleteMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬 WebSocket 錯誤，觸發降級模式
    act(() => {
      mockWs?.triggerError();
    });
    
    // 驗證切換到輪詢模式
    expect(result.current.fallbackMode).toBe(true);
  });
  
  it('輪詢檢測到處理失敗時調用回調', () => {
    const onFailMock = vi.fn();
    const errorMessage = '檔案處理過程中發生錯誤';
    
    // 設置 API 回應模擬
    server.use(
      rest.get(`${API_BASE_URL}/files/${mockFileUuid}/progress`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            progress: 70,
            current: 7,
            total: 10,
            status: 'failed',
            current_step: '處理失敗',
            error_message: errorMessage
          })
        );
      })
    );
    
    const { result } = renderHook(() => useFileProcessing({
      fileUuid: mockFileUuid,
      onFail: onFailMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/processing/${mockFileUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬 WebSocket 錯誤，觸發降級模式
    act(() => {
      mockWs?.triggerError();
    });
    
    // 驗證切換到輪詢模式
    expect(result.current.fallbackMode).toBe(true);
  });
}); 