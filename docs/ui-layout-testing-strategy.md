# UI布局與導航測試策略

本文檔詳細說明針對文獻智能助手應用的UI布局與導航功能的測試策略，包括三欄式布局、響應式設計和面板調整功能的測試方法。

## 1. 測試概述

### 1.1 測試範圍

- **主布局組件**：測試MainLayout組件的基本渲染和側邊欄切換功能
- **三欄布局**：測試ThreeColumnLayout組件的面板折疊和響應式行為
- **導航功能**：測試頁面間的導航和路由變更
- **響應式行為**：測試不同屏幕尺寸下的布局調整
- **鍵盤可訪問性**：測試使用鍵盤進行導航和操作的功能

### 1.2 測試層次

我們採用分層測試策略，包括：

1. **單元測試**：使用Vitest和React Testing Library測試獨立組件的功能
2. **視覺測試**：使用Playwright確保在不同屏幕尺寸下的布局正確
3. **端到端測試**：測試完整的用戶流程和功能整合

## 2. 單元測試策略

### 2.1 模擬依賴

對於包含子組件的布局組件，我們使用以下方法處理依賴：

```typescript
// 模擬子組件
vi.mock('../../layouts/Navbar', () => ({
  Navbar: ({ onToggleSidebar }) => (
    <nav data-testid="mock-navbar">
      <button onClick={onToggleSidebar} data-testid="toggle-sidebar-btn">
        Toggle Sidebar
      </button>
    </nav>
  ),
}));
```

- 優點：專注於測試目標組件的邏輯，不受子組件實現的影響
- 缺點：無法檢測與實際子組件的整合問題

### 2.2 測試狀態變化

對於有狀態變化的組件，使用以下測試模式：

```typescript
// 初始狀態測試
expect(element).toHaveClass('initial-class');

// 觸發動作
fireEvent.click(triggerElement);

// 驗證狀態變化
expect(element).toHaveClass('changed-class');
```

### 2.3 路由整合測試

對於使用React Router的組件，提供路由上下文：

```typescript
// 為測試提供必要的路由上下文
const renderWithRouter = (ui, { routes = ['/'] } = {}) => {
  return render(
    <MemoryRouter initialEntries={routes}>
      <Routes>
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};
```

## 3. 響應式設計測試

### 3.1 模擬不同屏幕尺寸

#### 單元測試中模擬窗口尺寸

```typescript
// 保存原始window.innerWidth
const originalInnerWidth = window.innerWidth;

// 設置窗口寬度
const setWindowInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

// 在每次測試後恢復原始設置
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: originalInnerWidth,
  });
});
```

#### 端到端測試中模擬設備尺寸

```typescript
// 模擬手機屏幕尺寸
await page.setViewportSize({ width: 375, height: 667 });

// 模擬平板屏幕尺寸
await page.setViewportSize({ width: 768, height: 1024 });

// 模擬桌面屏幕尺寸
await page.setViewportSize({ width: 1920, height: 1080 });
```

### 3.2 測試響應式斷點

我們的主要響應式斷點包括：

- **小屏幕** (<768px)：僅顯示一個面板，提供面板選擇器
- **中等屏幕** (768px - 1024px)：支持多面板顯示，但寬度較窄
- **大屏幕** (>1024px)：完整三欄式布局

測試策略：

1. 對每個斷點執行測試，驗證布局元素的可見性和行為
2. 對特定斷點的獨有功能進行額外測試（如小屏幕的面板選擇器）
3. 測試在斷點邊界值處的行為是否符合預期

```typescript
// 小屏幕測試示例
test('小屏幕下只顯示一個活動面板', () => {
  setWindowInnerWidth(500);
  render(<ThreeColumnLayout {...props} />);
  
  // 檢查面板選擇器是否顯示
  expect(screen.getByText('檔案管理')).toBeInTheDocument();
  
  // 測試面板切換
  fireEvent.click(screen.getByText('檔案管理'));
  // 驗證面板切換
});
```

## 4. 面板調整測試

### 4.1 測試面板折疊和展開

```typescript
// 找到左側面板折疊按鈕
const leftPanelToggleBtn = screen.getByText(/11 19l-7-7 7-7m8 14l-7-7 7-7/i).closest('button');

// 檢查左側面板初始寬度
const leftPanel = screen.getByTestId('left-panel-content').closest('div[class*="transition-all"]');
expect(leftPanel).toHaveClass('w-64');

// 點擊折疊按鈕
fireEvent.click(leftPanelToggleBtn);

// 檢查左側面板是否被折疊
expect(leftPanel).toHaveClass('w-0');
```

### 4.2 測試隱藏和顯示功能

在端到端測試中，重點測試以下方面：

1. 面板折疊後的內容是否正確隱藏
2. 小屏幕下切換面板時內容顯示是否正確
3. 面板展開/折疊後其他面板的尺寸變化

```typescript
// 檢查面板內容可見性
const panelContent = page.locator('[data-testid="left-panel-content"]');
await expect(panelContent).toBeVisible();

// 折疊面板
await leftPanelToggleButton.click();

// 檢查面板內容是否隱藏
await expect(panelContent).not.toBeVisible();
```

## 5. 鍵盤導航與可訪問性測試

### 5.1 測試Tab鍵導航

```typescript
// 按Tab鍵切換焦點
await page.keyboard.press('Tab');

// 檢查焦點元素
await expect(page.locator('button:focus')).toHaveAttribute('aria-controls', 'sidebar');

// 按Enter鍵激活元素
await page.keyboard.press('Enter');
```

### 5.2 可訪問性測試最佳實踐

1. 確保所有交互元素支持鍵盤操作
2. 檢查元素具有適當的ARIA屬性
3. 測試螢幕閱讀器友好性（有意義的元素順序和標籤）
4. 確保所有可點擊元素尺寸足夠大（手機友好）

### 5.3 Playwright可訪問性測試

使用Playwright的可訪問性測試工具：

```typescript
// 安裝插件
// npm install @axe-core/playwright

// 在測試中使用
import { injectAxe, checkA11y } from 'axe-playwright';

test('頁面應符合可訪問性標準', async ({ page }) => {
  await page.goto('/app');
  await injectAxe(page);
  
  // 測試整個頁面的可訪問性
  await checkA11y(page);
  
  // 或測試特定元素
  await checkA11y(page.locator('#sidebar'));
});
```

## 6. 最佳實踐與注意事項

### 6.1 避免過度依賴實現細節

避免依賴具體CSS類名進行測試，使用數據屬性標記測試元素：

```tsx
// 組件中
<div data-testid="main-content" className={classNames(...classes)}>

// 測試中
const mainContent = screen.getByTestId('main-content');
```

### 6.2 處理異步過渡動畫

使用等待函數處理UI過渡動畫：

```typescript
// 在端到端測試中
// 點擊按鈕後等待過渡動畫完成
await sidebarToggleButton.click();
await page.waitForTimeout(350); // 假設過渡動畫持續300ms
```

### 6.3 測試中文輸入法下的鍵盤行為

針對中文輸入法下的特殊鍵盤行為進行測試：

```typescript
// 模擬中文輸入法的composition事件
await page.evaluate(() => {
  const textarea = document.querySelector('textarea');
  if (textarea) {
    // 觸發compositionstart事件
    const startEvent = new Event('compositionstart');
    textarea.dispatchEvent(startEvent);
    
    // 模擬按鍵事件
    const enterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(enterEvent);
    
    // 結束輸入
    const endEvent = new Event('compositionend');
    textarea.dispatchEvent(endEvent);
  }
});
```

## 7. 實施測試自動化

### 7.1 CI/CD整合

推薦在GitHub Actions或其他CI/CD平台上自動執行以下測試：

1. 提交時執行單元測試（Vitest）
2. 合併請求時執行端到端測試（Playwright）
3. 定期執行所有測試並生成覆蓋率報告

### 7.2 視覺回歸測試

使用Playwright的截圖比較功能進行視覺回歸測試：

```typescript
// 不同屏幕尺寸下拍攝截圖
test('響應式布局視覺測試', async ({ page }) => {
  // 桌面尺寸
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/app/chat');
  await expect(page).toHaveScreenshot('chat-desktop.png');
  
  // 平板尺寸
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page).toHaveScreenshot('chat-tablet.png');
  
  // 手機尺寸
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page).toHaveScreenshot('chat-mobile.png');
});
```

## 8. 執行測試指令

### 8.1 執行單元測試

```bash
# 執行所有單元測試
npm run test

# 執行特定檔案的測試
npm run test -- src/__tests__/layouts/MainLayout.test.tsx

# 執行帶有監視模式的測試
npm run test -- --watch
```

### 8.2 執行端到端測試

```bash
# 執行所有端到端測試
npm run test:e2e

# 執行特定的端到端測試文件
npx playwright test e2e/layout.spec.ts

# 以交互模式執行測試
npx playwright test e2e/layout.spec.ts --debug
```

## 9. 故障排除

### 9.1 常見問題與解決方案

1. **元素無法找到**：
   - 確保選擇器正確
   - 增加等待時間或使用更具體的等待條件
   - 檢查元素是否在視口內

2. **測試超時**：
   - 檢查過渡動畫時間
   - 增加測試超時設置
   - 檢查是否有無限加載或網絡問題

3. **假陽性結果**：
   - 使用更穩定的選擇器（如data-testid）
   - 避免對動態內容進行精確斷言
   - 考慮使用更寬鬆的匹配條件（如正則表達式）

4. **CSS類名不匹配**：
   - 使用部分類名匹配：toHaveClass(/w-64/)
   - 使用data-testid或其他屬性進行測試
   - 確保測試環境與開發環境使用相同的Tailwind配置

---

通過遵循本文檔中的測試策略和最佳實踐，我們可以確保文獻智能助手應用的布局和導航功能在各種使用情境下都能正常運作，提供一致且優質的用戶體驗。 