import { test, expect } from '@playwright/test';

// PDF預覽和句子高亮測試
test.describe('PDF預覽與句子高亮功能', () => {
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
  
  // 測試基本PDF預覽功能
  test('基本PDF預覽功能', async ({ page }) => {
    // 導航到文件列表
    await page.goto('/files');
    
    // 點擊預覽按鈕
    await page.click('button[aria-label="預覽文件"]');
    
    // 等待PDF預覽器加載
    await page.waitForSelector('.react-pdf__Document');
    
    // 檢查頁碼顯示
    const pageInfo = await page.textContent('.pdf-page-info');
    expect(pageInfo).toContain('1 /');
    
    // 測試頁面導航 - 下一頁
    await page.click('button:has-text("下一頁")');
    
    // 確認頁碼更新
    const updatedPageInfo = await page.textContent('.pdf-page-info');
    expect(updatedPageInfo).toContain('2 /');
    
    // 測試縮放功能
    await page.click('button[aria-label="放大"]');
    
    // 測試縮略圖側邊欄
    await page.click('.pdf-thumbnail');
    
    // 關閉預覽模態框
    await page.click('button[aria-label="關閉預覽"]');
  });
  
  // 測試從引用跳轉到PDF特定位置
  test('從引用跳轉到PDF特定位置', async ({ page }) => {
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
    
    // 捕獲網絡請求
    const [pdfPreviewRequest] = await Promise.all([
      // 等待獲取句子信息的API請求
      page.waitForRequest(request => 
        request.url().includes('/api/files/') && 
        request.url().includes('/sentences/')
      ),
      // 點擊引用
      page.click(referenceSelector)
    ]);
    
    // 驗證請求URL包含文件UUID和句子UUID
    const requestUrl = pdfPreviewRequest.url();
    expect(requestUrl).toContain('/api/files/');
    expect(requestUrl).toContain('/sentences/');
    
    // 等待PDF預覽模態框打開
    await page.waitForSelector('.pdf-modal');
    
    // 確認PDF已加載
    await page.waitForSelector('.react-pdf__Document');
    
    // 驗證高亮元素存在
    const highlightElement = await page.waitForSelector('.pdf-text-highlight');
    expect(highlightElement).toBeTruthy();
    
    // 獲取高亮元素的位置
    const boundingBox = await highlightElement.boundingBox();
    expect(boundingBox).not.toBeNull();
    
    // 驗證頁碼已跳轉到正確頁
    const pageNumber = await page.textContent('.pdf-page-info');
    expect(pageNumber).not.toContain('1 /'); // 應該不是第一頁
    
    // 關閉預覽模態框
    await page.click('button[aria-label="關閉預覽"]');
  });
  
  // 測試通過URL參數直接跳轉到特定頁面和高亮句子
  test('通過URL參數直接跳轉到特定頁面和高亮句子', async ({ page }) => {
    // 假設我們有一個文件UUID和句子UUID
    const fileUuid = 'test-file-uuid';
    const sentenceUuid = 'test-sentence-uuid';
    
    // 直接通過URL參數導航到PDF預覽頁面
    await page.goto(`/preview/${fileUuid}?page=3&highlight=${sentenceUuid}`);
    
    // 等待PDF載入
    await page.waitForSelector('.react-pdf__Document');
    
    // 驗證頁碼是否正確
    const pageInfo = await page.textContent('.pdf-page-info');
    expect(pageInfo).toContain('3 /');
    
    // 驗證高亮元素是否存在
    const highlightElement = await page.waitForSelector('.pdf-text-highlight');
    expect(highlightElement).toBeTruthy();
  });
  
  // 測試在不同瀏覽器尺寸下的響應式行為
  test('響應式設計兼容性', async ({ page }) => {
    // 桌面尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/files');
    await page.click('button[aria-label="預覽文件"]');
    await page.waitForSelector('.react-pdf__Document');
    
    // 檢查縮略圖側邊欄是否可見
    const sidebarVisible = await page.isVisible('.pdf-thumbnails-sidebar');
    expect(sidebarVisible).toBeTruthy();
    
    // 平板尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // 等待響應式布局調整
    await page.waitForTimeout(500);
    
    // 在小屏幕上可能會自動隱藏縮略圖
    const sidebarVisibleTablet = await page.isVisible('.pdf-thumbnails-sidebar');
    
    // 如果側邊欄可見，測試切換按鈕
    if (sidebarVisibleTablet) {
      await page.click('button[aria-label="切換縮略圖"]');
      const sidebarHidden = await page.isHidden('.pdf-thumbnails-sidebar');
      expect(sidebarHidden).toBeTruthy();
    }
    
    // 手機尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 等待響應式布局調整
    await page.waitForTimeout(500);
    
    // 確保工具欄還是可見的
    const toolbarVisible = await page.isVisible('.pdf-toolbar');
    expect(toolbarVisible).toBeTruthy();
  });
}); 