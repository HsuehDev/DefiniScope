/**
 * 效能監控工具
 * 
 * 提供Web Vitals指標收集、性能標記和效能分析功能
 */

import { ReportHandler } from 'web-vitals';

/**
 * 收集Web Vitals核心指標
 * 
 * @param onPerfEntry 指標收集回調函數
 */
export const reportWebVitals = (onPerfEntry?: ReportHandler): void => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry); // Cumulative Layout Shift
      getFID(onPerfEntry); // First Input Delay
      getFCP(onPerfEntry); // First Contentful Paint
      getLCP(onPerfEntry); // Largest Contentful Paint
      getTTFB(onPerfEntry); // Time to First Byte
    });
  }
};

/**
 * 創建性能標記工具
 * 
 * @param category 分類名稱，用於標識不同類型的標記
 * @returns 標記相關函數
 */
export const createPerformanceTracker = (category: string) => {
  return {
    /**
     * 開始計時
     * 
     * @param label 標記標籤
     */
    start: (label: string): void => {
      const markName = `${category}-${label}-start`;
      performance.mark(markName);
    },

    /**
     * 結束計時
     * 
     * @param label 標記標籤
     * @param sendToAnalytics 是否發送到分析系統
     */
    end: (label: string, sendToAnalytics: boolean = false): number => {
      const startMarkName = `${category}-${label}-start`;
      const endMarkName = `${category}-${label}-end`;
      const measureName = `${category}-${label}`;

      // 標記結束時間
      performance.mark(endMarkName);

      // 確保開始標記存在
      const startMarkExists = performance.getEntriesByName(startMarkName).length > 0;
      if (!startMarkExists) {
        console.warn(`開始標記 ${startMarkName} 不存在`);
        return 0;
      }

      // 測量區間時間
      performance.measure(measureName, startMarkName, endMarkName);

      // 獲取測量結果
      const measures = performance.getEntriesByName(measureName, 'measure');
      const duration = measures.length > 0 ? measures[0].duration : 0;

      // 發送到分析系統
      if (sendToAnalytics && duration > 0) {
        logPerformanceMetric({
          category,
          label,
          duration,
          timestamp: Date.now()
        });
      }

      // 清理標記
      performance.clearMarks(startMarkName);
      performance.clearMarks(endMarkName);
      performance.clearMeasures(measureName);

      return duration;
    }
  };
};

/**
 * 記錄性能指標
 * 
 * @param metric 性能指標數據
 */
interface PerformanceMetric {
  category: string;
  label: string;
  duration: number;
  timestamp: number;
}

export const logPerformanceMetric = (metric: PerformanceMetric): void => {
  // 在控制台輸出
  console.log(`Performance: ${metric.category} - ${metric.label}: ${metric.duration.toFixed(2)}ms`);
  
  // 在生產環境發送到服務器
  if (process.env.NODE_ENV === 'production') {
    // 避免發送頻率過高，僅記錄較慢的操作
    if (metric.duration > 100) {
      try {
        fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metric),
          // 使用 keepalive 確保頁面卸載時數據也能發送
          keepalive: true
        });
      } catch (error) {
        console.error('Failed to send performance metric:', error);
      }
    }
  }
};

/**
 * 檢測組件渲染時間的 Profiler 回調
 * 
 * @param id 組件 ID
 * @param phase 渲染階段
 * @param actualDuration 實際渲染時間
 * @param baseDuration 基準渲染時間
 * @param startTime 開始時間
 * @param commitTime 提交時間
 */
export const profileRenderPerformance = (
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
): void => {
  // 設定閾值：16.67ms 大致是 60fps 的每幀時間
  const threshold = 16.67;
  
  // 只關注超過閾值的渲染
  if (actualDuration > threshold) {
    console.warn(
      `慢速渲染檢測: ${id} (${phase}) - 實際: ${actualDuration.toFixed(2)}ms, ` +
      `基準: ${baseDuration.toFixed(2)}ms`
    );
    
    // 記錄到性能指標
    logPerformanceMetric({
      category: 'render',
      label: `${id}-${phase}`,
      duration: actualDuration,
      timestamp: commitTime
    });
  }
};

/**
 * 預加載資源
 * 
 * @param urls 要預加載的資源 URL 列表
 * @param type 資源類型
 */
export const preloadResources = (
  urls: string[],
  type: 'preload' | 'prefetch' = 'preload'
): void => {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = type;
    link.href = url;
    
    // 設置資源類型
    if (url.endsWith('.js')) {
      link.as = 'script';
    } else if (url.endsWith('.css')) {
      link.as = 'style';
    } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(url)) {
      link.as = 'image';
    } else if (/\.(woff|woff2|ttf|otf)$/i.test(url)) {
      link.as = 'font';
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  });
};

export default {
  reportWebVitals,
  createPerformanceTracker,
  logPerformanceMetric,
  profileRenderPerformance,
  preloadResources
}; 