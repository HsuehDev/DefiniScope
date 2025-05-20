# 檔案上傳功能測試指南

本文檔提供檔案上傳功能（包括斷點續傳和超時控制）的完整測試方案，涵蓋單元測試、整合測試和端到端測試。

## 目錄
1. [測試架構概述](#測試架構概述)
2. [單元測試](#單元測試)
3. [整合測試](#整合測試)
4. [端到端測試](#端到端測試)
5. [測試特定功能](#測試特定功能)
6. [測試覆蓋率分析](#測試覆蓋率分析)
7. [常見問題與解決方案](#常見問題與解決方案)
8. [持續整合](#持續整合)

## 測試架構概述

我們使用以下工具和框架進行測試：

- **Vitest**: 主要測試框架，提供快速的測試執行環境
- **React Testing Library**: 用於測試 React 組件
- **MSW (Mock Service Worker)**: 用於模擬 API 請求和響應
- **JSDOM**: 提供瀏覽器 API 的模擬環境

測試檔案位於 `frontend/src/__tests__` 目錄，按照以下結構組織：

```
frontend/src/__tests__/
├── components/           # 組件測試
│   └── upload/           # 上傳相關組件測試
├── hooks/                # Hook 測試
├── utils/                # 工具函數測試
├── mocks/                # 模擬數據和處理程序
└── setup.ts              # 測試環境設置
```

## 單元測試

### 組件測試

#### 1. FileUploadZone 組件

測試檔案：`frontend/src/__tests__/components/upload/FileUploadZone.test.tsx`

測試範圍：
- 拖放區域的正確渲染
- 文件拖放功能
- 文件選擇功能
- 文件類型和大小驗證
- 上傳狀態顯示
- 暫停/繼續/重試/取消操作

關鍵測試點：
```typescript
// 測試拖放有效檔案
test('當拖放有效檔案時，應該調用 addFiles', async () => {
  // 設置測試檔案
  const testFile = createTestFile();
  
  render(<FileUploadZone />);
  
  // 獲取拖放區域
  const dropzone = screen.getByTestId('dropzone');
  
  // 模擬文件拖放事件
  fireEvent.drop(dropzone, {
    dataTransfer: {
      files: [testFile],
      types: ['Files']
    }
  });
  
  // 檢查 addFiles 是否被調用
  expect(addFiles).toHaveBeenCalledWith([testFile]);
});
```

#### 2. UploadProgressBar 組件

測試檔案：`frontend/src/__tests__/components/upload/UploadProgressBar.test.tsx`

測試範圍：
- 進度顯示
- 各種上傳狀態的正確顯示
- 超時警告樣式

#### 3. UploadTimeoutWarning 組件

測試檔案：`frontend/src/__tests__/components/upload/UploadTimeoutWarning.test.tsx`

測試範圍：
- 警告內容顯示
- 倒計時進度條
- 取消和繼續按鈕功能

### Hook 測試

#### useFileUpload Hook

測試檔案：`frontend/src/__tests__/hooks/useFileUpload.test.ts`

測試範圍：
- 檔案添加和驗證
- 上傳初始化
- 分片上傳邏輯
- 暫停/繼續功能
- 網絡中斷處理
- 超時控制和警告
- 重試邏輯

關鍵測試點：
```typescript
// 測試網絡中斷
test('網絡斷開應自動暫停上傳', async () => {
  const { result } = renderHook(() => useFileUpload());
  
  // 添加文件並等待上傳開始
  act(() => {
    result.current.addFiles([createTestFile()]);
  });
  
  await waitFor(() => {
    expect(result.current.files[0].status).toBe(UploadStatus.UPLOADING);
  });
  
  // 模擬網絡斷開
  act(() => {
    Object.defineProperty(navigator, 'onLine', { value: false });
    window.dispatchEvent(new Event('offline'));
  });
  
  // 檢查上傳是否暫停
  expect(result.current.files[0].status).toBe(UploadStatus.PAUSED);
});
```

### 工具函數測試

測試檔案：`frontend/src/__tests__/utils/uploadUtils.test.ts`

測試範圍：
- 檔案分片
- 格式化函數
- 上傳速度計算
- 剩餘時間估算
- 超時檢測

## 整合測試

整合測試專注於多個組件和 Hook 之間的交互，以及與 API 的整合。

### 模擬 API 請求

測試檔案：`frontend/src/__tests__/mocks/handlers.ts`

我們使用 MSW 模擬後端 API：
- 初始化上傳 `/api/files/multipart/init`
- 上傳分片 `/api/files/multipart/:fileId/:uploadId/:partNumber`
- 完成上傳 `/api/files/multipart/:fileId/:uploadId/complete`
- 取消上傳 `/api/files/multipart/:fileId/:uploadId`
- 獲取上傳狀態 `/api/files/multipart/:fileId/:uploadId/status`

關鍵處理程序：
```typescript
const mockNetworkTimeout = rest.post(
  `${API_BASE_URL}/files/multipart/timeout/init`,
  async (req, res, ctx) => {
    // 等待 30 秒，模擬超時
    await new Promise(resolve => setTimeout(resolve, 30000));
    return res(ctx.status(408));
  }
);

// 模擬網絡中斷的處理程序
export const networkErrorHandlers = [
  rest.post('*', (req, res) => {
    return res.networkError('網絡連接失敗');
  }),
];
```

## 端到端測試

端到端測試使用真實的後端服務，測試完整的上傳流程。我們可以使用 Cypress 或 Playwright 進行這些測試。

### 模擬慢速網絡

使用 Cypress 的網絡控制或 Chrome DevTools 的網絡節流功能模擬慢速連接：

```typescript
// Cypress 測試示例
it('應該在網絡速度慢的情況下正確顯示上傳進度', () => {
  // 設置慢速網絡
  cy.intercept('POST', '/api/files/multipart/**', (req) => {
    req.on('response', (res) => {
      // 延遲響應
      res.setThrottle(1000);
    });
  });
  
  // 上傳文件
  cy.get('[data-testid="dropzone"]').attachFile('test.pdf');
  
  // 檢查進度顯示
  cy.get('[data-testid="progress-bar"]').should('exist');
  cy.get('[data-testid="upload-speed"]').should('contain', 'KB/s');
});
```

## 測試特定功能

### 1. 斷點續傳測試

測試方法：
1. 啟動文件上傳
2. 模擬網絡中斷（設置 `navigator.onLine = false` 並觸發 `offline` 事件）
3. 驗證上傳狀態變為 `PAUSED`
4. 模擬網絡恢復（設置 `navigator.onLine = true` 並觸發 `online` 事件）
5. 驗證上傳狀態變為 `UPLOADING` 並繼續上傳剩餘分片

```typescript
// 已在 useFileUpload.test.ts 中實現
```

### 2. 超時控制測試

測試方法：
1. 模擬接近超時條件（使用 vi.mock 覆蓋 shouldShowTimeoutWarning 返回 true）
2. 驗證顯示超時警告
3. 模擬超時條件（使用 vi.mock 覆蓋 isUploadTimedOut 返回 true）
4. 驗證上傳被標記為超時

```typescript
// 已在 useFileUpload.test.ts 中實現
```

### 3. 分片上傳邏輯測試

測試方法：
1. 控制分片大小（例如設置為 1MB）
2. 創建特定大小的測試文件（例如 2.5MB）
3. 驗證分片數量和大小是否正確
4. 模擬分片上傳流程
5. 驗證完成上傳的邏輯

```typescript
// 已在 uploadUtils.test.ts 中實現分片邏輯測試
```

## 測試覆蓋率分析

運行 `npm run test:coverage` 生成測試覆蓋率報告。

目標覆蓋率：
- **整體覆蓋率**: 最低 80%
- **關鍵模塊覆蓋率**:
  - `useFileUpload.ts`: 最低 90%
  - `FileUploadZone.tsx`: 最低 85% 
  - `uploadUtils.ts`: 最低 95%

重點關注以下區域的測試：
1. 超時檢測和處理
2. 網絡中斷處理
3. 分片邏輯
4. 錯誤處理和重試

## 常見問題與解決方案

### 1. 測試網絡事件

問題：網絡事件（online/offline）在測試中不易觸發
解決方案：直接修改 `navigator.onLine` 屬性並手動觸發事件

```typescript
Object.defineProperty(navigator, 'onLine', { value: false });
window.dispatchEvent(new Event('offline'));
```

### 2. 測試文件上傳

問題：實際檔案操作在測試環境中困難
解決方案：使用 `File` 構造函數創建測試文件

```typescript
const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
```

### 3. 測試分片邏輯

問題：大檔案處理在測試中可能緩慢
解決方案：使用較小的測試檔案，減小分片大小

```typescript
// 測試配置
const testConfig = {
  ...getDefaultUploadConfig(),
  chunkSize: 1024 * 10 // 10KB 而非 1MB
};
```

## 持續整合

在 CI 流程中加入以下命令：

```yaml
# .github/workflows/test.yml
steps:
  - name: Install dependencies
    run: npm ci
    
  - name: Run tests
    run: npm run test
    
  - name: Generate coverage report
    run: npm run test:coverage
    
  - name: Upload coverage report
    uses: actions/upload-artifact@v2
    with:
      name: coverage-report
      path: coverage/
```

---

## 結論

本測試指南提供了全面的策略來測試檔案上傳功能，特別關注斷點續傳和超時控制。透過單元測試、整合測試和端到端測試的組合，我們可以確保文件上傳功能在各種條件下可靠運行。

如有任何問題或建議，請聯繫 QA 團隊。 