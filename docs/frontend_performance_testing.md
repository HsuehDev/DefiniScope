# 前端效能測試方案

本文檔總結了為文件分析平台設計的前端效能測試方案和工具，涵蓋了關鍵的性能指標監控和優化檢測工具。

## 測試工具總覽

我們開發了一套全面的前端效能測試工具，分為以下幾個主要部分：

1. **Web Vitals測試工具** (`WebVitalsTest.ts`)
   - 測量核心網頁指標 (LCP, FID, CLS, FCP, TTFB)
   - 提供性能評分和改進建議
   - 實現可視化報告

2. **React效能測試工具** (`ReactPerformanceTest.tsx`)
   - 測量組件渲染時間和渲染次數
   - 識別緩慢組件和優化機會
   - 提供高階組件和鉤子函數進行性能分析

3. **代碼拆分測試工具** (`CodeSplittingTest.ts`)
   - 監控動態導入和代碼塊加載
   - 測量懶加載效能
   - 分析代碼拆分策略效果

4. **交互性能測試工具** (`InteractionPerformanceTest.ts`)
   - 測量用戶交互響應時間
   - 檢測長任務和布局偏移
   - 評估UI響應性

5. **綜合性能測試套件** (`PerformanceTestSuite.ts`)
   - 整合以上所有工具
   - 提供統一的API和報告機制
   - 計算綜合性能分數和優化建議

## 使用方法

### 基本使用

```typescript
// 啟動性能測試
import { startPerformanceTest, stopPerformanceTest } from './tests/performance/PerformanceTestSuite';

// 開始測試
const testSuite = startPerformanceTest();

// ... 用戶操作 ...

// 停止測試並獲取報告
const results = stopPerformanceTest();
console.log(`性能評分: ${results.overall.performanceScore}/100`);
```

### 測量特定操作

```typescript
import { measureOperation } from './tests/performance/PerformanceTestSuite';

// 測量特定操作性能
const result = await measureOperation('載入大型檔案', async () => {
  await loadLargeFile(fileId);
});

console.log(`操作耗時: ${result.duration}ms`);
```

### 組件性能追踪

```tsx
import { withPerformanceTracking } from './tests/performance/ReactPerformanceTest';

// 原始組件
const DataTable = (props) => {
  // ... 組件實現 ...
};

// 帶性能追踪的組件
export default withPerformanceTracking(DataTable, {
  id: 'DataTable'
});
```

## 性能指標與閾值

我們追踪以下關鍵指標，並設置了相應的閾值：

| 指標 | 描述 | 目標閾值 | 警告閾值 |
|-----|-----|---------|---------|
| LCP | 最大內容繪製 | 2.5秒 | 4.0秒 |
| FID | 首次輸入延遲 | 100毫秒 | 300毫秒 |
| CLS | 累積布局偏移 | 0.1 | 0.25 |
| FCP | 首次內容繪製 | 1.8秒 | 3.0秒 |
| TTFB | 首字節時間 | 600毫秒 | 1000毫秒 |
| 組件渲染時間 | 單個組件渲染耗時 | 16毫秒 | 50毫秒 |
| 交互響應時間 | 用戶操作至UI響應時間 | 100毫秒 | 200毫秒 |
| 代碼塊大小 | 單個懶加載塊大小 | 500KB | 1MB |

## 測試自動化

我們提供了基於Vitest的自動化測試，可以集成到CI/CD流程中：

```bash
# 運行所有性能測試
npm test -- src/tests/performance

# 運行特定性能測試
npm test -- src/tests/performance/WebVitalsTest.test.ts
```

## 性能報告與可視化

性能測試結果可以通過以下方式輸出：

1. 控制台日誌 (默認)
2. JSON格式文件
3. (待實現) 性能監控儀表板

## 待解決項目

目前仍有一些待完成和待優化的項目，詳見 [待解決測試項目](./pending_tests.md)。 