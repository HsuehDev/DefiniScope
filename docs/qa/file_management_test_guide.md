# 檔案管理功能測試執行指南

## 1. 測試環境準備

### 1.1 測試依賴安裝

```bash
# 安裝前端依賴
cd frontend
npm install

# 安裝測試相關依賴
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8 @playwright/test

# 安裝Playwright瀏覽器
npx playwright install --with-deps
```

### 1.2 配置測試環境

確保您的測試環境配置已正確設置：

1. 複製 `frontend/vitest.config.ts` 中的配置
2. 確保 `src/tests/setupTests.ts` 已正確設置
3. 創建相應的 mock 文件（如 `src/hooks/__mocks__/useFileAPI.ts`）

## 2. 單元測試執行

### 2.1 運行所有單元測試

```bash
cd frontend
npm test
```

### 2.2 運行特定測試檔案

```bash
cd frontend
npm test FileList
```

### 2.3 監視模式（開發中使用）

```bash
cd frontend
npm test -- --watch
```

### 2.4 生成測試覆蓋率報告

```bash
cd frontend
npm test -- --coverage
```

覆蓋率報告將生成在 `coverage` 目錄下，可以透過瀏覽器開啟 `coverage/index.html` 查看詳細報告。

## 3. 整合測試執行

### 3.1 確保模擬數據準備

檢查 `src/hooks/__mocks__/useFileAPI.ts` 文件中的模擬數據是否符合測試需求。模擬數據應該包含：

- 多個測試檔案，具有不同的大小、處理狀態
- 模擬成功和失敗的刪除操作
- 支援樂觀更新測試的可控制Promise

### 3.2 執行整合測試

```bash
cd frontend
npm test FileManagement
```

測試將驗證：
- 檔案列表顯示
- 排序功能
- 刪除確認對話框
- 刪除成功與失敗處理
- 樂觀更新與回滾機制

## 4. 端到端測試執行

### 4.1 準備測試數據

1. 確保測試數據庫已設置並添加測試帳號
2. 上傳必要的測試PDF檔案（至少3個）
3. 確保所有檔案已完成處理

### 4.2 執行Playwright測試

```bash
cd frontend
npx playwright test
```

### 4.3 帶UI的測試調試

```bash
cd frontend
npx playwright test --ui
```

### 4.4 生成測試報告

```bash
cd frontend
npx playwright test --reporter=html
```

測試報告將生成在 `playwright-report` 目錄下。

## 5. 常見問題排除

### 5.1 測試失敗問題診斷

- **元素選擇器錯誤**: 確認測試中使用的data-testid是否與實際代碼匹配
- **模擬API問題**: 檢查mock檔案中的模擬函數是否與組件中使用的一致
- **測試環境問題**: 確保setupTests.ts已正確配置並加載
- **事件處理問題**: 使用waitFor等待非同步操作完成

### 5.2 測試超時問題

如遇到測試超時問題，可調整 `vitest.config.ts` 中的超時設置：

```typescript
// 增加測試超時時間
testTimeout: 30000, // 30秒
hookTimeout: 20000,  // 20秒
```

### 5.3 UI交互問題

在測試UI交互時，特別是確認對話框和刪除操作，確保：

1. 等待元素完全載入和可點擊
2. 使用waitFor等待操作結果
3. 在樂觀更新測試中，正確控制Promise的解析時機

## 6. 測試結果分析與解釋

### 6.1 解讀覆蓋率報告

覆蓋率報告提供以下指標：

- **行覆蓋率**: 測試執行覆蓋的代碼行百分比
- **分支覆蓋率**: 測試覆蓋的條件分支百分比
- **函數覆蓋率**: 測試調用的函數百分比
- **語句覆蓋率**: 測試執行的語句百分比

針對檔案管理功能，應確保：

- FileList元件的行覆蓋率達到90%以上
- 刪除相關功能的分支覆蓋率達到95%以上
- 用戶交互函數的覆蓋率達到100%

### 6.2 端到端測試指標

端到端測試應確保：

- 所有用戶關鍵路徑完全測試（檔案顯示、排序、刪除）
- 正面路徑（成功刪除）和負面路徑（失敗、取消）都得到覆蓋
- 操作的一致性（如刪除後UI更新）得到驗證

## 7. 持續整合與自動化測試

### 7.1 在CI環境中配置測試

```yaml
# .github/workflows/test.yml 示例
name: Test

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main, dev ]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 16
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests with coverage
        run: cd frontend && npm test -- --coverage
      - name: Upload coverage report
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: frontend/coverage/

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 16
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Install Playwright browsers
        run: cd frontend && npx playwright install --with-deps
      - name: Run Playwright tests
        run: cd frontend && npx playwright test
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### 7.2 定期執行測試

建議設置排程定期執行完整測試套件，例如每晚運行一次完整的端到端測試，確保系統穩定性。

```yaml
# 定期測試配置
name: Nightly Tests

on:
  schedule:
    - cron: '0 0 * * *'  # 每天午夜執行

jobs:
  full-test-suite:
    # 測試配置...
```

## 8. 參考資源

- [Vitest 文檔](https://vitest.dev/guide/)
- [React Testing Library 文檔](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright 文檔](https://playwright.dev/docs/intro)
- [TanStack Query 測試指南](https://tanstack.com/query/latest/docs/react/guides/testing) 