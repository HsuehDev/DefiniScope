/**
 * 代碼拆分和懶加載測試工具
 * 用於測量React應用中代碼拆分和懶加載的效能
 */

/**
 * 代碼塊加載信息
 */
export interface ChunkLoadInfo {
  chunkId: string;
  chunkName: string | null;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
  status: 'success' | 'error';
  error?: Error;
}

/**
 * 懶加載信息監控配置
 */
export interface LazyLoadMonitorConfig {
  /** 是否輸出到控制台 */
  logToConsole?: boolean;
  /** 是否自動記錄所有chunk加載 */
  autoMonitorChunks?: boolean;
  /** 回調函數 */
  onChunkLoad?: (info: ChunkLoadInfo) => void;
}

// 存儲記錄的塊加載信息
let chunkLoadRecords: ChunkLoadInfo[] = [];

/**
 * 獲取所有記錄的塊加載信息
 */
export function getChunkLoadRecords(): ChunkLoadInfo[] {
  return [...chunkLoadRecords];
}

/**
 * 清除塊加載記錄
 */
export function clearChunkLoadRecords(): void {
  chunkLoadRecords = [];
}

/**
 * 初始化代碼拆分監控系統
 */
export function initCodeSplittingMonitor(config: LazyLoadMonitorConfig = {}): () => void {
  const { 
    logToConsole = true, 
    autoMonitorChunks = true,
    onChunkLoad 
  } = config;

  // 監控塊加載的函數
  function monitorChunkLoad() {
    // 用於獲取當前塊大小的工具函數
    function getChunkSize(chunkId: string): number {
      try {
        // 嘗試從webpack獲取塊資訊
        const webpackJsonp = (window as any)['webpackJsonp'] || 
                            (window as any)['webpackChunk_N_E'] || 
                            (window as any)['__webpack_chunks__'] ||
                            [];
                            
        // 檢查是否使用Webpack 5
        if (Array.isArray(webpackJsonp) && webpackJsonp[0] && Array.isArray(webpackJsonp[0])) {
          // webpack 5格式
          const chunk = webpackJsonp.find((chunk: any) => 
            chunk[0] && chunk[0].includes(chunkId)
          );
          
          if (chunk) {
            const chunkContent = JSON.stringify(chunk);
            return chunkContent.length;
          }
        } else if (typeof webpackJsonp.push === 'function') {
          // webpack 4格式
          const installedChunks = (window as any)['webpackJsonp'].c || {};
          if (installedChunks[chunkId]) {
            const chunkContent = JSON.stringify(installedChunks[chunkId]);
            return chunkContent.length;
          }
        }
        
        // 如果無法從webpack獲取，返回-1表示未知大小
        return -1;
      } catch (e) {
        console.error('Error getting chunk size:', e);
        return -1;
      }
    }

    // 獲取資源的大小
    async function getResourceSize(url: string): Promise<number> {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        return contentLength ? parseInt(contentLength, 10) : -1;
      } catch (e) {
        console.error('Error fetching resource size:', e);
        return -1;
      }
    }

    // 監聽資源加載，用於檢測JS塊
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      if (type === 'load' || type === 'DOMContentLoaded') {
        // 在頁面載入後，監聽資源加載
        setTimeout(() => {
          if (autoMonitorChunks) {
            const scripts = document.querySelectorAll('script[src]');
            scripts.forEach(async (script) => {
              const src = script.getAttribute('src');
              if (src && src.includes('chunk')) {
                const chunkId = src.split('/').pop()?.split('.')[0] || 'unknown';
                const startTime = performance.now(); // 估算，因為腳本可能已加載
                const size = await getResourceSize(src);
                const info: ChunkLoadInfo = {
                  chunkId,
                  chunkName: script.getAttribute('data-chunk-name') || null,
                  startTime,
                  endTime: performance.now(),
                  duration: 0, // 會在記錄前更新
                  size,
                  status: 'success'
                };
                info.duration = info.endTime - info.startTime;
                
                // 記錄塊加載
                recordChunkLoad(info);
              }
            });
          }
        }, 0);
      }
      return originalAddEventListener.call(this, type, listener as EventListener, options);
    };

    // 監聽動態導入
    // 替換原始的import函數來監控
    if (typeof window !== 'undefined') {
      const originalRequire = Object.getOwnPropertyDescriptor(window, '__webpack_require__');
      if (originalRequire && originalRequire.value && typeof originalRequire.value === 'function') {
        const originalEnsure = originalRequire.value.e;
        if (originalEnsure && typeof originalEnsure === 'function') {
          originalRequire.value.e = function(chunkId: string) {
            const startTime = performance.now();
            
            // 調用原始的ensure函數
            return originalEnsure.apply(this, [chunkId])
              .then((result: any) => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                const size = getChunkSize(chunkId);
                
                const info: ChunkLoadInfo = {
                  chunkId,
                  chunkName: null, // webpack不提供該信息
                  startTime,
                  endTime,
                  duration,
                  size,
                  status: 'success'
                };
                
                // 記錄塊加載
                recordChunkLoad(info);
                
                return result;
              })
              .catch((error: Error) => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                const info: ChunkLoadInfo = {
                  chunkId,
                  chunkName: null,
                  startTime,
                  endTime,
                  duration,
                  size: -1,
                  status: 'error',
                  error
                };
                
                // 記錄塊加載錯誤
                recordChunkLoad(info);
                
                throw error;
              });
          };
        }
      }
    }

    // 記錄塊加載資訊
    function recordChunkLoad(info: ChunkLoadInfo) {
      // 避免重複記錄
      if (!chunkLoadRecords.some(record => 
        record.chunkId === info.chunkId && 
        Math.abs(record.startTime - info.startTime) < 50
      )) {
        chunkLoadRecords.push(info);
        
        if (logToConsole) {
          console.group(`📦 Chunk Load: ${info.chunkId}`);
          console.log(`Duration: ${info.duration.toFixed(2)}ms`);
          console.log(`Size: ${info.size > 0 ? `${(info.size / 1024).toFixed(2)} KB` : 'Unknown'}`);
          console.log(`Status: ${info.status}`);
          if (info.error) {
            console.error('Error:', info.error);
          }
          console.groupEnd();
        }
        
        if (onChunkLoad) {
          onChunkLoad(info);
        }
      }
    }
  }

  // 啟動監控
  monitorChunkLoad();

  // 返回清理函數
  return () => {
    // 在這裡可以添加清理邏輯，例如恢復原始的addEventListener和webpack_require
    clearChunkLoadRecords();
  };
}

/**
 * 測量動態導入時間
 * @param importFn 動態導入函數
 * @param chunkId 可選的塊ID標識
 * @returns Promise 解析為加載時間（毫秒）和大小（字節）
 */
export async function measureDynamicImport<T>(
  importFn: () => Promise<T>, 
  chunkId?: string
): Promise<{ module: T; duration: number; size: number }> {
  const startTime = performance.now();
  let module: T;
  
  try {
    module = await importFn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // 嘗試獲取模塊大小
    let size = -1;
    if (chunkId) {
      // 如果提供了塊ID，從記錄中尋找塊大小
      const record = chunkLoadRecords.find(r => r.chunkId === chunkId);
      if (record) {
        size = record.size;
      }
    }
    
    return { module, duration, size };
  } catch (error) {
    console.error('Dynamic import error:', error);
    throw error;
  }
}

/**
 * 生成代碼拆分性能報告
 */
export function generateCodeSplittingReport(): {
  totalChunks: number;
  totalSize: number;
  averageDuration: number;
  maxDuration: number;
  smallestChunk: number;
  largestChunk: number;
  failedChunks: number;
  detailedRecords: ChunkLoadInfo[];
} {
  const records = getChunkLoadRecords();
  const validRecords = records.filter(r => r.status === 'success' && r.size > 0);
  
  // 計算統計數據
  const totalChunks = records.length;
  const totalSize = validRecords.reduce((sum, r) => sum + r.size, 0);
  const durations = validRecords.map(r => r.duration);
  const averageDuration = durations.length 
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
    : 0;
  const maxDuration = durations.length 
    ? Math.max(...durations) 
    : 0;
  
  const sizes = validRecords.map(r => r.size);
  const smallestChunk = sizes.length 
    ? Math.min(...sizes) 
    : 0;
  const largestChunk = sizes.length 
    ? Math.max(...sizes) 
    : 0;
  
  const failedChunks = records.filter(r => r.status === 'error').length;
  
  return {
    totalChunks,
    totalSize,
    averageDuration,
    maxDuration,
    smallestChunk,
    largestChunk,
    failedChunks,
    detailedRecords: [...records]
  };
}

/**
 * 生成代碼拆分性能報告
 */
export function generateChunkLoadReport(): {
  totalChunks: number;
  totalSize: number;
  totalLoadTime: number;
  averageLoadTime: number;
  largestChunk: string;
  largestChunkSize: number;
  slowestChunk: string;
  slowestLoadTime: number;
} {
  const report = generateCodeSplittingReport();
  
  return {
    totalChunks: report.totalChunks,
    totalSize: report.totalSize,
    totalLoadTime: report.averageDuration * report.totalChunks,
    averageLoadTime: report.averageDuration,
    largestChunk: findLargestChunk()?.chunkId || 'unknown',
    largestChunkSize: findLargestChunk()?.size || 0,
    slowestChunk: findSlowestChunk()?.chunkId || 'unknown',
    slowestLoadTime: findSlowestChunk()?.duration || 0
  };
}

/**
 * 查找最大的塊
 */
function findLargestChunk(): ChunkLoadInfo | undefined {
  const records = getChunkLoadRecords();
  if (records.length === 0) return undefined;
  
  let largest = records[0];
  for (const record of records) {
    if (record.size > largest.size) {
      largest = record;
    }
  }
  
  return largest;
}

/**
 * 查找加載最慢的塊
 */
function findSlowestChunk(): ChunkLoadInfo | undefined {
  const records = getChunkLoadRecords();
  if (records.length === 0) return undefined;
  
  let slowest = records[0];
  for (const record of records) {
    if (record.duration > slowest.duration) {
      slowest = record;
    }
  }
  
  return slowest;
}

export default {
  initCodeSplittingMonitor,
  measureDynamicImport,
  getChunkLoadRecords,
  clearChunkLoadRecords,
  generateCodeSplittingReport,
  generateChunkLoadReport
}; 