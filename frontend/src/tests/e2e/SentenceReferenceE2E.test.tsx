import { test, expect } from '@playwright/test';

/**
 * 互動式句子引用的端到端測試
 * 
 * 這個測試文件使用Playwright測試框架來模擬用戶完整的交互流程
 */

test.describe('互動式句子引用完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登入系統
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 等待導航至主頁完成
    await page.waitForURL('/');
    
    // 確保至少有一個對話存在
    await expect(page.locator('.conversation-list-item')).toBeVisible();
    
    // 點擊第一個對話
    await page.click('.conversation-list-item:first-child');
    
    // 等待消息載入
    await page.waitForSelector('.chat-message');
  });
  
  test('從聊天消息點擊引用標籤到查看PDF的完整流程', async ({ page }) => {
    // 查找包含引用標籤的消息
    const messageWithReference = page.locator('.chat-message:has(.reference-tag)').first();
    await expect(messageWithReference).toBeVisible();
    
    // 找到引用標籤並點擊
    const referenceTag = messageWithReference.locator('.reference-tag').first();
    await referenceTag.click();
    
    // 等待引用選項菜單顯示
    await expect(page.locator('.reference-menu')).toBeVisible();
    
    // 點擊「在PDF中查看」選項
    await page.click('.reference-menu >> text=在PDF中查看');
    
    // 等待PDF查看器顯示
    await expect(page.locator('.pdf-viewer-modal')).toBeVisible();
    
    // 驗證PDF已正確載入
    await expect(page.locator('.pdf-container canvas')).toBeVisible();
    
    // 驗證高亮的句子存在
    await expect(page.locator('.highlighted-sentence')).toBeVisible();
    
    // 測試頁面導航功能
    // 點擊下一頁按鈕
    await page.click('button[aria-label="下一頁"]');
    
    // 驗證頁碼已更新
    const currentPageIndicator = page.locator('.page-indicator');
    const pageText = await currentPageIndicator.textContent();
    
    // 檢查頁碼是否更新（假設格式為「第 X 頁，共 Y 頁」）
    const pageMatch = pageText?.match(/第 (\d+) 頁/);
    expect(pageMatch?.[1]).not.toBe('1');
    
    // 關閉PDF查看器
    await page.click('button[aria-label="關閉"]');
    
    // 驗證PDF查看器已關閉
    await expect(page.locator('.pdf-viewer-modal')).not.toBeVisible();
  });
  
  test('從聊天消息查看引用上下文的流程', async ({ page }) => {
    // 查找包含引用標籤的消息
    const messageWithReference = page.locator('.chat-message:has(.reference-tag)').first();
    await expect(messageWithReference).toBeVisible();
    
    // 找到引用標籤並點擊
    const referenceTag = messageWithReference.locator('.reference-tag').first();
    await referenceTag.click();
    
    // 等待引用選項菜單顯示
    await expect(page.locator('.reference-menu')).toBeVisible();
    
    // 點擊「查看上下文」選項
    await page.click('.reference-menu >> text=查看上下文');
    
    // 等待上下文查看器顯示
    await expect(page.locator('.context-viewer-modal')).toBeVisible();
    
    // 驗證引用句子被高亮顯示
    const highlightedSentence = page.locator('.highlighted-sentence');
    await expect(highlightedSentence).toBeVisible();
    
    // 驗證上下文句子存在
    await expect(page.locator('.context-sentence')).toBeVisible();
    
    // 測試「在PDF中查看」按鈕
    await page.click('.context-viewer-modal button:has-text("在PDF中查看")');
    
    // 確認上下文查看器已關閉，且PDF查看器已打開
    await expect(page.locator('.context-viewer-modal')).not.toBeVisible();
    await expect(page.locator('.pdf-viewer-modal')).toBeVisible();
    
    // 關閉PDF查看器
    await page.click('button[aria-label="關閉"]');
  });
  
  test('處理多個引用標籤的情況', async ({ page }) => {
    // 查找包含多個引用標籤的消息
    const messageWithMultipleReferences = page.locator('.chat-message:has(.reference-tag:nth-child(2))').first();
    
    // 如果沒有包含多個引用標籤的消息，則跳過此測試
    if (await messageWithMultipleReferences.count() === 0) {
      test.skip();
      return;
    }
    
    await expect(messageWithMultipleReferences).toBeVisible();
    
    // 獲取所有引用標籤
    const referenceTags = messageWithMultipleReferences.locator('.reference-tag');
    const count = await referenceTags.count();
    expect(count).toBeGreaterThan(1);
    
    // 測試每個引用標籤
    for (let i = 0; i < Math.min(count, 3); i++) {  // 最多測試前3個
      const tag = referenceTags.nth(i);
      
      // 點擊標籤
      await tag.click();
      
      // 等待菜單顯示
      await expect(page.locator('.reference-menu')).toBeVisible();
      
      // 點擊查看上下文
      await page.click('.reference-menu >> text=查看上下文');
      
      // 驗證上下文查看器顯示
      await expect(page.locator('.context-viewer-modal')).toBeVisible();
      
      // 關閉上下文查看器
      await page.click('button[aria-label="關閉"]');
      
      // 等待一下，確保UI更新
      await page.waitForTimeout(500);
    }
  });
  
  test('測試引用標籤懸停顯示完整內容', async ({ page }) => {
    // 查找包含引用標籤的消息
    const messageWithReference = page.locator('.chat-message:has(.reference-tag)').first();
    await expect(messageWithReference).toBeVisible();
    
    // 找到引用標籤
    const referenceTag = messageWithReference.locator('.reference-tag').first();
    
    // 懸停在標籤上
    await referenceTag.hover();
    
    // 等待懸停提示顯示
    await expect(page.locator('.reference-tooltip')).toBeVisible();
    
    // 驗證懸停提示包含完整句子內容
    const tooltipText = await page.locator('.reference-tooltip').textContent();
    const tagText = await referenceTag.textContent();
    
    // 懸停提示文本應該比標籤顯示的更長或相等
    expect(tooltipText?.length).toBeGreaterThanOrEqual(tagText?.length || 0);
    
    // 移開懸停
    await page.mouse.move(0, 0);
    
    // 驗證懸停提示已消失
    await expect(page.locator('.reference-tooltip')).not.toBeVisible();
  });
}); 