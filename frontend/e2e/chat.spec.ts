import { test, expect } from '@playwright/test';

// 模擬後端的URL
const API_BASE_URL = 'http://localhost:8000';

// 設置測試前操作
test.beforeEach(async ({ page }) => {
  // 假設我們已登入並重定向到應用主頁面
  await page.goto('/app');
  
  // 等待頁面加載完成
  await page.waitForSelector('.chat-container', { state: 'visible' });
});

test.describe('聊天界面功能測試', () => {
  // 測試基本的提問和接收回答流程
  test('用戶能夠發送消息並接收回答', async ({ page }) => {
    // 輸入消息
    await page.fill('textarea[placeholder="請先在這裡輸入問題文字..."]', '什麼是自適應專業知識？');
    
    // 點擊發送按鈕
    await page.click('button:has-text("發送")');
    
    // 檢查用戶消息是否顯示在聊天界面
    await expect(page.locator('.chat-container')).toContainText('什麼是自適應專業知識？');
    
    // 檢查處理中狀態是否顯示
    await expect(page.locator('.chat-container')).toContainText('處理中...');
    
    // 等待回答出現（模擬後端處理時間）
    await page.waitForSelector('.chat-container .assistant-message', { 
      state: 'visible',
      timeout: 10000 // 假設回答在10秒內出現
    });
    
    // 檢查是否有助手回答
    const assistantMessage = page.locator('.chat-container .assistant-message');
    await expect(assistantMessage).toBeVisible();
    
    // 檢查回答是否包含引用
    await expect(page.locator('.chat-container')).toContainText('引用來源');
  });
  
  // 測試輸入框快捷鍵功能
  test('輸入框支持Enter發送和Shift+Enter換行', async ({ page }) => {
    // 獲取輸入框元素
    const textarea = page.locator('textarea[placeholder="請先在這裡輸入問題文字..."]');
    
    // 測試Enter發送功能
    await textarea.fill('測試Enter發送');
    await textarea.press('Enter');
    
    // 檢查消息是否發送
    await expect(page.locator('.chat-container')).toContainText('測試Enter發送');
    
    // 等待一下，確保UI更新
    await page.waitForTimeout(500);
    
    // 測試Shift+Enter換行功能
    await textarea.fill('第一行');
    await textarea.press('Shift+Enter');
    
    // 添加第二行
    await page.keyboard.type('第二行');
    
    // 檢查輸入框內容
    const textareaContent = await textarea.inputValue();
    expect(textareaContent).toContain('第一行');
    expect(textareaContent).toContain('第二行');
    
    // 發送消息
    await textarea.press('Enter');
    
    // 檢查多行消息是否正確顯示
    await expect(page.locator('.chat-container')).toContainText('第一行');
    await expect(page.locator('.chat-container')).toContainText('第二行');
  });
  
  // 測試中文輸入法下的快捷鍵功能
  test('中文輸入法下的快捷鍵功能', async ({ page }) => {
    // 獲取輸入框元素
    const textarea = page.locator('textarea[placeholder="請先在這裡輸入問題文字..."]');
    
    // 模擬中文輸入法輸入
    await textarea.click();
    
    // 先輸入一些文字
    await page.keyboard.type('測試中文輸入');
    
    // 模擬IME輸入過程
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        // 觸發compositionstart事件
        const startEvent = new Event('compositionstart');
        textarea.dispatchEvent(startEvent);
        
        // 在組合狀態下模擬按Enter鍵
        const enterEvent = new KeyboardEvent('keydown', { 
          key: 'Enter',
          bubbles: true,
          cancelable: true
        });
        textarea.dispatchEvent(enterEvent);
        
        // 結束IME輸入
        const endEvent = new Event('compositionend');
        textarea.dispatchEvent(endEvent);
      }
    });
    
    // 在IME結束後，正常輸入回車發送消息
    await textarea.press('Enter');
    
    // 檢查消息是否發送
    await expect(page.locator('.chat-container')).toContainText('測試中文輸入');
  });
  
  // 測試點擊引用句子
  test('點擊引用句子應顯示原文', async ({ page }) => {
    // 發送一個查詢
    await page.fill('textarea[placeholder="請先在這裡輸入問題文字..."]', '什麼是自適應專業知識？');
    await page.click('button:has-text("發送")');
    
    // 等待回答出現
    await page.waitForSelector('.chat-container .assistant-message', { 
      state: 'visible',
      timeout: 10000
    });
    
    // 等待引用區域出現
    await page.waitForSelector('.reference-display', { state: 'visible' });
    
    // 點擊引用句子
    await page.click('.reference-display');
    
    // 檢查PDF預覽是否出現
    await expect(page.locator('.pdf-preview-modal')).toBeVisible();
    
    // 檢查高亮句子是否顯示
    await expect(page.locator('.pdf-preview-modal .highlighted-text')).toBeVisible();
  });
  
  // 測試長消息的顯示和自動滾動
  test('長消息的顯示和自動滾動', async ({ page }) => {
    // 創建一個很長的測試消息
    const longMessage = '這是一個很長的測試消息。'.repeat(20);
    
    // 輸入長消息
    await page.fill('textarea[placeholder="請先在這裡輸入問題文字..."]', longMessage);
    await page.click('button:has-text("發送")');
    
    // 檢查消息是否顯示
    await expect(page.locator('.chat-container')).toContainText('這是一個很長的測試消息');
    
    // 檢查是否自動滾動到底部
    await page.waitForFunction(() => {
      const container = document.querySelector('.chat-container div[class*="overflow-y-auto"]');
      if (!container) return false;
      
      // 檢查滾動位置是否接近底部
      const scrollBottom = container.scrollTop + container.clientHeight;
      return Math.abs(scrollBottom - container.scrollHeight) < 20;
    });
  });
  
  // 測試發送按鈕在處理中的禁用狀態
  test('處理消息時發送按鈕應被禁用', async ({ page }) => {
    // 輸入消息
    await page.fill('textarea[placeholder="請先在這裡輸入問題文字..."]', '測試消息');
    
    // 獲取發送按鈕並檢查初始狀態
    const sendButton = page.locator('button:has-text("發送")');
    await expect(sendButton).toBeEnabled();
    
    // 點擊發送
    await sendButton.click();
    
    // 檢查按鈕是否變為禁用狀態
    await expect(page.locator('button:has-text("處理中...")')).toBeDisabled();
    
    // 等待回答完成
    await page.waitForSelector('.chat-container .assistant-message', { 
      state: 'visible',
      timeout: 10000
    });
    
    // 檢查按鈕是否恢復可用狀態
    await expect(page.locator('button:has-text("發送")')).toBeEnabled();
  });
}); 