# 互動式句子引用功能測試策略

## 1. 功能概述

互動式句子引用功能是系統的核心功能之一，允許用戶在聊天回答中查看引用的原文句子、查看上下文，以及在原始PDF文件中查看句子位置。主要包含以下組件：

- **SentenceReferenceTag**: 顯示在聊天回答中的引用標籤
- **SentenceContextViewer**: 句子上下文查看器
- **PDFViewer**: PDF文件查看器

## 2. 測試類型

我們將採用多層次測試策略確保功能的各個層面都得到充分測試：

### 2.1 單元測試 (Unit Tests)

針對獨立組件的功能進行測試，確保每個組件的基本功能正常運行。使用Vitest和React Testing Library實現。

### 2.2 整合測試 (Integration Tests)

測試各組件之間的交互，確保數據傳遞和事件處理正確。特別關注組件間通信和狀態管理。

### 2.3 端到端測試 (End-to-End Tests)

模擬真實用戶操作流程，確保整個功能在真實環境中能夠正常工作。使用Playwright實現。

## 3. 測試重點

### 3.1 SentenceReferenceTag組件測試重點

- 正確顯示引用標籤內容（截斷長句子）
- 滑鼠懸停時顯示完整引用內容
- 點擊後彈出選項菜單（查看上下文、在PDF中查看）
- 選項操作正確觸發回調函數
- 不同定義類型（CD/OD）的樣式區分
- 邊界情況處理（極長句子、特殊字符等）

### 3.2 SentenceContextViewer組件測試重點

- 正確顯示句子上下文
- 高亮顯示被引用的句子
- 載入中狀態顯示
- 模態框開關行為
- 「在PDF中查看」按鈕功能
- 上下文為空時的提示信息

### 3.3 PDF查看功能測試重點

- 從引用跳轉至PDF時正確顯示對應頁面
- 高亮顯示引用句子
- 頁面導航功能（上一頁、下一頁）
- 模態框開關行為
- PDF加載異常處理

### 3.4 端到端流程測試重點

- 從聊天消息點擊引用標籤到查看PDF的完整流程
- 從聊天消息查看引用上下文的流程
- 處理多個引用標籤的情況
- 測試引用標籤懸停顯示完整內容

## 4. 模擬與依賴處理

### 4.1 API模擬

使用vi.mock()模擬以下API服務：

```typescript
// 模擬API服務
vi.mock('../../services/api', () => ({
  fetchSentenceContext: vi.fn().mockResolvedValue({
    beforeContext: ['這是前一個句子。'],
    afterContext: ['這是後一個句子。'],
    isLoading: false
  }),
  getFilePreviewUrl: vi.fn().mockResolvedValue('http://localhost/preview/test-file'),
  highlightSentenceInPdf: vi.fn().mockResolvedValue(true)
}));
```

### 4.2 全局狀態模擬

模擬Context或Redux等全局狀態管理：

```typescript
// 模擬全局狀態
const mockSetPdfViewerState = vi.fn();
vi.mock('../../contexts/PDFViewerContext', () => ({
  usePDFViewerContext: () => ({
    setPdfViewerState: mockSetPdfViewerState,
    pdfViewerState: {
      isOpen: false,
      fileUuid: '',
      pageNumber: 1,
      highlightedSentenceUuid: '',
    }
  })
}));
```

### 4.3 PDF查看器模擬

對於PDF查看器組件的測試，我們將：
- 模擬PDF.js的核心功能
- 使用canvas mock測試渲染行為
- 重點測試交互邏輯而非渲染細節

## 5. 測試數據

### 5.1 模擬引用數據

```typescript
const mockReference = {
  sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
  file_uuid: '123e4567-e89b-12d3-a456-426614174001',
  original_name: 'test-document.pdf',
  sentence: '這是一個測試引用句子。',
  page: 5,
  defining_type: 'cd' as const
};
```

### 5.2 模擬上下文數據

```typescript
const mockContext = {
  beforeContext: [
    '這是引用句子前的第一個句子。',
    '這是引用句子前的第二個句子。'
  ],
  afterContext: [
    '這是引用句子後的第一個句子。',
    '這是引用句子後的第二個句子。'
  ],
  isLoading: false
};
```

### 5.3 邊界情況測試數據

- 超長句子
- 包含HTML特殊字符的句子
- 空上下文
- 多個連續引用
- 無法載入PDF的情況

## 6. 特殊情況測試

### 6.1 錯誤處理測試

測試以下錯誤情況下的UI行為：
- API調用失敗
- 上下文獲取失敗
- PDF文件不存在或無法訪問
- 網絡延遲或中斷

### 6.2 響應式設計測試

確保組件在不同屏幕尺寸下的正確顯示：
- 桌面瀏覽器
- 平板設備
- 移動設備

### 6.3 無障礙性測試

確保組件符合無障礙標準：
- 鍵盤導航支持
- 屏幕閱讀器兼容性
- 顏色對比度符合WCAG標準

## 7. 測試自動化與CI/CD整合

### 7.1 測試運行策略

- 單元測試和整合測試在每次提交時運行
- 端到端測試在每次PR和定期運行
- 測試覆蓋率分析和報告生成

### 7.2 持續集成配置

```yaml
# .github/workflows/test.yml (示例)
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - name: E2E Tests
        if: github.event_name == 'pull_request'
        run: npm run test:e2e
```

## 8. 性能測試

### 8.1 渲染性能

- 測量大量引用標籤的渲染性能
- 監控PDF渲染的效率
- 測試上下文查看器載入大量句子的表現

### 8.2 交互響應速度

- 測量從點擊到顯示的響應時間
- 確保懸停效果的流暢性
- 評估PDF頁面切換的速度

## 9. 預期的測試覆蓋率

- 單元測試覆蓋率: > 90%
- 整合測試覆蓋關鍵交互路徑: > 80%
- 端到端測試覆蓋核心用戶流程: 100%

## 10. 測試維護策略

- 定期更新測試數據以匹配產品變化
- 建立測試模板和工具函數減少重複代碼
- 專注於測試組件的行為而非實現細節，減少因UI變更導致的測試失敗
- 在組件重構時保留測試，確保功能不變 