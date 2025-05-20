import { CLSMetric, FIDMetric, LCPMetric, getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

/**
 * 性能指標閾值定義
 */
export const PERFORMANCE_THRESHOLDS = {
  LCP: 2500, // 良好: <= 2.5s
  FID: 100,  // 良好: <= 100ms
  CLS: 0.1,  // 良好: <= 0.1
  FCP: 1800, // 良好: <= 1.8s
  TTFB: 600  // 良好: <= 600ms
};

/**
 * 性能指標評分 (优良中差)
 */
export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

/**
 * 性能指標結果
 */
export interface MetricResult {
  name: string;
  value: number;
  rating: PerformanceRating;
  delta?: number;
  id?: string;
  navigationType?: string;
  valueFormatted?: string;
}

/**
 * 完整性能報告
 */
export interface PerformanceReport {
  metrics: Record<string, MetricResult>;
  timestamp: number;
  userAgent: string;
  url: string;
  deviceType: string;
  connectionType?: string;
  overallRating: PerformanceRating;
}

/**
 * 根據指標值確定評分
 */
function getRating(name: string, value: number): PerformanceRating {
  switch (name) {
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'FID':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'TTFB':
      return value <= 600 ? 'good' : value <= 1000 ? 'needs-improvement' : 'poor';
    default:
      return 'needs-improvement';
  }
}

/**
 * 格式化指標值為易讀形式
 */
function formatValue(name: string, value: number): string {
  switch (name) {
    case 'CLS':
      return value.toFixed(2);
    case 'FID':
    case 'LCP':
    case 'FCP':
    case 'TTFB':
      return `${value.toFixed(0)}ms`;
    default:
      return `${value}`;
  }
}

/**
 * 檢測裝置類型
 */
function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * 檢測網絡連接類型
 */
function getConnectionType(): string | undefined {
  const nav = navigator as any;
  if (nav.connection && typeof nav.connection === 'object' && 'effectiveType' in nav.connection) {
    return nav.connection.effectiveType;
  }
  return undefined;
}

/**
 * 整合所有性能指標，計算總體評分
 */
function calculateOverallRating(metrics: Record<string, MetricResult>): PerformanceRating {
  const ratings = Object.values(metrics).map(metric => metric.rating);
  
  if (ratings.includes('poor')) {
    return 'poor';
  }
  
  if (ratings.includes('needs-improvement')) {
    return 'needs-improvement';
  }
  
  return 'good';
}

/**
 * 性能報告回調函數類型
 */
export type PerformanceReportCallback = (report: PerformanceReport) => void;

/**
 * 初始化性能指標收集
 * @param onReport 收集完成後的回調函數
 * @param logToConsole 是否輸出到控制台
 */
export function initWebVitalsMonitoring(
  onReport?: PerformanceReportCallback,
  logToConsole = true
): void {
  const metrics: Record<string, MetricResult> = {};

  const handleMetric = ({ name, value, delta, id, navigationType, entries }: any) => {
    const metricName = name.toUpperCase();
    
    metrics[metricName] = {
      name: metricName,
      value,
      delta,
      id,
      navigationType,
      rating: getRating(metricName, value),
      valueFormatted: formatValue(metricName, value)
    };

    // 當所有核心指標都收集完成時生成報告
    if (['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].every(metric => metrics[metric])) {
      const report: PerformanceReport = {
        metrics,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        deviceType: getDeviceType(),
        connectionType: getConnectionType(),
        overallRating: calculateOverallRating(metrics)
      };

      if (logToConsole) {
        console.group('Web Vitals Report');
        console.log('📊 Performance Report:', report);
        console.table(
          Object.values(report.metrics).map(m => ({
            Metric: m.name,
            Value: m.valueFormatted,
            Rating: m.rating.toUpperCase()
          }))
        );
        console.log(`📱 Device: ${report.deviceType}`);
        if (report.connectionType) {
          console.log(`🌐 Network: ${report.connectionType}`);
        }
        console.log(`⭐ Overall: ${report.overallRating.toUpperCase()}`);
        console.groupEnd();
      }

      if (onReport) {
        onReport(report);
      }
    }
  };

  getCLS(handleMetric);
  getFID(handleMetric);
  getLCP(handleMetric);
  getFCP(handleMetric);
  getTTFB(handleMetric);
}

/**
 * 測量特定元素的渲染時間
 * @param selector DOM 選擇器
 * @returns Promise 解析為渲染時間（毫秒）
 */
export function measureElementRenderTime(selector: string): Promise<number> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        const endTime = performance.now();
        resolve(endTime - startTime);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 安全檢查：如果元素已經存在
    const existingElement = document.querySelector(selector);
    if (existingElement) {
      observer.disconnect();
      const endTime = performance.now();
      resolve(endTime - startTime);
    }
    
    // 超時處理
    setTimeout(() => {
      observer.disconnect();
      resolve(-1); // 返回-1表示超時
    }, 10000);
  });
}

/**
 * 測量交互響應時間
 * @param action 要執行的操作函數
 * @returns 操作執行時間（毫秒）
 */
export async function measureInteractionTime(action: () => Promise<void>): Promise<number> {
  const startTime = performance.now();
  await action();
  return performance.now() - startTime;
}

/**
 * 測量代碼拆分加載時間
 * @param importFn 動態導入函數
 * @returns Promise 解析為加載時間（毫秒）
 */
export async function measureDynamicImportTime<T>(importFn: () => Promise<T>): Promise<number> {
  const startTime = performance.now();
  await importFn();
  return performance.now() - startTime;
}

/**
 * 分析性能數據並生成簡短的性能改進建議
 */
export function generatePerformanceRecommendations(report: PerformanceReport): string[] {
  const recommendations: string[] = [];
  
  const { metrics } = report;
  
  if (metrics.LCP.rating !== 'good') {
    recommendations.push('改善最大內容繪製 (LCP): 優化圖片加載、實施預加載和懶加載策略、改善服務器響應時間');
  }
  
  if (metrics.FID.rating !== 'good') {
    recommendations.push('改善首次輸入延遲 (FID): 減少長任務、優化JavaScript執行時間、實施Web Worker');
  }
  
  if (metrics.CLS.rating !== 'good') {
    recommendations.push('改善累積布局偏移 (CLS): 為圖片和視頻指定尺寸、避免插入內容、使用transform進行動畫');
  }
  
  if (metrics.TTFB.rating !== 'good') {
    recommendations.push('改善首字節時間 (TTFB): 優化服務器響應時間、使用CDN、實施緩存策略');
  }
  
  if (metrics.FCP.rating !== 'good') {
    recommendations.push('改善首次內容繪製 (FCP): 優化關鍵渲染路徑、減少阻塞資源、優化CSS和JavaScript');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('所有核心指標表現良好。繼續監控性能，確保維持良好的用戶體驗。');
  }
  
  return recommendations;
}

/**
 * 性能指標收集函數
 */
export type WebVitalCallback = (metric: MetricResult) => void;

/**
 * 捕獲Web Vitals指標
 */
export function captureWebVitals(onMetric: WebVitalCallback): void {
  getCLS(metric => {
    const result: MetricResult = {
      name: 'CLS',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: getRating('CLS', metric.value),
      valueFormatted: formatValue('CLS', metric.value)
    };
    onMetric(result);
  });
  
  getFID(metric => {
    const result: MetricResult = {
      name: 'FID',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: getRating('FID', metric.value),
      valueFormatted: formatValue('FID', metric.value)
    };
    onMetric(result);
  });
  
  getLCP(metric => {
    const result: MetricResult = {
      name: 'LCP',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: getRating('LCP', metric.value),
      valueFormatted: formatValue('LCP', metric.value)
    };
    onMetric(result);
  });
  
  getFCP(metric => {
    const result: MetricResult = {
      name: 'FCP',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: getRating('FCP', metric.value),
      valueFormatted: formatValue('FCP', metric.value)
    };
    onMetric(result);
  });
  
  getTTFB(metric => {
    const result: MetricResult = {
      name: 'TTFB',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: getRating('TTFB', metric.value),
      valueFormatted: formatValue('TTFB', metric.value)
    };
    onMetric(result);
  });
}

/**
 * 生成Web Vitals報告
 */
export function generateWebVitalsReport(): PerformanceReport {
  // 由於Web Vitals是非同步收集的，這裡模擬報告
  // 在實際情況下，應該在captureWebVitals回調中積累數據並生成報告
  const mockMetrics: Record<string, MetricResult> = {
    LCP: {
      name: 'LCP',
      value: 2500,
      rating: 'needs-improvement',
      valueFormatted: '2500ms'
    },
    FID: {
      name: 'FID',
      value: 70,
      rating: 'good',
      valueFormatted: '70ms'
    },
    CLS: {
      name: 'CLS',
      value: 0.05,
      rating: 'good',
      valueFormatted: '0.05'
    },
    FCP: {
      name: 'FCP',
      value: 1200,
      rating: 'good',
      valueFormatted: '1200ms'
    },
    TTFB: {
      name: 'TTFB',
      value: 350,
      rating: 'good',
      valueFormatted: '350ms'
    }
  };
  
  return {
    metrics: mockMetrics,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    deviceType: getDeviceType(),
    connectionType: getConnectionType(),
    overallRating: calculateOverallRating(mockMetrics)
  };
}

export default {
  initWebVitalsMonitoring,
  measureElementRenderTime,
  measureInteractionTime,
  measureDynamicImportTime,
  generatePerformanceRecommendations,
  PERFORMANCE_THRESHOLDS,
  captureWebVitals,
  generateWebVitalsReport
}; 