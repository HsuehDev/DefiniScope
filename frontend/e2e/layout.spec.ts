import { test, expect } from '@playwright/test';

test.describe('布局與導航測試', () => {
  // 設置測試前操作
  test.beforeEach(async ({ page }) => {
    // 此處假設應用已經在另一個進程中運行
    // 導航到應用首頁
    await page.goto('/app');
    
    // 等待主布局加載
    await page.waitForSelector('.min-h-screen', { state: 'visible' });
  });

  // 測試基本導航欄
  test('頂部導航欄顯示正確並可點擊', async ({ page }) => {
    // 檢查應用標題是否顯示
    await expect(page.locator('nav')).toContainText('文獻智能助手');

    // 檢查主要導航連結是否顯示
    await expect(page.locator('nav')).toContainText('檔案管理');
    await expect(page.locator('nav')).toContainText('智能對話');
    
    // 點擊「檔案管理」連結
    await page.click('text=檔案管理');
    
    // 驗證URL變更
    await expect(page).toHaveURL(/.*\/app\/files/);
    
    // 點擊「智能對話」連結
    await page.click('text=智能對話');
    
    // 驗證URL變更
    await expect(page).toHaveURL(/.*\/app\/chat/);
  });

  // 測試側邊欄折疊功能
  test('側邊欄可以折疊和展開', async ({ page }) => {
    // 找到側邊欄按鈕
    const sidebarToggleButton = page.locator('nav button[aria-controls="sidebar"]');
    
    // 檢查側邊欄默認狀態 (展開，寬度為64)
    await expect(page.locator('#sidebar')).toHaveClass(/w-64/);
    
    // 點擊側邊欄切換按鈕
    await sidebarToggleButton.click();
    
    // 等待動畫完成
    await page.waitForTimeout(350);
    
    // 檢查側邊欄現在是否折疊
    await expect(page.locator('#sidebar')).toHaveClass(/w-16/);
    
    // 再次點擊側邊欄切換按鈕
    await sidebarToggleButton.click();
    
    // 等待動畫完成
    await page.waitForTimeout(350);
    
    // 檢查側邊欄是否展開
    await expect(page.locator('#sidebar')).toHaveClass(/w-64/);
  });

  // 測試三欄布局功能
  test('三欄布局面板可以折疊和展開', async ({ page }) => {
    // 導航到聊天頁面 (使用三欄布局)
    await page.goto('/app/chat');
    
    // 等待三欄布局加載
    await page.waitForSelector('div.h-full.flex.flex-col', { state: 'visible' });
    
    // 找到左側面板折疊按鈕
    const leftPanelToggleButton = page.locator('button:has(svg path[d*="11 19l-7-7 7-7m8 14l-7-7 7-7"])');
    
    // 找到右側面板折疊按鈕
    const rightPanelToggleButton = page.locator('button:has(svg path[d*="13 5l7 7-7 7M5 5l7 7-7 7"])');
    
    // 檢查左側面板默認展開
    const leftPanel = page.locator('div.h-full.flex.flex-col > div.flex-1.flex > div:first-child');
    await expect(leftPanel).toHaveClass(/w-64/);
    
    // 點擊左側面板折疊按鈕
    await leftPanelToggleButton.click();
    
    // 等待動畫完成
    await page.waitForTimeout(350);
    
    // 檢查左側面板現在是否折疊
    await expect(leftPanel).toHaveClass(/w-0/);
    
    // 檢查右側面板默認展開
    const rightPanel = page.locator('div.h-full.flex.flex-col > div.flex-1.flex > div:last-child');
    await expect(rightPanel).toHaveClass(/w-64/);
    
    // 點擊右側面板折疊按鈕
    await rightPanelToggleButton.click();
    
    // 等待動畫完成
    await page.waitForTimeout(350);
    
    // 檢查右側面板現在是否折疊
    await expect(rightPanel).toHaveClass(/w-0/);
  });

  // 測試響應式設計 (手機視圖)
  test('在小螢幕上顯示面板選擇器並能切換面板', async ({ page }) => {
    // 設置視窗大小為手機尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 導航到聊天頁面
    await page.goto('/app/chat');
    
    // 等待頁面加載
    await page.waitForSelector('div.md\\:hidden', { state: 'visible' });
    
    // 檢查面板選擇器是否顯示
    await expect(page.locator('div.md\\:hidden')).toBeVisible();
    
    // 檢查默認顯示中央面板 (智能對話)
    const centerPanelButton = page.locator('button:has-text("智能對話")');
    await expect(centerPanelButton).toHaveClass(/border-blue-500/);
    
    // 點擊左側面板按鈕 (檔案管理)
    const leftPanelButton = page.locator('button:has-text("檔案管理")');
    await leftPanelButton.click();
    
    // 檢查是否切換到左側面板
    await expect(leftPanelButton).toHaveClass(/border-blue-500/);
    await expect(centerPanelButton).not.toHaveClass(/border-blue-500/);
    
    // 點擊右側面板按鈕 (參考資訊)
    const rightPanelButton = page.locator('button:has-text("參考資訊")');
    await rightPanelButton.click();
    
    // 檢查是否切換到右側面板
    await expect(rightPanelButton).toHaveClass(/border-blue-500/);
    await expect(leftPanelButton).not.toHaveClass(/border-blue-500/);
  });

  // 測試鍵盤導航
  test('支援使用鍵盤導航', async ({ page }) => {
    // 導航到應用首頁
    await page.goto('/app');
    
    // 按Tab鍵聚焦到側邊欄切換按鈕
    await page.keyboard.press('Tab');
    
    // 檢查側邊欄切換按鈕是否獲得焦點
    await expect(page.locator('button:focus')).toHaveAttribute('aria-controls', 'sidebar');
    
    // 按Enter鍵觸發側邊欄切換
    await page.keyboard.press('Enter');
    
    // 等待動畫完成
    await page.waitForTimeout(350);
    
    // 檢查側邊欄是否折疊
    await expect(page.locator('#sidebar')).toHaveClass(/w-16/);
    
    // 繼續按Tab鍵直到聚焦到"檔案管理"連結
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
    }
    
    // 按Enter鍵跳轉到檔案管理頁面
    await page.keyboard.press('Enter');
    
    // 驗證URL變更
    await expect(page).toHaveURL(/.*\/app\/files/);
  });
}); 