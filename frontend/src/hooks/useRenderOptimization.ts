import { 
  useRef, 
  useMemo, 
  useCallback, 
  useEffect, 
  useState, 
  DependencyList 
} from 'react';
import { createPerformanceTracker } from '../utils/performance';

// 創建渲染效能追踪器
const renderPerformance = createPerformanceTracker('render');

/**
 * 增強版 useMemo，帶有效能追踪功能
 * 
 * @param factory 工廠函數
 * @param deps 依賴數組
 * @param debugLabel 調試標籤，用於性能追踪
 * @returns 記憶化的值
 */
export function useTrackedMemo<T>(
  factory: () => T, 
  deps: DependencyList, 
  debugLabel?: string
): T {
  // 使用標準 useMemo 進行記憶
  return useMemo(() => {
    // 如果提供了調試標籤，則進行性能追踪
    if (debugLabel && process.env.NODE_ENV !== 'production') {
      renderPerformance.start(`memo-${debugLabel}`);
      const result = factory();
      const duration = renderPerformance.end(`memo-${debugLabel}`);
      
      // 如果計算時間超過閾值，則記錄警告
      if (duration > 5) {
        console.warn(`[Slow Memo] ${debugLabel}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    }
    
    return factory();
  }, deps);
}

/**
 * 增強版 useCallback，帶有效能追踪功能
 * 
 * @param callback 回調函數
 * @param deps 依賴數組
 * @param debugLabel 調試標籤
 * @returns 記憶化的回調函數
 */
export function useTrackedCallback<T extends (...args: any[]) => any>(
  callback: T, 
  deps: DependencyList, 
  debugLabel?: string
): T {
  // 追踪調用次數
  const callCountRef = useRef(0);
  
  // 使用標準 useCallback 進行記憶
  return useCallback((...args: Parameters<T>) => {
    // 增加調用計數
    callCountRef.current += 1;
    
    // 如果提供了調試標籤，則進行性能追踪
    if (debugLabel && process.env.NODE_ENV !== 'production') {
      renderPerformance.start(`callback-${debugLabel}`);
      const result = callback(...args);
      const duration = renderPerformance.end(`callback-${debugLabel}`);
      
      // 如果執行時間超過閾值，則記錄警告
      if (duration > 10) {
        console.warn(
          `[Slow Callback] ${debugLabel} (calls: ${callCountRef.current}): ${duration.toFixed(2)}ms`
        );
      }
      
      return result;
    }
    
    return callback(...args);
  }, deps) as T;
}

/**
 * 防抖Hook，避免短時間內多次調用函數
 * 
 * @param callback 需要防抖的函數
 * @param delay 延遲時間（毫秒）
 * @param deps 依賴數組
 * @returns 防抖處理後的函數
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T, 
  delay: number, 
  deps: DependencyList = []
): T {
  const timerRef = useRef<number | undefined>();
  
  // 清理定時器
  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  return useCallback((...args: Parameters<T>) => {
    // 清除先前的定時器
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
    }
    
    // 設置新的定時器
    timerRef.current = window.setTimeout(() => {
      callback(...args);
    }, delay);
  }, [...deps, delay]) as T;
}

/**
 * 節流Hook，限制函數在指定時間內最多調用一次
 * 
 * @param callback 需要節流的函數
 * @param limit 時間限制（毫秒）
 * @param deps 依賴數組
 * @returns 節流處理後的函數
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T, 
  limit: number, 
  deps: DependencyList = []
): T {
  const lastCallTimeRef = useRef(0);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const timeoutRef = useRef<number | undefined>();
  
  // 清理定時器
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    
    // 存儲最新的參數
    lastArgsRef.current = args;
    
    // 如果從上次調用到現在的時間大於限制
    if (timeSinceLastCall >= limit) {
      lastCallTimeRef.current = now;
      callback(...args);
    } else {
      // 否則設置定時器在限制時間結束後調用
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      
      const remainingTime = limit - timeSinceLastCall;
      timeoutRef.current = window.setTimeout(() => {
        lastCallTimeRef.current = Date.now();
        if (lastArgsRef.current) {
          callback(...lastArgsRef.current);
        }
      }, remainingTime);
    }
  }, [...deps, limit]) as T;
}

/**
 * 避免頻繁重渲染的Hook，僅當值變更超過指定閾值時更新
 * 
 * @param value 原始值
 * @param options 配置選項
 * @returns 穩定化後的值
 */
export function useStableValue<T>(
  value: T, 
  options: {
    threshold?: number;           // 數值類型的變更閾值
    isEqual?: (a: T, b: T) => boolean; // 自定義比較函數
    wait?: number;               // 最小更新間隔（毫秒）
  } = {}
): T {
  const { 
    threshold = 0, 
    isEqual = Object.is, 
    wait = 0 
  } = options;
  
  const [stableValue, setStableValue] = useState(value);
  const lastUpdateTimeRef = useRef(0);
  const lastValueRef = useRef(value);
  
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    lastValueRef.current = value;
    
    // 如果是數值且設置了閾值
    if (
      typeof value === 'number' && 
      typeof stableValue === 'number' && 
      threshold > 0
    ) {
      // 只有當值變化超過閾值，且滿足最小更新間隔時才更新
      if (
        Math.abs(value - stableValue) >= threshold && 
        timeSinceLastUpdate >= wait
      ) {
        setStableValue(value);
        lastUpdateTimeRef.current = now;
      }
    } 
    // 否則使用自定義比較函數
    else if (!isEqual(value, stableValue) && timeSinceLastUpdate >= wait) {
      setStableValue(value);
      lastUpdateTimeRef.current = now;
    }
  }, [value, stableValue, threshold, isEqual, wait]);
  
  return stableValue;
}

/**
 * 用於列表項的記憶化Hook，可自動為列表項生成穩定的key和記憶化
 * 
 * @param items 原始列表
 * @param itemKey 獲取列表項唯一鍵的函數
 * @param deps 額外的依賴數組
 * @returns 記憶化的項目映射，帶有穩定的key
 */
export function useMemoizedItems<T>(
  items: T[], 
  itemKey: (item: T) => string | number,
  deps: DependencyList = []
): { 
  itemsWithKeys: Array<T & { memoKey: string | number }>;
  getItemProps: (item: T) => { key: string | number };
} {
  // 記憶化列表項並添加穩定的key
  const itemsWithKeys = useMemo(() => {
    return items.map(item => ({
      ...item,
      memoKey: itemKey(item)
    }));
  }, [items, itemKey, ...deps]);
  
  // 獲取列表項props的函數
  const getItemProps = useCallback((item: T) => {
    return {
      key: itemKey(item)
    };
  }, [itemKey]);
  
  return { itemsWithKeys, getItemProps };
}

/**
 * 用於防止意外快速雙擊引發的重複操作
 * 
 * @param callback 要執行的函數
 * @param delay 防止重複的延遲時間（毫秒）
 * @param deps 依賴數組
 * @returns 加入防重複機制的回調函數
 */
export function usePreventDoubleClick<T extends (...args: any[]) => any>(
  callback: T, 
  delay: number = 300, 
  deps: DependencyList = []
): [(...args: Parameters<T>) => void, boolean] {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handler = useCallback((...args: Parameters<T>) => {
    if (isProcessing) {
      return;
    }
    
    setIsProcessing(true);
    callback(...args);
    
    setTimeout(() => {
      setIsProcessing(false);
    }, delay);
  }, [callback, delay, isProcessing, ...deps]);
  
  return [handler, isProcessing];
}

export default {
  useTrackedMemo,
  useTrackedCallback,
  useDebounce,
  useThrottle,
  useStableValue,
  useMemoizedItems,
  usePreventDoubleClick
}; 