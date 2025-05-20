import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// 模擬網絡狀態變化
Object.defineProperty(window.navigator, 'onLine', {
  writable: true,
  value: true,
});

// 模擬 window.URL.createObjectURL 和 revokeObjectURL
const createObjectURLMock = vi.fn(() => 'mocked-object-url');
URL.createObjectURL = createObjectURLMock;
URL.revokeObjectURL = vi.fn();

// 模擬 ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 啟動 MSW 服務器 (在測試文件中設置處理程序)
export const server = setupServer();

// 在所有測試之前啟動 MSW 服務器
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// 每次測試後重置處理程序
afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// 所有測試完成後關閉 MSW 服務器
afterAll(() => server.close());

// 模擬定時器
vi.useFakeTimers(); 