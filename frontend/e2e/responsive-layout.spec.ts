import { test, expect } from '@playwright/test';

// 定義要測試的不同屏幕尺寸
const screenSizes = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'large-desktop', width: 1920, height: 1080 }
];

test.describe('響應式布局視覺測試', () => {
  // 測試主佈局在各種屏幕尺寸的顯示
  test('主佈局在不同屏幕尺寸下的顯示', async ({ page }) => {
    for (const size of screenSizes) {
      // 設置屏幕尺寸
      await page.setViewportSize({ width: size.width, height: size.height });
      
      // 導航到應用首頁
      await page.goto('/app');
      
      // 等待主要內容加載
      await page.waitForSelector('.min-h-screen', { state: 'visible' });
      
      // 拍攝屏幕截圖並與基準圖比較
      await expect(page).toHaveScreenshot(`main-layout-${size.name}.png`);
      
      // 檢查側邊欄在不同尺寸下的狀態
      const sidebar = page.locator('#sidebar');
      
      if (size.width < 768) {
        // 小屏幕下檢查側邊欄是否合適展示
        await expect(sidebar).toBeVisible();
        await expect(sidebar).toHaveClass(/w-16/);
      } else {
        // 大屏幕下檢查側邊欄是否完全展開
        await expect(sidebar).toBeVisible();
        await expect(sidebar).toHaveClass(/w-64/);
      }
    }
  });

  // 測試三欄布局在各種屏幕尺寸的響應式行為
  test('三欄布局在不同屏幕尺寸下的顯示', async ({ page }) => {
    for (const size of screenSizes) {
      // 設置屏幕尺寸
      await page.setViewportSize({ width: size.width, height: size.height });
      
      // 導航到聊天頁面（使用三欄布局）
      await page.goto('/app/chat');
      
      // 等待三欄布局加載
      await page.waitForSelector('div.h-full.flex.flex-col', { state: 'visible' });
      
      // 拍攝屏幕截圖並與基準圖比較
      await expect(page).toHaveScreenshot(`three-column-layout-${size.name}.png`);
      
      if (size.width < 768) {
        // 檢查小屏幕下是否顯示面板選擇器
        await expect(page.locator('div.md\\:hidden')).toBeVisible();
        
        // 檢查默認應顯示中央面板
        const centerPanelButton = page.locator('button:has-text("智能對話")');
        await expect(centerPanelButton).toHaveClass(/border-blue-500/);
        
        // 點擊左側面板按鈕
        await page.click('button:has-text("檔案管理")');
        
        // 截圖檢查左側面板是否顯示
        await expect(page).toHaveScreenshot(`three-column-layout-${size.name}-left-panel.png`);
        
        // 點擊右側面板按鈕
        await page.click('button:has-text("參考資訊")');
        
        // 截圖檢查右側面板是否顯示
        await expect(page).toHaveScreenshot(`three-column-layout-${size.name}-right-panel.png`);
      } else {
        // 大屏幕下檢查三個面板是否同時顯示
        await expect(page.locator('div.h-full.flex.flex-col > div.flex-1.flex > div:first-child')).toBeVisible();
        await expect(page.locator('div.h-full.flex.flex-col > div.flex-1.flex > div:nth-child(2)')).toBeVisible();
        await expect(page.locator('div.h-full.flex.flex-col > div.flex-1.flex > div:last-child')).toBeVisible();
        
        // 測試面板折疊功能
        // 折疊左側面板
        const leftPanelToggleButton = page.locator('button:has(svg path[d*="11 19l-7-7 7-7m8 14l-7-7 7-7"])');
        await leftPanelToggleButton.click();
        
        // 等待動畫完成
        await page.waitForTimeout(350);
        
        // 截圖檢查左側面板折疊
        await expect(page).toHaveScreenshot(`three-column-layout-${size.name}-left-collapsed.png`);
        
        // 折疊右側面板
        const rightPanelToggleButton = page.locator('button:has(svg path[d*="13 5l7 7-7 7M5 5l7 7-7 7"])');
        await rightPanelToggleButton.click();
        
        // 等待動畫完成
        await page.waitForTimeout(350);
        
        // 截圖檢查兩側面板都折疊
        await expect(page).toHaveScreenshot(`three-column-layout-${size.name}-both-collapsed.png`);
      }
    }
  });

  // 測試深色模式支持（如果有）
  test.skip('深色模式下的布局顯示', async ({ page }) => {
    // 設置桌面尺寸
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // 導航到應用首頁
    await page.goto('/app');
    
    // 等待頁面加載
    await page.waitForSelector('.min-h-screen', { state: 'visible' });
    
    // 模擬深色模式設置
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    // 拍攝深色模式截圖
    await expect(page).toHaveScreenshot('main-layout-dark-mode.png');
    
    // 導航到聊天頁面
    await page.goto('/app/chat');
    
    // 等待頁面加載
    await page.waitForSelector('div.h-full.flex.flex-col', { state: 'visible' });
    
    // 拍攝深色模式截圖
    await expect(page).toHaveScreenshot('three-column-layout-dark-mode.png');
  });

  // 測試動態調整大小（拖動邊緣改變面板大小，如果支持）
  test.skip('面板大小動態調整', async ({ page }) => {
    // 此功能需要自定義實現，這裡僅為示例
    // 設置桌面尺寸
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // 導航到聊天頁面
    await page.goto('/app/chat');
    
    // 等待頁面加載
    await page.waitForSelector('div.h-full.flex.flex-col', { state: 'visible' });
    
    // 假設有一個拖動手柄
    const resizeHandle = page.locator('.resize-handle');
    
    // 拖動調整大小
    await resizeHandle.hover();
    await page.mouse.down();
    await page.mouse.move(100, 0);
    await page.mouse.up();
    
    // 拍攝調整後的截圖
    await expect(page).toHaveScreenshot('three-column-layout-resized.png');
  });
}); 