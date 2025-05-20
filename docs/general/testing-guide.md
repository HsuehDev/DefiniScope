# 測試框架指南：Vitest

本項目使用 Vitest 作為測試框架，本文檔提供了測試框架的使用指南和最佳實踐。

## 遷移到 Vitest

我們已經從混合使用 Jest 和 Vitest 的環境遷移到統一使用 Vitest。遷移過程包括：

1. 更新 `package.json` 中的測試命令，統一使用 Vitest
2. 更新 `.eslintrc.js` 以支持 Vitest
3. 移除 Jest 相關依賴和配置
4. 確保所有測試文件使用 Vitest 的 API

## 運行測試命令

以下是常用的測試命令：

```bash
# 運行所有測試
npm test

# 監控模式（監視文件變化自動重新運行測試）
npm run test:watch

# 運行特定的測試文件
npm run test:file src/components/__tests__/ProgressDisplay.test.tsx

# 使用 UI 界面運行測試
npm run test:ui

# 生成測試覆蓋率報告
npm run test:coverage

# 端到端測試
npm run test:e2e

# 運行全部測試（單元測試和端到端測試）
npm run test:all
```

## Vitest vs Jest 語法對比

從 Jest 遷移到 Vitest 時，大部分 API 是相似的，但有一些關鍵區別：

### 導入方式

```tsx
// Jest
import { describe, it, expect, jest } from '@jest/globals';

// Vitest
import { describe, it, expect, vi } from 'vitest';
```

### 模擬函數

```tsx
// Jest
const mockFn = jest.fn();

// Vitest
const mockFn = vi.fn();
```

### 模擬模塊

```tsx
// Jest
jest.mock('./moduleName', () => ({
  functionName: jest.fn()
}));

// Vitest
vi.mock('./moduleName', () => ({
  functionName: vi.fn()
}));
```

### 定時器

```tsx
// Jest
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
jest.useRealTimers();

// Vitest
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## 測試最佳實踐

### 使用 data-testid 屬性

為了使測試更穩定，推薦使用 `data-testid` 屬性選擇元素，而不是依賴 CSS 類名或 DOM 結構：

```tsx
// 組件中
<div data-testid="progress-bar-fill" />

// 測試中
const element = screen.getByTestId('progress-bar-fill');
```

### 使用 Testing Library 推薦的方法

優先使用 Testing Library 提供的工具而非直接操作 DOM：

```tsx
// 不推薦
const element = container.querySelector('.class-name');
expect(element).toHaveAttribute('style', 'width: 50%');

// 推薦
const element = screen.getByTestId('element-id');
expect(element).toHaveStyle('width: 50%');
```

### 測試隔離

每個測試應該是獨立的，不依賴於其他測試的狀態：

```tsx
// 在每個測試前重置模擬
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 模擬外部依賴

測試時應該模擬外部依賴，如 API 請求：

```tsx
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { result: 'success' } })
  }
}));
```

## 示例測試

完整的測試示例可以在 `src/tests/example/VitestExample.test.tsx` 文件中找到，演示了：

- 基本斷言
- 組件渲染和交互測試
- 模擬函數
- 模擬模塊
- 模擬定時器
- 非同步測試

## 排查常見問題

### 模擬函數未被調用

檢查：
- 模擬函數是否正確導入 (`vi.fn()` 而非 `jest.fn()`)
- 模擬函數是否在正確的作用域
- 是否在 `beforeEach` 中重置了模擬函數

### 測試超時

Vitest 默認超時時間為 5 秒，可以在配置中修改：

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000 // 10秒
  }
});
```

### 模塊解析問題

如果遇到模塊解析問題，可以在 `vitest.config.ts` 中設置別名：

```ts
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
```

## 參考資源

- [Vitest 官方文檔](https://vitest.dev/guide/)
- [Testing Library 文檔](https://testing-library.com/docs/)
- [React Testing Library 文檔](https://testing-library.com/docs/react-testing-library/intro/) 