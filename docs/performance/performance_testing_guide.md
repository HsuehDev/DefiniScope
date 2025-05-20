# 前端效能測試指南

本指南詳細說明了如何為我們的文件分析平台進行前端效能測試和用戶體驗評估。

## 1. 效能指標

### 1.1 核心網頁指標 (Core Web Vitals)

- **LCP (Largest Contentful Paint)**: 最大內容繪製，目標值 < 2.5秒
- **FID (First Input Delay)**: 首次輸入延遲，目標值 < 100毫秒
- **CLS (Cumulative Layout Shift)**: 累積布局偏移，目標值 < 0.1
- **TTFB (Time to First Byte)**: 首字節時間，目標值 < 600毫秒
- **FCP (First Contentful Paint)**: 首次內容繪製，目標值 < 1.8秒

### 1.2 應用特定指標

- **TTI (Time to Interactive)**: 可交互時間，目標值 < 3.8秒
- **初始加載時間**: 主應用加載完成時間，目標值 < 2秒
- **渲染時間**: 大型列表渲染時間，目標值 < 200毫秒
- **交互響應時間**: 用戶操作反饋時間，目標值 < 100毫秒
- **文件預覽加載時間**: PDF文件加載展示時間，目標值 < 1.5秒

## 2. 測試類型

### 2.1 前端指標測試

測量並監控核心網頁指標和應用特定指標，確保良好的用戶體驗。

### 2.2 代碼拆分與懶加載測試

評估代碼拆分和動態導入對初始加載時間的影響，確保頁面加載優化。

### 2.3 React性能優化測試

測試React.memo、useMemo和useCallback等優化手段的實際效果，找出最佳實踐。

### 2.4 用戶交互與動畫測試

測量用戶交互的響應時間和動畫幀率，確保流暢的體驗。

### 2.5 網絡性能測試

評估網絡請求、資源加載和緩存策略，最大化應用在各種網絡條件下的性能。

## 3. 測試工具

### 3.1 基礎測量工具

- **Web Vitals API**: 測量核心網頁指標
- **React Profiler**: 測量React組件渲染性能
- **Performance API**: 詳細測量應用各個階段的性能
- **Lighthouse**: 全面的性能、可訪問性和最佳實踐評估

### 3.2 開發工具

- **React DevTools Profiler**: 分析組件渲染性能
- **Chrome DevTools Performance**: 記錄和分析性能軌跡
- **Coverage Panel**: 分析代碼使用率和未使用代碼
- **Network Panel**: 分析網絡請求和加載優化

### 3.3 自動化工具

- **Vitest**: 單元和整合性能測試
- **Playwright**: 端到端和用戶流程性能測試
- **Puppeteer**: 自動化性能測試與監控

## 4. 測試方法

### 4.1 前端指標測量

使用Web Vitals API收集核心指標，並進行自動化報告：

```typescript
// 使用範例
import { onCLS, onFID, onLCP } from 'web-vitals';

function sendToAnalytics({ name, delta, value, id }) {
  console.log(`Metric: ${name} | Value: ${value} | Delta: ${delta} | ID: ${id}`);
  // 將數據發送到分析服務
}

// 注册所有核心指標
onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
```

### 4.2 代碼拆分測試

使用自定義工具測量初始下載包的大小和按需加載時間：

```typescript
// 測量動態導入時間
const startTime = performance.now();
import('./components/LazyComponent').then(module => {
  const endTime = performance.now();
  console.log(`Dynamic import took ${endTime - startTime}ms`);
});
```

### 4.3 渲染性能測試

使用React Profiler測量組件渲染時間和重渲染次數：

```jsx
<React.Profiler
  id="FileList"
  onRender={(id, phase, actualDuration) => {
    console.log(`Component ${id} took ${actualDuration}ms to render`);
  }}
>
  <FileList files={files} />
</React.Profiler>
```

### 4.4 自動化性能測試

使用Playwright自動測量關鍵用戶流程的性能：

```typescript
// 測量頁面加載時間範例
const startTime = Date.now();
await page.goto('http://localhost:3000/app');
const metrics = await page.evaluate(() => ({
  lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
  fid: performance.getEntriesByType('first-input')[0]?.processingStart - 
       performance.getEntriesByType('first-input')[0]?.startTime || 0,
  cls: performance.getEntriesByType('layout-shift').reduce((sum, entry) => sum + entry.value, 0)
}));
console.log(`Page load time: ${Date.now() - startTime}ms`);
console.log(`LCP: ${metrics.lcp}ms | FID: ${metrics.fid}ms | CLS: ${metrics.cls}`);
```

## 5. 效能基準與持續監控

### 5.1 性能基準測試

建立應用關鍵流程的性能基準線，作為優化和迭代的參考點。

### 5.2 性能回歸測試

每次代碼變更後自動運行性能測試，確保不引入性能退化。

### 5.3 持續監控

在生產環境中持續收集性能指標，設置性能預警和監控。

## 6. 效能瓶頸識別

### 6.1 組件層級分析

使用React Profiler識別渲染時間長的組件，集中優化。

### 6.2 網絡瓶頸分析

檢查大體積資源、不必要的請求和緩存問題。

### 6.3 JavaScript執行時間分析

識別長時間運行的JavaScript任務和阻塞主線程的操作。

## 7. 測試自動化與CI/CD整合

### 7.1 自動化測試流程

設置自動運行的性能測試，作為CI/CD流程的一部分。

### 7.2 性能預算執行

設置性能預算閾值，當指標超過閾值時自動失敗構建。

### 7.3 性能趨勢報告

生成性能趨勢報告，追踪應用性能隨時間的變化。

## 8. 用戶體驗指標測試

### 8.1 可用性測試

測量完成關鍵任務的時間和錯誤率。

### 8.2 感知性能

測量用戶對應用響應速度的感知，包括視覺反饋和進度指示。

### 8.3 用戶滿意度

收集用戶對應用性能的反饋和滿意度評分。

## 9. 移動設備優化

### 9.1 移動設備性能測試

在真實移動設備上測試應用性能，關注電池消耗和流量使用。

### 9.2 響應式設計性能

測試響應式調整對性能的影響，確保在所有設備上都有良好的性能。

## 10. 優化建議

基於性能測試結果提供具體的優化建議，包括代碼層面、資源層面和架構層面的改進。 