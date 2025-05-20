/**
 * 前端性能測試套件
 * 整合所有性能測試工具，提供自動化測試和報告功能
 */

import { 
  PerformanceReport, 
  PERFORMANCE_THRESHOLDS, 
  captureWebVitals, 
  generateWebVitalsReport 
} from './WebVitalsTest';

import {
  initReactPerformanceMonitoring,
  withPerformanceTracking,
  RenderMetrics,
  generateRenderReport
} from './ReactPerformanceTest';

import {
  initCodeSplittingMonitor,
  getChunkLoadRecords,
  ChunkLoadInfo,
  generateChunkLoadReport
} from './CodeSplittingTest';

import {
  initInteractionMonitoring,
  measureSingleInteraction,
  InteractionMeasurement,
  generateInteractionReport
} from './InteractionPerformanceTest';

/**
 * 性能測試配置
 */
export interface PerformanceTestConfig {
  enableWebVitals?: boolean;
  enableReactTracking?: boolean;
  enableCodeSplittingTracking?: boolean;
  enableInteractionTracking?: boolean;
  logToConsole?: boolean;
  automaticReporting?: boolean;
  reportInterval?: number; // 毫秒
  thresholds?: {
    webVitals?: Partial<typeof PERFORMANCE_THRESHOLDS>;
    reactRender?: {
      maxRenderTime: number;
      maxRenderCount: number;
    };
    chunkLoad?: {
      maxChunkSize: number;
      maxLoadTime: number;
    };
    interaction?: {
      maxResponseTime: number;
      minResponsivePercentage: number;
    };
  };
}

/**
 * 性能測試結果
 */
export interface PerformanceTestResults {
  timestamp: number;
  url: string;
  userAgent: string;
  webVitals?: PerformanceReport;
  reactMetrics?: {
    components: Record<string, RenderMetrics>;
    summary: {
      totalComponents: number;
      totalRenderCount: number;
      averageRenderTime: number;
      slowestComponent: string;
      slowestRenderTime: number;
    };
  };
  codeSplitting?: {
    chunks: ChunkLoadInfo[];
    summary: {
      totalChunks: number;
      totalSize: number;
      totalLoadTime: number;
      averageLoadTime: number;
      largestChunk: string;
      largestChunkSize: number;
      slowestChunk: string;
      slowestLoadTime: number;
    };
  };
  interactions?: {
    details: InteractionMeasurement[];
    summary: ReturnType<typeof generateInteractionReport>;
  };
  overall: {
    performanceScore: number;
    issues: string[];
    recommendations: string[];
  };
}

// 默認配置
const DEFAULT_CONFIG: PerformanceTestConfig = {
  enableWebVitals: true,
  enableReactTracking: true,
  enableCodeSplittingTracking: true,
  enableInteractionTracking: true,
  logToConsole: true,
  automaticReporting: false,
  reportInterval: 30000, // 30秒
  thresholds: {
    webVitals: PERFORMANCE_THRESHOLDS,
    reactRender: {
      maxRenderTime: 16, // 16ms (60fps)
      maxRenderCount: 3  // 同一組件在單一操作中的最大重新渲染次數
    },
    chunkLoad: {
      maxChunkSize: 500000, // 500KB
      maxLoadTime: 300     // 300ms
    },
    interaction: {
      maxResponseTime: 100, // 100ms
      minResponsivePercentage: 90 // 90%的交互應該是響應式的
    }
  }
};

// 性能測試實例
let testInstance: PerformanceTestSuite | null = null;

/**
 * 性能測試套件類
 */
export class PerformanceTestSuite {
  private config: PerformanceTestConfig;
  private cleanupFunctions: Array<() => void> = [];
  private reportingInterval: number | null = null;
  private testStartTime: number;
  private testResults: Partial<PerformanceTestResults>;
  
  /**
   * 獲取當前測試實例（單例模式）
   */
  static getInstance(config: Partial<PerformanceTestConfig> = {}): PerformanceTestSuite {
    if (!testInstance) {
      testInstance = new PerformanceTestSuite(config);
    }
    return testInstance;
  }
  
  /**
   * 構造函數
   */
  private constructor(config: Partial<PerformanceTestConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.testStartTime = performance.now();
    this.testResults = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      overall: {
        performanceScore: 0,
        issues: [],
        recommendations: []
      }
    };
  }
  
  /**
   * 啟動性能測試
   */
  start(): PerformanceTestSuite {
    console.info('📊 Starting performance tests...');
    
    // 啟動Web Vitals監控
    if (this.config.enableWebVitals) {
      captureWebVitals((metric) => {
        console.debug(`Web Vital: ${metric.name} = ${metric.value}`);
      });
    }
    
    // 啟動React性能監控
    if (this.config.enableReactTracking) {
      const cleanup = initReactPerformanceMonitoring({
        logToConsole: this.config.logToConsole
      });
      this.cleanupFunctions.push(cleanup);
    }
    
    // 啟動代碼拆分監控
    if (this.config.enableCodeSplittingTracking) {
      const cleanup = initCodeSplittingMonitor({
        logToConsole: this.config.logToConsole,
        autoMonitorChunks: true
      });
      this.cleanupFunctions.push(cleanup);
    }
    
    // 啟動交互性能監控
    if (this.config.enableInteractionTracking) {
      const cleanup = initInteractionMonitoring({
        logToConsole: this.config.logToConsole,
        autoTrackInteractions: true
      });
      this.cleanupFunctions.push(cleanup);
    }
    
    // 設置自動報告
    if (this.config.automaticReporting && this.config.reportInterval) {
      this.reportingInterval = window.setInterval(() => {
        this.generateReport();
      }, this.config.reportInterval);
    }
    
    return this;
  }
  
  /**
   * 停止性能測試
   */
  stop(): PerformanceTestResults {
    console.info('📊 Stopping performance tests...');
    
    // 清理所有監控
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    
    // 清理定時器
    if (this.reportingInterval !== null) {
      window.clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }
    
    // 生成最終報告
    return this.generateReport();
  }
  
  /**
   * 測量特定操作的性能
   */
  async measureOperation(
    operationName: string, 
    operation: () => Promise<void> | void
  ): Promise<{
    duration: number;
    interactionMeasurement?: InteractionMeasurement;
    renderMetrics?: Record<string, RenderMetrics>;
    chunkLoads?: ChunkLoadInfo[];
  }> {
    const startTime = performance.now();
    
    // 測量交互
    let interactionMeasurement: InteractionMeasurement | undefined;
    if (this.config.enableInteractionTracking) {
      try {
        interactionMeasurement = await measureSingleInteraction(
          operation, 
          'custom',
          operationName
        );
      } catch (error) {
        // 僅執行操作，不進行交互測量
        await operation();
      }
    } else {
      // 僅執行操作
      await operation();
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (this.config.logToConsole) {
      console.group(`📊 Operation Measurement: ${operationName}`);
      console.log(`Duration: ${duration.toFixed(2)}ms`);
      console.groupEnd();
    }
    
    return {
      duration,
      interactionMeasurement,
      // 也可以獲取操作期間的其他指標...
    };
  }
  
  /**
   * 生成性能報告
   */
  generateReport(): PerformanceTestResults {
    // 更新測試結果
    const results = this.testResults as PerformanceTestResults;
    
    // 獲取Web Vitals報告
    if (this.config.enableWebVitals) {
      results.webVitals = generateWebVitalsReport();
    }
    
    // 獲取React渲染報告
    if (this.config.enableReactTracking) {
      const renderReport = generateRenderReport();
      results.reactMetrics = {
        components: renderReport.metrics,
        summary: {
          totalComponents: Object.keys(renderReport.metrics).length,
          totalRenderCount: Object.values(renderReport.metrics)
            .reduce((sum, m) => sum + (m as RenderMetrics).renderCount, 0),
          averageRenderTime: Object.values(renderReport.metrics)
            .reduce((sum, m) => sum + (m as RenderMetrics).averageRenderTime, 0) / 
              (Object.values(renderReport.metrics).length || 1),
          slowestComponent: Object.entries(renderReport.metrics)
            .reduce((slowest, [name, metrics]) => 
              (metrics as RenderMetrics).maxRenderTime > (slowest ? (renderReport.metrics[slowest] as RenderMetrics).maxRenderTime : 0) 
                ? name 
                : slowest
            , ''),
          slowestRenderTime: Object.values(renderReport.metrics)
            .reduce((max, m) => Math.max(max, (m as RenderMetrics).maxRenderTime), 0)
        }
      };
    }
    
    // 獲取代碼拆分報告
    if (this.config.enableCodeSplittingTracking) {
      const chunks = getChunkLoadRecords();
      const chunkReport = generateChunkLoadReport();
      
      results.codeSplitting = {
        chunks,
        summary: chunkReport
      };
    }
    
    // 獲取交互性能報告
    if (this.config.enableInteractionTracking) {
      const interactionReport = generateInteractionReport();
      
      results.interactions = {
        details: interactionReport.detailedMeasurements,
        summary: interactionReport
      };
    }
    
    // 計算總體性能分數和問題
    this.calculateOverallPerformance(results);
    
    // 輸出到控制台
    if (this.config.logToConsole) {
      this.logReportToConsole(results);
    }
    
    return results;
  }
  
  /**
   * 計算總體性能分數
   */
  private calculateOverallPerformance(results: PerformanceTestResults): void {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let totalScore = 100; // 初始分數100
    
    // 評估Web Vitals
    if (results.webVitals) {
      const { metrics, overallRating } = results.webVitals;
      
      if (overallRating === 'poor') {
        totalScore -= 30;
        issues.push('核心網頁指標性能較差');
      } else if (overallRating === 'needs-improvement') {
        totalScore -= 15;
        issues.push('核心網頁指標需要改進');
      }
      
      // 檢查各個指標
      if (metrics.LCP && metrics.LCP.rating === 'poor') {
        issues.push(`LCP (${metrics.LCP.valueFormatted}) 太慢，超過閾值`);
        recommendations.push('優化最大內容繪製時間: 減少渲染阻塞資源，優化圖片加載');
      }
      
      if (metrics.FID && metrics.FID.rating === 'poor') {
        issues.push(`FID (${metrics.FID.valueFormatted}) 太高，用戶輸入延遲嚴重`);
        recommendations.push('優化首次輸入延遲: 減少長任務，優化事件處理器');
      }
      
      if (metrics.CLS && metrics.CLS.rating === 'poor') {
        issues.push(`CLS (${metrics.CLS.valueFormatted}) 太高，頁面布局不穩定`);
        recommendations.push('減少累積布局偏移: 為圖像和視頻設置固定尺寸，避免動態注入內容');
      }
    }
    
    // 評估React渲染性能
    if (results.reactMetrics) {
      const { summary } = results.reactMetrics;
      const threshold = this.config.thresholds?.reactRender;
      
      if (threshold && summary.slowestRenderTime > threshold.maxRenderTime * 2) {
        totalScore -= 20;
        issues.push(`組件渲染時間過長 (${summary.slowestComponent}: ${summary.slowestRenderTime.toFixed(2)}ms)`);
        recommendations.push('優化緩慢組件: 使用React.memo，減少重渲染，考慮懶加載和虛擬列表');
      } else if (threshold && summary.slowestRenderTime > threshold.maxRenderTime) {
        totalScore -= 10;
        issues.push(`部分組件渲染時間超過閾值 (${summary.slowestRenderTime.toFixed(2)}ms > ${threshold.maxRenderTime}ms)`);
        recommendations.push('檢查緩慢組件的渲染性能，使用useMemo和useCallback減少不必要的重渲染');
      }
      
      if (summary.totalRenderCount > 100) {
        totalScore -= 10;
        issues.push(`渲染次數過多 (${summary.totalRenderCount})`);
        recommendations.push('減少組件重渲染: 檢查狀態更新邏輯，避免不必要的狀態變化');
      }
    }
    
    // 評估代碼拆分和懶加載
    if (results.codeSplitting) {
      const { summary } = results.codeSplitting;
      const threshold = this.config.thresholds?.chunkLoad;
      
      if (threshold && summary.largestChunkSize > threshold.maxChunkSize) {
        totalScore -= 10;
        issues.push(`代碼塊過大 (${summary.largestChunk}: ${(summary.largestChunkSize / 1024).toFixed(2)}KB)`);
        recommendations.push('優化代碼拆分: 減少大型包的大小，考慮更細粒度的懶加載');
      }
      
      if (threshold && summary.slowestLoadTime > threshold.maxLoadTime) {
        totalScore -= 10;
        issues.push(`代碼塊加載時間過長 (${summary.slowestChunk}: ${summary.slowestLoadTime.toFixed(2)}ms)`);
        recommendations.push('加速資源加載: 實現預加載策略，優化懶加載觸發時機');
      }
    }
    
    // 評估交互性能
    if (results.interactions) {
      const { summary } = results.interactions;
      const threshold = this.config.thresholds?.interaction;
      
      if (threshold && summary.averageDuration > threshold.maxResponseTime) {
        totalScore -= 15;
        issues.push(`交互響應時間過長 (平均 ${summary.averageDuration.toFixed(2)}ms)`);
        recommendations.push('提高交互響應速度: 優化事件處理器，避免在事件處理器中執行繁重計算');
      }
      
      if (threshold && summary.responsivePercentage < threshold.minResponsivePercentage) {
        totalScore -= 15;
        issues.push(`響應式交互比例過低 (${summary.responsivePercentage.toFixed(2)}%)`);
        recommendations.push('提高UI響應性: 使用節流和防抖動，將繁重計算移至Web Worker');
      }
      
      if (summary.totalLongTasks > 5) {
        totalScore -= 10;
        issues.push(`長任務過多 (${summary.totalLongTasks})`);
        recommendations.push('減少長任務: 將繁重計算拆分為小任務，使用requestIdleCallback');
      }
    }
    
    // 確保分數在0-100範圍內
    totalScore = Math.max(0, Math.min(100, totalScore));
    
    // 更新結果
    results.overall = {
      performanceScore: totalScore,
      issues,
      recommendations: [...new Set(recommendations)] // 去重
    };
  }
  
  /**
   * 將報告輸出到控制台
   */
  private logReportToConsole(results: PerformanceTestResults): void {
    console.group('📊 Performance Test Report');
    
    console.log(`📈 Overall Score: ${results.overall.performanceScore}/100`);
    
    if (results.overall.issues.length > 0) {
      console.group('⚠️ Issues');
      results.overall.issues.forEach(issue => console.log(`- ${issue}`));
      console.groupEnd();
    }
    
    if (results.overall.recommendations.length > 0) {
      console.group('💡 Recommendations');
      results.overall.recommendations.forEach(rec => console.log(`- ${rec}`));
      console.groupEnd();
    }
    
    if (results.webVitals) {
      console.group('🌐 Web Vitals');
      Object.entries(results.webVitals.metrics).forEach(([name, metric]) => {
        const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
        console.log(`${emoji} ${name}: ${metric.valueFormatted || metric.value}`);
      });
      console.groupEnd();
    }
    
    if (results.reactMetrics) {
      console.group('⚛️ React Performance');
      console.log(`Components: ${results.reactMetrics.summary.totalComponents}`);
      console.log(`Total Renders: ${results.reactMetrics.summary.totalRenderCount}`);
      console.log(`Average Render Time: ${results.reactMetrics.summary.averageRenderTime.toFixed(2)}ms`);
      console.log(`Slowest Component: ${results.reactMetrics.summary.slowestComponent} (${results.reactMetrics.summary.slowestRenderTime.toFixed(2)}ms)`);
      console.groupEnd();
    }
    
    if (results.codeSplitting) {
      console.group('📦 Code Splitting');
      console.log(`Total Chunks: ${results.codeSplitting.summary.totalChunks}`);
      console.log(`Total Size: ${(results.codeSplitting.summary.totalSize / 1024).toFixed(2)}KB`);
      console.log(`Average Load Time: ${results.codeSplitting.summary.averageLoadTime.toFixed(2)}ms`);
      console.log(`Largest Chunk: ${results.codeSplitting.summary.largestChunk} (${(results.codeSplitting.summary.largestChunkSize / 1024).toFixed(2)}KB)`);
      console.groupEnd();
    }
    
    if (results.interactions) {
      console.group('👆 Interactions');
      console.log(`Total Interactions: ${results.interactions.summary.totalInteractions}`);
      console.log(`Average Response Time: ${results.interactions.summary.averageDuration.toFixed(2)}ms`);
      console.log(`Responsive Interactions: ${results.interactions.summary.responsivePercentage.toFixed(2)}%`);
      console.log(`Long Tasks: ${results.interactions.summary.totalLongTasks}`);
      console.groupEnd();
    }
    
    console.groupEnd();
  }
  
  /**
   * 獲取測試結果
   */
  getResults(): PerformanceTestResults {
    return this.generateReport();
  }
  
  /**
   * 匯出測試結果為JSON
   */
  exportResultsAsJson(): string {
    return JSON.stringify(this.generateReport(), null, 2);
  }
}

/**
 * 快速啟動性能測試
 */
export function startPerformanceTest(config: Partial<PerformanceTestConfig> = {}): PerformanceTestSuite {
  return PerformanceTestSuite.getInstance(config).start();
}

/**
 * 停止性能測試
 */
export function stopPerformanceTest(): PerformanceTestResults {
  const instance = PerformanceTestSuite.getInstance();
  return instance.stop();
}

/**
 * 測量特定操作的性能
 */
export async function measureOperation(
  operationName: string, 
  operation: () => Promise<void> | void
): Promise<ReturnType<PerformanceTestSuite['measureOperation']>> {
  const instance = PerformanceTestSuite.getInstance();
  return instance.measureOperation(operationName, operation);
}

export default {
  startPerformanceTest,
  stopPerformanceTest,
  measureOperation,
  PerformanceTestSuite
}; 