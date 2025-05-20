# 中文輸入法快捷鍵測試指南

## 1. 概述

本文檔專門針對聊天界面在中文輸入法環境下的快捷鍵功能測試提供詳細指南。由於中文輸入法的特殊性，Enter鍵和Shift+Enter鍵的行為可能與一般輸入情況不同，需要專門的測試策略確保功能在各種環境下正常運作。

## 2. 中文輸入法的特性與挑戰

### 2.1 IME 組合模式 (Composition Mode)

中文輸入法通常有兩個主要階段：
1. **組合階段**：用戶輸入拼音（或其他輸入方式）但尚未確認選字
2. **確認階段**：用戶選擇了具體漢字，輸入完成

在組合階段，Enter 鍵通常用於**確認當前輸入**，而非執行應用程式定義的 Enter 鍵功能（如發送消息）。這導致在輸入法活動時，快捷鍵功能可能被輸入法攔截而無法傳遞給應用程式。

### 2.2 輸入法事件流程

在 DOM 事件中，輸入法相關事件包括：
- `compositionstart`: 輸入法組合開始
- `compositionupdate`: 輸入法組合更新
- `compositionend`: 輸入法組合結束
- `keydown`/`keyup`: 鍵盤按下/鬆開事件
- `input`: 輸入內容改變

**注意**：在中文輸入過程中，`keydown` 事件仍會觸發，但應用程式需要檢測是否處於輸入法組合狀態，避免錯誤處理鍵盤事件。

## 3. 測試策略

### 3.1 單元測試中模擬輸入法狀態

我們使用 React Testing Library 和 Vitest 進行單元測試。關鍵在於準確模擬輸入法的狀態轉換。

#### 模擬組合狀態的代碼示例：

```typescript
// 模擬IME組合狀態
const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');

// 先輸入一些文字
userEvent.type(inputElement, '測試');

// 觸發輸入法組合開始
fireEvent.compositionStart(inputElement);

// 在組合狀態下按Enter鍵
fireEvent.keyDown(inputElement, { key: 'Enter' });

// 驗證此時不應發送消息
expect(mockSendMessage).not.toHaveBeenCalled();

// 觸發輸入法組合結束
fireEvent.compositionEnd(inputElement);

// 再次按Enter鍵，此時應該發送消息
fireEvent.keyDown(inputElement, { key: 'Enter' });

// 驗證消息已發送
expect(mockSendMessage).toHaveBeenCalledWith('測試');
```

### 3.2 端到端測試中模擬輸入法

在 Playwright 中模擬輸入法行為需要直接操作瀏覽器 DOM 事件。

#### Playwright 模擬輸入法事件示例：

```typescript
// 獲取輸入框
const textarea = page.locator('textarea[placeholder="請先在這裡輸入問題文字..."]');

// 先輸入一些文字
await textarea.fill('測試');

// 使用 evaluate 在頁面上下文中模擬輸入法事件
await page.evaluate(() => {
  const textarea = document.querySelector('textarea');
  if (!textarea) return;
  
  // 模擬輸入法組合開始
  const startEvent = new Event('compositionstart', { bubbles: true });
  textarea.dispatchEvent(startEvent);
  
  // 模擬組合中的Enter按下
  const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  textarea.dispatchEvent(enterEvent);
  
  // 模擬輸入法組合結束
  const endEvent = new Event('compositionend', { bubbles: true });
  textarea.dispatchEvent(endEvent);
});

// 組合結束後的Enter應該發送消息
await textarea.press('Enter');

// 檢查消息是否發送
await expect(page.locator('.chat-container')).toContainText('測試');
```

## 4. 各操作系統中文輸入法測試方法

### 4.1 Windows 系統

#### 微軟拼音輸入法

特點：
- 使用 Enter 鍵確認選字
- 使用空格鍵選擇第一個候選字
- 在有候選字窗口時，Shift+Enter 通常不會傳遞給應用程式

測試步驟：
1. 啟用微軟拼音輸入法
2. 輸入框中輸入拼音 "ni hao"
3. 出現候選字窗口時，按 Enter 確認選字
4. 驗證候選字確認後，再次按 Enter 是否正確發送消息
5. 重複測試，但使用 Shift+Enter，確認能否正常換行

#### 搜狗拼音輸入法

特點：
- 候選字窗口可被各種方式關閉（如空格鍵）
- 有多種模式（中文、英文、雙拼等）

測試步驟：
1. 安裝並啟用搜狗拼音
2. 測試在中文模式和英文模式下的 Enter 和 Shift+Enter 行為
3. 測試在候選詞顯示時按 Enter 的行為
4. 測試組合狀態中按 Enter 後的行為

### 4.2 macOS 系統

#### 內建中文輸入法

特點：
- 使用 Enter 或 Return 鍵確認當前選字
- 使用標點符號或空格自動確認選字
- 常使用 Shift+Enter 換行

測試步驟：
1. 啟用內建中文輸入法
2. 輸入拼音 "ni hao"，此時不要確認選字
3. 按 Enter 鍵，確認選字完成
4. 再次按 Enter 鍵，測試是否發送消息
5. 測試 Shift+Enter 行為，確認是否正確換行

#### 其他第三方輸入法

如搜狗拼音、百度輸入法等也需要按相同流程測試。

### 4.3 Linux 系統

#### Fcitx 框架下的輸入法

特點：
- 多用於桌面 Linux 環境
- 支持多種中文輸入方式

測試步驟:
1. 啟用 Fcitx 框架下的中文輸入法
2. 輸入拼音並測試 Enter 鍵行為
3. 測試組合狀態中的 Shift+Enter 行為

#### IBus 框架下的輸入法

特點：
- 是 GNOME 桌面的標準輸入法框架
- 行為可能與 Fcitx 略有不同

測試步驟與 Fcitx 類似，但需單獨測試。

## 5. 常見問題與解決方案

### 5.1 輸入法與Enter鍵衝突

**問題描述**：在某些輸入法中，Enter 鍵既用於確認選字，又應用於發送消息，導致用戶無法正常完成中文輸入。

**解決方案**：
- 實現輸入法狀態檢測，通過監聽 `compositionstart` 和 `compositionend` 事件，僅在非組合狀態下處理 Enter 鍵發送功能
- 提供明確的視覺提示，指示當前是否處於中文輸入狀態
- 考慮在輸入法活動時臨時禁用快捷鍵，直到輸入完成

實現代碼示例：

```typescript
const [isComposing, setIsComposing] = useState(false);

const handleCompositionStart = () => {
  setIsComposing(true);
};

const handleCompositionEnd = () => {
  setIsComposing(false);
};

const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
    e.preventDefault();
    handleSendMessage();
  }
};

return (
  <textarea
    onCompositionStart={handleCompositionStart}
    onCompositionEnd={handleCompositionEnd}
    onKeyDown={handleKeyDown}
    // 其他屬性
  />
);
```

### 5.2 Shift+Enter換行問題

**問題描述**：某些輸入法可能攔截 Shift+Enter 組合鍵，導致換行功能無法正常工作。

**解決方案**：
- 提供額外的換行按鈕或其他換行方式
- 為不同輸入法環境提供不同的快捷鍵配置選項
- 在中文輸入確認後，使用 `setTimeout` 延遲一小段時間再處理鍵盤事件

## 6. 測試檢查清單

在每個操作系統和輸入法環境下，使用以下檢查清單執行測試：

### 基本功能測試
- [ ] 正常輸入中文字符
- [ ] 輸入過程中按 Enter 確認選字
- [ ] 選字確認後按 Enter 發送消息
- [ ] 輸入中文後按 Shift+Enter 換行
- [ ] 在多行輸入後按 Enter 發送整條消息

### 邊緣情況測試
- [ ] 快速切換中英文輸入法並測試 Enter 鍵行為
- [ ] 在輸入法組合模式中按 Ctrl+Enter 或其他可能的發送快捷鍵
- [ ] 在長句子輸入過程中的各個階段按 Enter 和 Shift+Enter
- [ ] 在輸入符號和標點的過程中測試快捷鍵
- [ ] 測試連續快速按鍵的場景

## 7. 自動化與手動測試結合

由於輸入法環境的複雜性，建議結合自動化測試和手動測試：

### 自動化測試
- 使用單元測試模擬基本的輸入法事件流程
- 使用端到端測試驗證簡單的輸入場景
- 為不同輸入法行為編寫參數化測試

### 手動測試
- 在實際操作系統環境中安裝各種中文輸入法
- 制定詳細的測試步驟清單
- 記錄不同輸入法下的實際行為差異
- 請不同操作習慣的測試人員進行測試，記錄用戶體驗

## 8. 總結

中文輸入法環境下的快捷鍵測試是一項複雜但必要的工作。通過結合:
- 理解輸入法工作機制
- 使用模擬事件的單元測試
- 基於真實瀏覽器的端到端測試
- 在多平台多輸入法環境下的手動測試

我們可以確保聊天界面的輸入體驗在各種中文輸入場景下都能正常工作。持續跟進各種輸入法的更新也是保持兼容性的重要工作。 