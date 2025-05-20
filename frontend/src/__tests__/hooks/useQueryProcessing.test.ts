import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQueryProcessing } from '../../hooks/useQueryProcessing';
import { installMockWebSocket, MockWebSocket } from '../mocks/websocket.mock';
import { server } from '../setup';
import { rest } from 'msw';

const API_BASE_URL = 'http://localhost:8000';
const mockQueryUuid = 'test-query-uuid';

describe('useQueryProcessing Hook', () => {
  let cleanupWebSocket: () => void;
  
  beforeEach(() => {
    cleanupWebSocket = installMockWebSocket();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    cleanupWebSocket();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  
  it('初始狀態設置正確', () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    expect(result.current.progress).toEqual({
      status: 'pending',
      currentStep: '等待處理',
      progress: 0,
      keywords: [],
      foundDefinitions: { cd: 0, od: 0 },
      searchResults: {},
      referencedSentences: []
    });
    expect(result.current.fallbackMode).toBe(false);
    expect(result.current.connectionError).toBeNull();
  });
  
  it('處理 WebSocket query_processing_started 事件', async () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 query_processing_started 事件
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'query_processing_started',
        query_uuid: mockQueryUuid,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.status).toBe('processing');
    expect(result.current.progress.currentStep).toBe('查詢處理開始');
  });
  
  it('處理 WebSocket keyword_extraction_completed 事件', async () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 keyword_extraction_completed 事件
    const keywords = ['自適應專業知識', '認知發展'];
    
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'keyword_extraction_completed',
        query_uuid: mockQueryUuid,
        keywords,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.keywords).toEqual(keywords);
    expect(result.current.progress.currentStep).toBe('關鍵詞提取完成');
    expect(result.current.progress.progress).toBe(20);
  });
  
  it('處理 WebSocket database_search_progress 事件', async () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 database_search_progress 事件
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'database_search_progress',
        query_uuid: mockQueryUuid,
        keywords: ['自適應專業知識', '認知發展'],
        progress: 60,
        current_step: '正在搜尋資料庫中符合關鍵詞的定義',
        found_definitions: {
          cd: 3,
          od: 2
        },
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.progress).toBe(60);
    expect(result.current.progress.currentStep).toBe('正在搜尋資料庫中符合關鍵詞的定義');
    expect(result.current.progress.foundDefinitions).toEqual({ cd: 3, od: 2 });
  });
  
  it('處理 WebSocket database_search_result 事件', async () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 database_search_result 事件
    const keyword = '自適應專業知識';
    const foundSentences = [
      {
        sentence_uuid: 'sentence-1',
        file_uuid: 'file-1',
        original_name: 'example.pdf',
        sentence: '自適應專業知識是指...',
        page: 3,
        defining_type: 'cd',
        relevance_score: 0.92
      }
    ];
    
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'database_search_result',
        query_uuid: mockQueryUuid,
        keyword,
        found_sentences: foundSentences,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.searchResults[keyword]).toEqual(foundSentences);
  });
  
  it('處理 WebSocket answer_generation_started 事件', async () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 answer_generation_started 事件
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'answer_generation_started',
        query_uuid: mockQueryUuid,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.currentStep).toBe('開始生成答案');
    expect(result.current.progress.progress).toBe(80);
  });
  
  it('處理 WebSocket referenced_sentences 事件', async () => {
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 referenced_sentences 事件
    const referencedSentences = [
      {
        sentence_uuid: 'sentence-1',
        file_uuid: 'file-1',
        original_name: 'example.pdf',
        sentence: '自適應專業知識是指...',
        page: 3,
        defining_type: 'cd'
      },
      {
        sentence_uuid: 'sentence-2',
        file_uuid: 'file-1',
        original_name: 'example.pdf',
        sentence: '認知發展是指...',
        page: 5,
        defining_type: 'cd'
      }
    ];
    
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'referenced_sentences',
        query_uuid: mockQueryUuid,
        referenced_sentences: referencedSentences,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.referencedSentences).toEqual(referencedSentences);
  });
  
  it('處理 WebSocket query_completed 事件並調用回調', async () => {
    const onCompleteMock = vi.fn();
    
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      onComplete: onCompleteMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 query_completed 事件
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'query_completed',
        query_uuid: mockQueryUuid,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.status).toBe('completed');
    expect(result.current.progress.currentStep).toBe('查詢完成');
    expect(result.current.progress.progress).toBe(100);
    
    // 驗證回調被調用
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });
  
  it('處理 WebSocket query_failed 事件並調用回調', async () => {
    const onFailMock = vi.fn();
    const errorMessage = '查詢處理時發生錯誤';
    
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      onFail: onFailMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬接收 query_failed 事件
    await act(async () => {
      mockWs?.receiveMessage({
        event: 'query_failed',
        query_uuid: mockQueryUuid,
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      });
    });
    
    // 驗證狀態更新
    expect(result.current.progress.status).toBe('failed');
    expect(result.current.progress.currentStep).toBe('查詢失敗');
    expect(result.current.progress.errorMessage).toBe(errorMessage);
    
    // 驗證回調被調用
    expect(onFailMock).toHaveBeenCalledTimes(1);
    expect(onFailMock).toHaveBeenCalledWith(errorMessage);
  });
  
  it('處理 WebSocket 連接錯誤並切換到輪詢模式', async () => {
    // 設置 API 回應模擬
    server.use(
      rest.get(`${API_BASE_URL}/chat/queries/${mockQueryUuid}/progress`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            status: 'processing',
            current_step: '正在搜尋相關定義',
            progress: 65,
            keywords: ['自適應專業知識', '認知發展'],
            found_definitions: { cd: 3, od: 1 },
            error_message: null
          })
        );
      })
    );
    
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬 WebSocket 錯誤
    await act(async () => {
      mockWs?.triggerError();
    });
    
    // 驗證切換到輪詢模式
    expect(result.current.fallbackMode).toBe(true);
    expect(result.current.connectionError).not.toBeNull();
    
    // 模擬輪詢計時器觸發
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    
    // 驗證通過輪詢獲取的進度更新
    expect(result.current.progress.status).toBe('processing');
    expect(result.current.progress.currentStep).toBe('正在搜尋相關定義');
    expect(result.current.progress.progress).toBe(65);
    expect(result.current.progress.keywords).toEqual(['自適應專業知識', '認知發展']);
    expect(result.current.progress.foundDefinitions).toEqual({ cd: 3, od: 1 });
  });
  
  it('輪詢檢測到查詢完成時調用回調', async () => {
    const onCompleteMock = vi.fn();
    
    // 設置 API 回應模擬
    server.use(
      rest.get(`${API_BASE_URL}/chat/queries/${mockQueryUuid}/progress`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            status: 'completed',
            current_step: '查詢完成',
            progress: 100,
            keywords: ['自適應專業知識', '認知發展'],
            found_definitions: { cd: 5, od: 3 },
            error_message: null
          })
        );
      })
    );
    
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      onComplete: onCompleteMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬 WebSocket 錯誤
    await act(async () => {
      mockWs?.triggerError();
    });
    
    // 模擬輪詢計時器觸發
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    
    // 驗證通過輪詢獲取的進度更新
    expect(result.current.progress.status).toBe('completed');
    expect(result.current.progress.progress).toBe(100);
    
    // 驗證回調被調用
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });
  
  it('輪詢檢測到查詢失敗時調用回調', async () => {
    const onFailMock = vi.fn();
    const errorMessage = '查詢過程中發生錯誤';
    
    // 設置 API 回應模擬
    server.use(
      rest.get(`${API_BASE_URL}/chat/queries/${mockQueryUuid}/progress`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            status: 'failed',
            current_step: '查詢失敗',
            progress: 70,
            keywords: ['自適應專業知識', '認知發展'],
            found_definitions: { cd: 2, od: 1 },
            error_message: errorMessage
          })
        );
      })
    );
    
    const { result } = renderHook(() => useQueryProcessing({
      queryUuid: mockQueryUuid,
      onFail: onFailMock,
      apiBaseUrl: API_BASE_URL
    }));
    
    // 等待 WebSocket 連接
    await act(async () => {
      vi.runAllTimers();
    });
    
    // 獲取模擬的 WebSocket 實例
    const mockWs = MockWebSocket.getInstance(`ws://localhost:8000/ws/chat/${mockQueryUuid}`);
    expect(mockWs).not.toBeUndefined();
    
    // 模擬 WebSocket 錯誤
    await act(async () => {
      mockWs?.triggerError();
    });
    
    // 模擬輪詢計時器觸發
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    
    // 驗證通過輪詢獲取的進度更新
    expect(result.current.progress.status).toBe('failed');
    expect(result.current.progress.currentStep).toBe('查詢失敗');
    expect(result.current.progress.errorMessage).toBe(errorMessage);
    
    // 驗證回調被調用
    expect(onFailMock).toHaveBeenCalledTimes(1);
    expect(onFailMock).toHaveBeenCalledWith(errorMessage);
  });
}); 