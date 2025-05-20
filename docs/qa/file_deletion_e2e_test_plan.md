# 檔案管理與刪除功能端到端測試計劃

## 1. 測試範圍

本測試計劃涵蓋檔案管理功能的端到端測試，重點關注檔案列表顯示、排序和刪除功能。測試將模擬真實使用者場景，確保整個系統從前端到後端的完整流程正確運作。

## 2. 測試環境設置

### 2.1 測試環境需求
- Playwright測試框架
- 測試資料庫 (PostgreSQL)
- 測試MinIO實例
- 完整後端API服務
- 前端應用

### 2.2 測試資料準備
- 預先創建測試用戶帳號
- 上傳測試PDF檔案 (至少3個不同大小和內容的檔案)
- 確保檔案處理完成，包含CD/OD分類結果

## 3. 測試腳本設計

### 3.1 檔案列表與排序測試

```typescript
import { test, expect } from '@playwright/test';

test.describe('檔案列表功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登入系統
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // 導航到檔案列表頁面
    await page.goto('/files');
    await page.waitForSelector('[data-testid="file-list"]');
  });

  test('應正確顯示上傳的檔案列表', async ({ page }) => {
    // 驗證檔案列表是否包含預先上傳的檔案
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(3);
    await expect(page.getByText('test_file_1.pdf')).toBeVisible();
    await expect(page.getByText('test_file_2.pdf')).toBeVisible();
    await expect(page.getByText('test_file_3.pdf')).toBeVisible();
  });

  test('應支援按名稱排序檔案', async ({ page }) => {
    // 選擇按名稱排序
    await page.selectOption('[data-testid="sort-select"]', 'original_name');
    await page.selectOption('[data-testid="order-select"]', 'asc');
    
    // 驗證排序結果
    const fileNames = await page.$$eval('[data-testid="file-name"]', 
      elements => elements.map(el => el.textContent));
    
    // 檢查排序是否正確
    const sortedNames = [...fileNames].sort();
    expect(fileNames).toEqual(sortedNames);
  });

  test('應支援按上傳日期排序檔案', async ({ page }) => {
    // 選擇按日期排序 (降序 - 最新的在前)
    await page.selectOption('[data-testid="sort-select"]', 'created_at');
    await page.selectOption('[data-testid="order-select"]', 'desc');
    
    // 獲取顯示的日期
    const dates = await page.$$eval('[data-testid="file-date"]', 
      elements => elements.map(el => new Date(el.getAttribute('data-date')).getTime()));
    
    // 驗證日期是否按降序排列
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i-1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});
```

### 3.2 檔案刪除功能測試

```typescript
import { test, expect } from '@playwright/test';

test.describe('檔案刪除功能', () => {
  let initialFileCount = 0;
  
  test.beforeEach(async ({ page }) => {
    // 登入系統
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // 導航到檔案列表頁面
    await page.goto('/files');
    await page.waitForSelector('[data-testid="file-list"]');
    
    // 記錄初始檔案數量
    initialFileCount = await page.locator('[data-testid="file-item"]').count();
  });

  test('應成功刪除檔案並更新UI', async ({ page }) => {
    // 點擊第一個檔案的刪除按鈕
    await page.locator('[data-testid="delete-button"]').first().click();
    
    // 檢查確認對話框是否顯示
    await expect(page.locator('[data-testid="delete-confirm-dialog"]')).toBeVisible();
    await expect(page.getByText('確認刪除')).toBeVisible();
    
    // 獲取要刪除的檔案名稱
    const fileName = await page.locator('[data-testid="delete-file-name"]').textContent();
    
    // 點擊確認刪除
    await page.locator('[data-testid="confirm-delete-button"]').click();
    
    // 等待成功通知出現
    await expect(page.getByText('檔案已成功刪除')).toBeVisible();
    
    // 確認檔案列表已更新 (檔案數量減1)
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(initialFileCount - 1);
    
    // 確認被刪除的檔案不再顯示
    await expect(page.getByText(fileName!)).not.toBeVisible();
    
    // 刷新頁面，確認刪除持久化
    await page.reload();
    await page.waitForSelector('[data-testid="file-list"]');
    
    // 檢查刷新後檔案列表是否保持一致
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(initialFileCount - 1);
    await expect(page.getByText(fileName!)).not.toBeVisible();
  });

  test('應在用戶取消刪除時保留檔案', async ({ page }) => {
    // 點擊第一個檔案的刪除按鈕
    await page.locator('[data-testid="delete-button"]').first().click();
    
    // 檢查確認對話框是否顯示
    await expect(page.locator('[data-testid="delete-confirm-dialog"]')).toBeVisible();
    
    // 點擊取消按鈕
    await page.locator('[data-testid="cancel-delete-button"]').click();
    
    // 確認對話框應該消失
    await expect(page.locator('[data-testid="delete-confirm-dialog"]')).not.toBeVisible();
    
    // 檔案數量應保持不變
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(initialFileCount);
  });
  
  test('應正確處理刪除失敗情況', async ({ page, context }) => {
    // 攔截DELETE請求並模擬失敗
    await context.route('**/api/files/*', route => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          body: JSON.stringify({ detail: '伺服器處理請求時發生錯誤' })
        });
      }
      return route.continue();
    });
    
    // 點擊第一個檔案的刪除按鈕
    await page.locator('[data-testid="delete-button"]').first().click();
    
    // 檢查確認對話框是否顯示
    await expect(page.locator('[data-testid="delete-confirm-dialog"]')).toBeVisible();
    
    // 點擊確認刪除
    await page.locator('[data-testid="confirm-delete-button"]').click();
    
    // 等待錯誤通知出現
    await expect(page.getByText('伺服器處理請求時發生錯誤')).toBeVisible();
    
    // 檔案數量應保持不變
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(initialFileCount);
  });
});
```

### 3.3 聯動功能測試

```typescript
import { test, expect } from '@playwright/test';

test.describe('刪除檔案後的聯動功能', () => {
  let fileToDelete: string;
  
  test.beforeEach(async ({ page }) => {
    // 登入系統
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // 導航到檔案列表頁面
    await page.goto('/files');
    await page.waitForSelector('[data-testid="file-list"]');
    
    // 獲取第一個檔案的UUID (用於後續檢查)
    fileToDelete = await page.locator('[data-testid="file-item"]')
      .first()
      .getAttribute('data-file-uuid') || '';
  });

  test('刪除檔案後相關引用應正確清理', async ({ page }) => {
    // 首先導航到聊天頁面，檢查是否有使用第一個檔案內容的對話
    await page.goto('/chat');
    
    // 查看是否有包含目標檔案引用的對話
    const hasReferences = await page.locator(`[data-reference-file-uuid="${fileToDelete}"]`).count() > 0;
    
    if (hasReferences) {
      // 記錄引用數量
      const initialReferenceCount = await page.locator(`[data-reference-file-uuid="${fileToDelete}"]`).count();
      
      // 導航到檔案列表
      await page.goto('/files');
      await page.waitForSelector('[data-testid="file-list"]');
      
      // 找到對應的檔案並刪除
      await page.locator(`[data-file-uuid="${fileToDelete}"] [data-testid="delete-button"]`).click();
      await page.locator('[data-testid="confirm-delete-button"]').click();
      
      // 等待刪除完成
      await expect(page.getByText('檔案已成功刪除')).toBeVisible();
      
      // 返回聊天頁面
      await page.goto('/chat');
      
      // 驗證引用已被清理 (不應存在對應檔案的引用)
      await expect(page.locator(`[data-reference-file-uuid="${fileToDelete}"]`)).toHaveCount(0);
    } else {
      test.skip();
    }
  });
});
```

## 4. 測試自動化與持續整合

### 4.1 測試執行命令
```bash
# 執行所有端到端測試
npx playwright test

# 執行特定測試文件
npx playwright test file-deletion.spec.ts

# 使用特定瀏覽器測試
npx playwright test --project=chromium
```

### 4.2 CI/CD 整合
在CI Pipeline中加入端到端測試：

```yaml
e2e-tests:
  stage: test
  script:
    - npm ci
    - npx playwright install --with-deps
    - npx playwright test
  artifacts:
    when: always
    paths:
      - playwright-report/
```

## 5. 測試報告與問題追踪

### 5.1 報告格式
- HTML測試報告 (包含截圖與視頻)
- JUnit XML格式 (用於CI工具分析)
- 測試執行摘要 (測試執行時間、通過率等)

### 5.2 問題追踪
- 失敗的測試將自動創建錯誤報告
- 報告將包含：
  - 測試用例描述
  - 失敗原因
  - 環境信息
  - 截圖/視頻證據
  - 控制台日誌
  - 網絡請求日誌

## 6. 數據清理與測試隔離

### 6.1 測試前準備
- 測試開始前重置測試數據庫至已知狀態
- 使用專用的測試MinIO bucket

### 6.2 測試後清理
- 測試完成後刪除所有測試產生的數據
- 清空測試使用者的檔案和對話記錄

## 7. 測試度量與標準

### 7.1 測試覆蓋目標
- 檔案列表顯示: 100% 功能覆蓋
- 檔案排序: 100% 功能覆蓋
- 檔案刪除: 100% 功能覆蓋
- 邊界情況: 至少90% 覆蓋

### 7.2 成功標準
- 所有測試用例通過
- 無UI顯示錯誤
- 無資料不一致問題
- 功能按照PRD要求正確運作 