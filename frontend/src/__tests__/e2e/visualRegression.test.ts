import { test, expect } from '@playwright/test';

// 視覺回歸測試
test.describe('PDF渲染視覺回歸測試', () => {
  // 測試前先登入系統
  test.beforeEach(async ({ page }) => {
    // 導航到登入頁面
    await page.goto('/login');
    
    // 填寫表單
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // 提交表單
    await page.click('button[type="submit"]');
    
    // 等待導航到首頁
    await page.waitForURL('/');
  });
  
  // PDF預覽器基本渲染
  test('PDF預覽器基本渲染視覺測試', async ({ page }) => {
    // 導航到文件列表
    await page.goto('/files');
    
    // 點擊預覽按鈕
    await page.click('button[aria-label="預覽文件"]');
    
    // 等待PDF預覽器加載
    await page.waitForSelector('.react-pdf__Document');
    
    // 確保PDF完全渲染
    await page.waitForTimeout(1000);
    
    // 進行視覺比較
    await expect(page.locator('.pdf-viewer-container')).toHaveScreenshot('pdf-viewer-basic.png', {
      maxDiffPixelRatio: 0.05, // 允許5%的像素差異
      threshold: 0.1,           // 像素匹配閾值
    });
    
    // 測試頁面導航後的渲染
    await page.click('button:has-text("下一頁")');
    await page.waitForTimeout(1000);
    
    // 測試翻頁後的視覺效果
    await expect(page.locator('.pdf-viewer-container')).toHaveScreenshot('pdf-viewer-page2.png', {
      maxDiffPixelRatio: 0.05,
      threshold: 0.1,
    });
  });
  
  // 測試高亮功能的視覺效果
  test('句子高亮視覺效果測試', async ({ page }) => {
    // 先創建一個聊天對話
    await page.goto('/chat');
    
    // 輸入查詢文本
    await page.fill('textarea[placeholder*="輸入您的問題"]', '什麼是自適應專業知識？');
    await page.press('textarea[placeholder*="輸入您的問題"]', 'Enter');
    
    // 等待回應載入
    await page.waitForSelector('.chat-message.assistant');
    
    // 查找引用句子並點擊
    const referenceSelector = '.sentence-reference';
    await page.waitForSelector(referenceSelector);
    await page.click(referenceSelector);
    
    // 等待PDF預覽模態框打開
    await page.waitForSelector('.pdf-modal');
    
    // 確認PDF已加載
    await page.waitForSelector('.react-pdf__Document');
    
    // 等待高亮元素完全渲染
    await page.waitForSelector('.pdf-text-highlight');
    await page.waitForTimeout(1000);
    
    // 進行視覺比較
    await expect(page.locator('.pdf-modal')).toHaveScreenshot('pdf-highlight.png', {
      maxDiffPixelRatio: 0.05,
      threshold: 0.1,
    });
    
    // 測試高亮的動畫效果
    await page.waitForTimeout(1000); // 等待動畫效果
    await expect(page.locator('.pdf-text-highlight')).toHaveScreenshot('highlight-animation.png', {
      animations: 'disabled', // 禁用動畫以穩定測試
    });
  });
  
  // 測試不同屏幕尺寸下的響應式布局
  test('不同屏幕尺寸下的PDF預覽響應式布局', async ({ page }) => {
    // 導航到文件列表
    await page.goto('/files');
    
    // 點擊預覽按鈕
    await page.click('button[aria-label="預覽文件"]');
    
    // 等待PDF預覽器加載
    await page.waitForSelector('.react-pdf__Document');
    
    // 桌面尺寸視覺測試
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await expect(page.locator('.pdf-modal')).toHaveScreenshot('pdf-viewer-desktop.png');
    
    // 平板尺寸視覺測試
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await expect(page.locator('.pdf-modal')).toHaveScreenshot('pdf-viewer-tablet.png');
    
    // 手機尺寸視覺測試
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await expect(page.locator('.pdf-modal')).toHaveScreenshot('pdf-viewer-mobile.png');
  });
  
  // 測試不同瀏覽器下的一致性
  test.skip('跨瀏覽器渲染一致性測試', async ({ page, browserName }) => {
    // 打開同一個PDF，在不同瀏覽器進行測試
    await page.goto('/files');
    await page.click('button[aria-label="預覽文件"]');
    await page.waitForSelector('.react-pdf__Document');
    await page.waitForTimeout(1000);
    
    // 使用browserName標記不同瀏覽器的截圖
    await expect(page.locator('.pdf-viewer-container')).toHaveScreenshot(`pdf-viewer-${browserName}.png`, {
      maxDiffPixelRatio: 0.1, // 不同瀏覽器允許更大的容差
      threshold: 0.2,
    });
    
    // 測試高亮效果
    await page.click('button:has-text("下一頁")');
    await page.waitForTimeout(500);
    
    // 假設頁面2有高亮
    const highlightExists = await page.isVisible('.pdf-text-highlight');
    if (highlightExists) {
      await expect(page.locator('.pdf-text-highlight')).toHaveScreenshot(`highlight-${browserName}.png`, {
        maxDiffPixelRatio: 0.1,
      });
    }
  });
  
  // 測試渲染效能
  test('PDF渲染效能測試', async ({ page }) => {
    // 導航到文件列表
    await page.goto('/files');
    
    // 開始性能指標收集
    await page.evaluate(() => {
      window.performance.mark('start_pdf_load');
    });
    
    // 點擊預覽按鈕
    await page.click('button[aria-label="預覽文件"]');
    
    // 等待PDF預覽器完全加載
    await page.waitForSelector('.react-pdf__Document');
    await page.waitForSelector('.react-pdf__Page[data-page-number="1"]');
    
    // 結束性能標記
    const perfMetrics = await page.evaluate(() => {
      window.performance.mark('end_pdf_load');
      const measure = window.performance.measure('pdf_load_time', 'start_pdf_load', 'end_pdf_load');
      return {
        pdfLoadTime: measure.duration,
        // 收集其他可能的效能指標
        dcl: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        load: performance.timing.loadEventEnd - performance.timing.navigationStart,
      };
    });
    
    // 輸出性能指標（可選）
    console.log('PDF渲染效能指標', perfMetrics);
    
    // 確保PDF渲染時間在可接受範圍內
    expect(perfMetrics.pdfLoadTime).toBeLessThan(5000); // 5秒內完成渲染
  });
}); 