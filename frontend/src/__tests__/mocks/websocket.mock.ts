import { vi } from 'vitest';

// 創建一個模擬的 WebSocket 事件
const createWebSocketEvent = (type: string, data: any = {}): any => {
  const event = new Event(type);
  Object.assign(event, data);
  return event;
};

// 創建模擬的 MessageEvent
export const createMessageEvent = (data: any): MessageEvent => {
  return {
    data: typeof data === 'string' ? data : JSON.stringify(data),
    type: 'message',
    lastEventId: '',
    origin: 'ws://localhost',
    ports: [],
    source: null,
    currentTarget: null,
    target: null,
    srcElement: null,
    returnValue: true,
    cancelBubble: false,
    defaultPrevented: false,
    composed: false,
    bubbles: false,
    cancelable: false,
    eventPhase: 0,
    timeStamp: Date.now(),
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
    CAPTURING_PHASE: 1,
    NONE: 0,
    composedPath: () => [],
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    preventDefault: vi.fn(),
    initEvent: vi.fn(),
  } as unknown as MessageEvent;
};

// 模擬的 WebSocket 類
export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static clear() {
    this.instances = [];
  }
  
  // 靜態常量
  static readonly CONNECTING: number = 0;
  static readonly OPEN: number = 1;
  static readonly CLOSING: number = 2;
  static readonly CLOSED: number = 3;
  
  // WebSocket 標準屬性和方法
  url: string;
  protocol: string = '';
  readyState: number = MockWebSocket.CONNECTING;
  binaryType: BinaryType = 'blob';
  bufferedAmount: number = 0;
  extensions: string = '';
  
  // 添加 EventTarget 介面所需方法
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
  
  // 事件處理器
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  // 追踪發送的消息
  sentMessages: any[] = [];
  
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    if (protocols) {
      if (Array.isArray(protocols)) {
        this.protocol = protocols.join(', ');
      } else {
        this.protocol = protocols;
      }
    }
    MockWebSocket.instances.push(this);
    
    // 默認在下一個事件迴圈中自動連接，改為同步處理
    this.connect();
  }
  
  // 模擬連接
  connect() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(createWebSocketEvent('open'));
    }
  }
  
  // 模擬斷開連接
  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      const closeEvent = {
        code: code || 1000,
        reason: reason || '',
        wasClean: true,
        type: 'close',
        target: null,
        currentTarget: null,
        srcElement: null,
        cancelable: false,
        composed: false,
        defaultPrevented: false,
        eventPhase: 0,
        bubbles: false,
        returnValue: true,
        cancelBubble: false,
        timeStamp: Date.now(),
        AT_TARGET: 2,
        BUBBLING_PHASE: 3,
        CAPTURING_PHASE: 1,
        NONE: 0,
        composedPath: () => [],
        stopPropagation: vi.fn(),
        stopImmediatePropagation: vi.fn(),
        preventDefault: vi.fn(),
        initEvent: vi.fn()
      } as unknown as CloseEvent;
      this.onclose(closeEvent);
    }
  }
  
  // 模擬發送消息
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }
  
  // 模擬接收消息
  receiveMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
      this.onmessage(createMessageEvent(data));
    }
  }
  
  // 模擬錯誤
  triggerError() {
    if (this.onerror) {
      this.onerror(createWebSocketEvent('error'));
    }
  }
  
  // 靜態方法：查找指定 URL 的實例
  static getInstance(url: string): MockWebSocket | undefined {
    return this.instances.find(instance => instance.url === url);
  }
}

// 替代全局 WebSocket
export const installMockWebSocket = () => {
  // 儲存原始 WebSocket
  const OriginalWebSocket = global.WebSocket;
  
  // 替換為模擬的 WebSocket
  global.WebSocket = MockWebSocket as any;
  
  // 返回清理函數
  return () => {
    global.WebSocket = OriginalWebSocket;
    MockWebSocket.clear();
  };
}; 