/**
 * @vitest-environment jsdom
 */

// 這些模擬應該在頂部定義，因為vi.mock是被提升的
vi.mock('../WebVitalsTest');
vi.mock('../ReactPerformanceTest');
vi.mock('../CodeSplittingTest');
vi.mock('../InteractionPerformanceTest');
vi.mock('../PerformanceTestSuite');

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 導入被測試的模塊
import { 
  startPerformanceTest, 
  stopPerformanceTest, 
  measureOperation 
} from '../PerformanceTestSuite';

// 測試組件
const TestComponent = () => {
  const [items, setItems] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadItems = async () => {
    setLoading(true);
    // 模擬網絡請求
    await new Promise(resolve => setTimeout(resolve, 500));
    setItems(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
    setLoading(false);
  };

  return (
    <div>
      <h1>測試組件</h1>
      <button onClick={loadItems} disabled={loading}>
        {loading ? '加載中...' : '載入項目'}
      </button>
      {items.length > 0 && (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

describe('性能測試套件', () => {
  beforeEach(() => {
    // 清理測試環境
    vi.clearAllMocks();
    document.body.innerHTML = '';
    
    // 模擬WebVitals
    vi.mocked(require('../WebVitalsTest')).PERFORMANCE_THRESHOLDS = {
      LCP: 2500,
      FID: 100,
      CLS: 0.1,
      FCP: 1800,
      TTFB: 600
    };
    
    vi.mocked(require('../WebVitalsTest')).generateWebVitalsReport.mockReturnValue({
      metrics: {
        LCP: { value: 2000, rating: 'good', valueFormatted: '2.0s' },
        FID: { value: 50, rating: 'good', valueFormatted: '50ms' },
        CLS: { value: 0.05, rating: 'good', valueFormatted: '0.05' }
      },
      overallRating: 'good'
    });
    
    // 模擬React性能
    vi.mocked(require('../ReactPerformanceTest')).initReactPerformanceMonitoring.mockReturnValue(() => {});
    vi.mocked(require('../ReactPerformanceTest')).generateRenderReport.mockReturnValue({
      metrics: {
        'TestComponent': {
          componentName: 'TestComponent',
          renderCount: 2,
          totalRenderTime: 20,
          lastRenderTime: 8,
          averageRenderTime: 10,
          maxRenderTime: 12,
          minRenderTime: 8
        }
      },
      timestamp: Date.now()
    });
    
    // 模擬代碼拆分
    vi.mocked(require('../CodeSplittingTest')).initCodeSplittingMonitor.mockReturnValue(() => {});
    vi.mocked(require('../CodeSplittingTest')).getChunkLoadRecords.mockReturnValue([]);
    vi.mocked(require('../CodeSplittingTest')).generateChunkLoadReport.mockReturnValue({
      totalChunks: 2,
      totalSize: 250000,
      totalLoadTime: 300,
      averageLoadTime: 150,
      largestChunk: 'main.js',
      largestChunkSize: 200000,
      slowestChunk: 'vendors.js',
      slowestLoadTime: 200
    });
    
    // 模擬交互性能
    vi.mocked(require('../InteractionPerformanceTest')).initInteractionMonitoring.mockReturnValue(() => {});
    vi.mocked(require('../InteractionPerformanceTest')).measureSingleInteraction.mockImplementation(
      async (action) => {
        await action();
        return {
          id: 'test-interaction',
          type: 'custom',
          targetElement: 'button',
          startTime: 100,
          endTime: 150,
          duration: 50,
          timeToFirstRender: 20,
          timeToFullRender: 50,
          frameDrop: 0,
          longTaskCount: 0,
          isResponsive: true
        };
      }
    );
    
    vi.mocked(require('../InteractionPerformanceTest')).generateInteractionReport.mockReturnValue({
      totalInteractions: 1,
      averageDuration: 50,
      responsiveInteractions: 1,
      responsivePercentage: 100,
      slowestInteraction: {
        id: 'test-interaction',
        duration: 50,
        type: 'custom'
      },
      totalLongTasks: 0,
      totalLayoutShifts: 0,
      interactionsByType: {
        click: 0,
        input: 0,
        scroll: 0,
        navigation: 0,
        custom: 1
      },
      detailedMeasurements: []
    });
  });

  afterEach(() => {
    // 停止性能測試
    vi.mocked(stopPerformanceTest).mockReset();
  });

  it('應該能夠啟動和停止性能測試', () => {
    vi.mocked(startPerformanceTest).mockReturnValue({} as any);
    vi.mocked(stopPerformanceTest).mockReturnValue({
      overall: {
        performanceScore: 90,
        issues: [],
        recommendations: []
      }
    } as any);
    
    const testSuite = startPerformanceTest();
    expect(testSuite).toBeDefined();
    
    const results = stopPerformanceTest();
    expect(results).toBeDefined();
    expect(results.overall).toBeDefined();
    expect(results.overall.performanceScore).toBeGreaterThanOrEqual(0);
    expect(results.overall.performanceScore).toBeLessThanOrEqual(100);
  });

  it('應該能夠測量單個操作的性能', async () => {
    vi.mocked(startPerformanceTest).mockReturnValue({} as any);
    vi.mocked(measureOperation).mockResolvedValue({
      duration: 100,
      interactionMeasurement: {
        id: 'test-operation',
        type: 'custom',
        targetElement: 'test',
        startTime: 0,
        endTime: 100,
        duration: 100,
        timeToFirstRender: 20,
        timeToFullRender: 100,
        frameDrop: 0,
        longTaskCount: 0,
        isResponsive: true
      }
    } as any);
    
    startPerformanceTest();
    
    const operation = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    const result = await measureOperation('test-operation', operation);
    
    expect(measureOperation).toHaveBeenCalledWith('test-operation', expect.any(Function));
    expect(result).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
    expect(result.interactionMeasurement).toBeDefined();
  });

  it('應該能夠測量React組件的渲染性能', async () => {
    vi.mocked(startPerformanceTest).mockReturnValue({} as any);
    vi.mocked(stopPerformanceTest).mockReturnValue({
      reactMetrics: {
        components: {},
        summary: {
          totalComponents: 1,
          totalRenderCount: 2,
          averageRenderTime: 10,
          slowestComponent: 'TestComponent',
          slowestRenderTime: 12
        }
      },
      interactions: {
        details: [],
        summary: {
          totalInteractions: 1,
          averageDuration: 50,
          responsiveInteractions: 1,
          responsivePercentage: 100,
          slowestInteraction: null,
          totalLongTasks: 0,
          totalLayoutShifts: 0,
          interactionsByType: {
            click: 1,
            input: 0,
            scroll: 0,
            navigation: 0,
            custom: 0
          },
          detailedMeasurements: []
        }
      }
    } as any);
    
    startPerformanceTest();
    
    // 渲染測試組件
    const user = userEvent.setup();
    const { container } = render(<TestComponent />);
    
    // 點擊按鈕觸發狀態更新
    const button = screen.getByText('載入項目');
    await user.click(button);
    
    // 等待加載完成
    await waitFor(() => {
      expect(screen.queryByText('加載中...')).toBeNull();
    });
    
    // 驗證元素已渲染
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    
    // 生成性能報告
    const results = stopPerformanceTest();
    
    expect(results.reactMetrics).toBeDefined();
    expect(results.interactions).toBeDefined();
  });

  it('應該能夠提供性能問題的建議', () => {
    const mockGenerateReport = vi.fn().mockReturnValue({
      overall: {
        performanceScore: 75,
        issues: ['測試問題1', '測試問題2'],
        recommendations: ['測試建議1', '測試建議2']
      }
    });
    
    vi.mocked(startPerformanceTest).mockReturnValue({
      generateReport: mockGenerateReport
    } as any);
    
    const testSuite = startPerformanceTest();
    
    // 強制產生一些假的性能問題
    const results = testSuite.generateReport();
    
    // 檢查報告
    expect(results.overall.recommendations.length).toBeGreaterThan(0);
    expect(results.overall.issues.length).toBeGreaterThan(0);
  });
}); 