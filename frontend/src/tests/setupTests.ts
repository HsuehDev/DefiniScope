import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// 擴展Vitest的斷言函數，添加Testing Library自定義斷言
expect.extend(matchers);

// 每個測試後自動清理
afterEach(() => {
  cleanup();
});

// 全局設置
// 此檔案的內容會在Vitest運行前執行
// 可以在vitest.config.ts中配置testSetup參數指向此檔案

// 默認的超時時間設置為10秒
setTimeout(() => {}, 10 * 1000);

// 模擬Local Storage
class LocalStorageMock {
  store: Record<string, string>;
  
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

// 全局替換LocalStorage
Object.defineProperty(window, 'localStorage', {
  value: new LocalStorageMock(),
});

// 模擬Console.error，使測試中出現React錯誤時更明顯
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // 檢查是否為React的Warning或Error
  if (
    typeof args[0] === 'string' && 
    (args[0].includes('Warning:') || args[0].includes('Error:'))
  ) {
    // 拋出錯誤而不是僅僅輸出到控制台
    throw new Error(args.join(' '));
  }
  originalConsoleError(...args);
}; 