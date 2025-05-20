import React, { ComponentType, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * 渲染效能數據
 */
export interface RenderMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  lastRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
}

/**
 * 渲染效能數據日誌
 */
export interface RenderMetricsLog {
  metrics: Record<string, RenderMetrics>;
  timestamp: number;
}

/**
 * 渲染效能報告回調
 */
export type RenderMetricsReportCallback = (metrics: RenderMetricsLog) => void;

// 全局渲染指標記錄
const renderMetrics: Record<string, RenderMetrics> = {};

/**
 * 記錄組件渲染時間
 * @param id 組件ID
 * @param phase 渲染階段
 * @param actualDuration 實際渲染時間
 * @param baseDuration 基準渲染時間
 */
function logRenderMetric(
  id: string,
  phase: string,
  actualDuration: number,
  baseDuration: number
): void {
  if (!renderMetrics[id]) {
    renderMetrics[id] = {
      componentName: id,
      renderCount: 0,
      totalRenderTime: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      maxRenderTime: actualDuration,
      minRenderTime: actualDuration
    };
  }

  const metric = renderMetrics[id];
  metric.renderCount += 1;
  metric.lastRenderTime = actualDuration;
  metric.totalRenderTime += actualDuration;
  metric.averageRenderTime = metric.totalRenderTime / metric.renderCount;
  metric.maxRenderTime = Math.max(metric.maxRenderTime, actualDuration);
  metric.minRenderTime = Math.min(metric.minRenderTime, actualDuration);
}

/**
 * 獲取當前的渲染效能報告
 */
export function getRenderMetricsReport(): RenderMetricsLog {
  return {
    metrics: { ...renderMetrics },
    timestamp: Date.now()
  };
}

/**
 * 清除渲染效能指標記錄
 */
export function clearRenderMetrics(): void {
  Object.keys(renderMetrics).forEach(key => {
    delete renderMetrics[key];
  });
}

/**
 * 性能分析器屬性
 */
interface PerformanceProfilerProps {
  id: string;
  children: ReactNode;
  onReport?: (metrics: RenderMetrics) => void;
}

/**
 * 性能分析器組件
 * 使用React Profiler API測量組件渲染效能
 */
export function PerformanceProfiler({ id, children, onReport }: PerformanceProfilerProps): React.ReactElement {
  const handleRender = useCallback(
    (
      profilerId: string,
      phase: string,
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      logRenderMetric(profilerId, phase, actualDuration, baseDuration);
      
      if (onReport && renderMetrics[profilerId]) {
        onReport(renderMetrics[profilerId]);
      }
    },
    [onReport]
  );

  return (
    <React.Profiler id={id} onRender={handleRender}>
      {children}
    </React.Profiler>
  );
}

/**
 * 监控间隔设置（毫秒）
 */
const MONITOR_INTERVAL = 5000;

/**
 * 渲染效能監控上下文屬性
 */
interface RenderPerformanceMonitorContextProps {
  children: ReactNode;
  onReport?: RenderMetricsReportCallback;
  monitorInterval?: number;
  logToConsole?: boolean;
}

/**
 * 渲染效能監控上下文
 * 定期收集和報告組件渲染效能數據
 */
export function RenderPerformanceMonitorContext({
  children,
  onReport,
  monitorInterval = MONITOR_INTERVAL,
  logToConsole = true
}: RenderPerformanceMonitorContextProps): React.ReactElement {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      const report = getRenderMetricsReport();
      
      if (logToConsole) {
        console.group('🔍 React Render Performance Report');
        console.table(
          Object.values(report.metrics).map(m => ({
            Component: m.componentName,
            'Render Count': m.renderCount,
            'Avg Time (ms)': m.averageRenderTime.toFixed(2),
            'Last Time (ms)': m.lastRenderTime.toFixed(2),
            'Max Time (ms)': m.maxRenderTime.toFixed(2)
          }))
        );
        console.groupEnd();
      }
      
      if (onReport) {
        onReport(report);
      }
    }, monitorInterval);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [onReport, monitorInterval, logToConsole]);

  return <>{children}</>;
}

/**
 * 高階組件：带性能分析器的組件
 */
export function withPerformanceProfiler<P extends object>(
  Component: ComponentType<P>,
  options: { id?: string; onReport?: (metrics: RenderMetrics) => void } = {}
): React.FC<P> {
  const { id = Component.displayName || Component.name, onReport } = options;
  
  const ProfiledComponent: React.FC<P> = (props) => (
    <PerformanceProfiler id={id} onReport={onReport}>
      <Component {...props} />
    </PerformanceProfiler>
  );
  
  ProfiledComponent.displayName = `Profiled(${id})`;
  return ProfiledComponent;
}

/**
 * 性能監控配置
 */
export interface PerformanceMonitorConfig {
  logToConsole?: boolean;
  reportInterval?: number;
  onReport?: RenderMetricsReportCallback;
}

/**
 * 初始化React性能監控
 */
export function initReactPerformanceMonitoring(
  config: PerformanceMonitorConfig = {}
): () => void {
  const {
    logToConsole = true,
    reportInterval = 5000,
    onReport
  } = config;
  
  // 清除現有指標
  clearRenderMetrics();
  
  // 設置定期報告
  const intervalId = window.setInterval(() => {
    const report = getRenderMetricsReport();
    
    if (logToConsole) {
      console.group('⚛️ React Render Performance Report');
      console.table(
        Object.values(report.metrics).map(m => ({
          Component: m.componentName,
          'Render Count': m.renderCount,
          'Avg Time (ms)': m.averageRenderTime.toFixed(2),
          'Last Time (ms)': m.lastRenderTime.toFixed(2),
          'Max Time (ms)': m.maxRenderTime.toFixed(2)
        }))
      );
      console.groupEnd();
    }
    
    if (onReport) {
      onReport(report);
    }
  }, reportInterval);
  
  // 返回清理函數
  return () => {
    window.clearInterval(intervalId);
  };
}

/**
 * 類似withPerformanceProfiler的函數，但提供更友好的API
 */
export function withPerformanceTracking<P extends object>(
  Component: ComponentType<P>,
  options: { 
    id?: string; 
    onRender?: (metrics: RenderMetrics) => void 
  } = {}
): React.FC<P> {
  return withPerformanceProfiler(Component, {
    id: options.id,
    onReport: options.onRender
  });
}

/**
 * 生成渲染報告
 */
export function generateRenderReport(): RenderMetricsLog {
  return getRenderMetricsReport();
}

/**
 * 測量組件首次渲染時間的鉤子
 */
export function useFirstRenderTiming<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T>;
  renderTime: number | null;
} {
  const ref = useRef<T>(null) as React.RefObject<T>;
  const startTimeRef = useRef<number>(performance.now());
  const [renderTime, setRenderTime] = useState<number | null>(null);
  
  useEffect(() => {
    if (ref.current) {
      const endTime = performance.now();
      setRenderTime(endTime - startTimeRef.current);
    }
  }, []);
  
  return { ref, renderTime };
}

/**
 * 測量組件重新渲染時間的鉤子
 */
export function useRenderTiming(componentName: string): {
  lastRenderTime: number;
  renderCount: number;
} {
  const renderCountRef = useRef<number>(0);
  const [lastRenderTime, setLastRenderTime] = useState<number>(0);
  
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      renderCountRef.current += 1;
      setLastRenderTime(duration);
      
      // 記錄到全局渲染指標
      logRenderMetric(
        componentName,
        'update',
        duration,
        duration
      );
    };
  });
  
  return {
    lastRenderTime,
    renderCount: renderCountRef.current
  };
}

export default {
  PerformanceProfiler,
  RenderPerformanceMonitorContext,
  withPerformanceProfiler,
  useFirstRenderTiming,
  useRenderTiming,
  getRenderMetricsReport,
  clearRenderMetrics,
  initReactPerformanceMonitoring,
  withPerformanceTracking,
  generateRenderReport
}; 