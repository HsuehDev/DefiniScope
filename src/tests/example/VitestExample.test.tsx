/// <reference types="vitest" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 簡單的組件示例
function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <div data-testid="count">{count}</div>
      <button onClick={() => setCount(count + 1)}>增加</button>
    </div>
  );
}

describe('Vitest使用示例', () => {
  // beforeEach示例
  beforeEach(() => {
    // 清除所有模擬函數的調用記錄
    vi.clearAllMocks();
  });

  // afterEach示例
  afterEach(() => {
    // 如果需要，可以進行清理操作
  });

  // 基本測試
  it('基本斷言測試', () => {
    expect(1 + 1).toBe(2);
    expect({ name: 'vitest' }).toEqual({ name: 'vitest' });
    expect([1, 2, 3]).toContain(2);
  });

  // DOM測試
  it('渲染和交互測試', () => {
    render(<Counter />);
    
    // 獲取元素
    const countElement = screen.getByTestId('count');
    const buttonElement = screen.getByText('增加');
    
    // 初始狀態檢查
    expect(countElement).toHaveTextContent('0');
    
    // 模擬用戶操作
    fireEvent.click(buttonElement);
    
    // 檢查結果
    expect(countElement).toHaveTextContent('1');
  });

  // 模擬函數示例
  it('模擬函數測試', () => {
    const mockFn = vi.fn();
    mockFn();
    mockFn(1, 2);
    
    // 檢查調用次數
    expect(mockFn).toHaveBeenCalledTimes(2);
    
    // 檢查調用參數
    expect(mockFn).toHaveBeenCalledWith(1, 2);
  });

  // 模擬返回值示例
  it('模擬返回值測試', () => {
    const mockFn = vi.fn()
      .mockReturnValueOnce('第一次調用')
      .mockReturnValueOnce('第二次調用');
    
    expect(mockFn()).toBe('第一次調用');
    expect(mockFn()).toBe('第二次調用');
  });

  // 模擬實現示例
  it('模擬實現測試', () => {
    const mockFn = vi.fn().mockImplementation((a, b) => a + b);
    
    expect(mockFn(2, 3)).toBe(5);
  });

  // 模擬模塊示例
  it('模擬模塊測試', () => {
    // 模擬整個模塊
    vi.mock('axios', () => ({
      default: {
        get: vi.fn().mockResolvedValue({ data: 'mocked data' })
      }
    }));
    
    // 使用被模擬的模塊
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axios = require('axios').default;
    expect(axios.get).toBeDefined();
  });

  // 模擬定時器示例
  it('模擬定時器測試', () => {
    // 模擬定時器
    vi.useFakeTimers();
    
    const callback = vi.fn();
    setTimeout(callback, 1000);
    
    // 快進時間
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
    
    // 恢復真實定時器
    vi.useRealTimers();
  });

  // 非同步測試示例
  it('異步測試', async () => {
    const asyncFunc = () => Promise.resolve('成功');
    
    await expect(asyncFunc()).resolves.toBe('成功');
  });
}); 