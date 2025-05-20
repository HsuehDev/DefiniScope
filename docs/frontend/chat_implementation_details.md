# 聊天界面實作細節和技術說明

## 1. 組件架構設計

聊天界面採用組件化設計模式，將各個功能模塊拆分為獨立且可重用的組件。主要組件結構如下：

```
chat/
├── types.ts               # 類型定義
├── index.ts               # 組件導出
├── ChatContainer.tsx      # 主聊天容器
├── ChatMessage.tsx        # 消息氣泡
├── ChatInput.tsx          # 輸入框
└── ReferenceDisplay.tsx   # 引用顯示
```

### 1.1 類型定義

建立了完整的TypeScript類型定義，確保類型安全：

- `Reference`: 引用句子的基本結構
- `ChatMessage`: 聊天消息結構
- `Conversation`: 對話結構
- `WebSocketEvent`: WebSocket事件類型
- 各種組件Props的接口定義

### 1.2 組件職責劃分

- **ChatContainer**: 整合其他組件，管理消息列表和自動滾動
- **ChatMessage**: 處理消息顯示，區分用戶和助手消息
- **ChatInput**: 處理用戶輸入，支援Enter發送和Shift+Enter換行
- **ReferenceDisplay**: 顯示引用句子，處理點擊互動

## 2. 響應式設計實現

使用TailwindCSS實現各尺寸設備的顯示適配：

### 2.1 移動設備適配

```tsx
<div className={`
  max-w-[80%] md:max-w-[70%] lg:max-w-[60%] 
  rounded-lg px-4 py-3 shadow-sm
  ${role === 'user' 
    ? 'bg-blue-600 text-white rounded-tr-none' 
    : 'bg-white border border-gray-200 rounded-tl-none'}
`}>
```

- 移動設備：消息氣泡最大寬度80%
- 平板設備：消息氣泡最大寬度70%
- 桌面設備：消息氣泡最大寬度60%

### 2.2 聊天容器適配

聊天容器使用Flexbox布局，確保在不同屏幕尺寸下都能維持合理的顯示效果：

```tsx
<div className="flex flex-col h-screen bg-gray-100">
  <div className="flex-1 flex flex-col overflow-hidden p-4">
    {/* 聊天內容 */}
  </div>
</div>
```

## 3. WebSocket實時通信

### 3.1 自定義Hook設計

使用自定義Hook `useWebSocket` 封裝WebSocket連接邏輯，提供以下功能：

- 自動連接和重連
- 連接狀態管理
- 錯誤處理
- 消息發送和接收
- 連接清理

```tsx
const { connected, connecting, error, sendMessage, disconnect, reconnect } = useWebSocket({
  url: `ws://${window.location.host}/ws/chat/${queryUuid}`,
  onMessage: handleMessage,
  // 其他選項...
});
```

### 3.2 消息處理流程

1. 建立WebSocket連接
2. 接收不同類型的事件消息
3. 根據消息類型更新UI狀態
4. 在連接中斷時自動重連

### 3.3 斷線重連機制

```typescript
// 重新連接邏輯
if (reconnectAttemptsRef.current < maxReconnectAttempts) {
  reconnectIntervalRef.current = window.setTimeout(() => {
    reconnectAttemptsRef.current += 1;
    connect();
  }, reconnectInterval);
}
```

## 4. 消息列表與滾動處理

### 4.1 自動滾動邏輯

```typescript
// 滾動到底部函數
const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  if (messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    setHasNewMessage(false);
  }
};

// 監聽消息更新自動滾動
useEffect(() => {
  if (!messagesContainerRef.current) return;
  
  const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
  
  if (isAtBottom) {
    scrollToBottom();
  } else if ((conversation?.messages?.length ?? 0) > 0) {
    setHasNewMessage(true);
  }
}, [conversation?.messages]);
```

### 4.2 新消息提示

當用戶未停留在消息底部時，收到新消息會顯示提示按鈕，並有視覺指示：

```tsx
{showScrollButton && (
  <div className="absolute bottom-24 right-6">
    <button
      className={`
        p-3 rounded-full bg-blue-600 text-white shadow-lg
        hover:bg-blue-700 transition-all
        ${hasNewMessage ? 'animate-bounce' : ''}
      `}
      onClick={() => scrollToBottom()}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      {hasNewMessage && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3"></span>
      )}
    </button>
  </div>
)}
```

## 5. 進度顯示與參考句子

### 5.1 進度條實現

使用動態寬度的div實現進度條：

```tsx
{processingProgress !== undefined && (
  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
    <div
      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${processingProgress}%` }}
    ></div>
  </div>
)}
```

### 5.2 處理步驟顯示

根據WebSocket事件更新處理步驟：

```tsx
switch (event.event) {
  case 'query_processing_started':
    setIsProcessing(true);
    setProcessingStep('開始處理您的問題...');
    break;

  case 'keyword_extraction_completed':
    setProcessingStep(`已提取關鍵詞: ${event.keywords?.join(', ')}`);
    break;
  
  // 其他步驟...
}
```

### 5.3 參考句子展示

```tsx
{referencedSentences && referencedSentences.length > 0 && (
  <div className="mt-3 pt-3 border-t border-gray-200">
    <div className="text-xs text-gray-500 mb-2">正在參考的句子：</div>
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {referencedSentences.map((reference) => (
        <ReferenceDisplay
          key={reference.sentence_uuid}
          reference={reference}
          onClick={() => onViewReference(reference)}
        />
      ))}
    </div>
  </div>
)}
```

## 6. 輸入框交互

### 6.1 Shift+Enter換行實現

通過監聽`keyDown`事件，區分Enter和Shift+Enter：

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // 支持 Shift+Enter 換行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};
```

### 6.2 輸入框高度自適應

輸入框高度會隨著內容增長而自動調整，同時限制最大高度：

```typescript
// 自動調整輸入框高度
useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }
}, [message]);
```

## 7. PDF預覽模態框

### 7.1 模態框結構

```tsx
{showPreview && previewReference && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-4xl h-3/4 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold">
          {previewReference.original_name} (第 {previewReference.page} 頁)
        </h2>
        <button onClick={closePreview} className="text-gray-500 hover:text-gray-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <iframe
          src={`/api/files/${previewReference.file_uuid}/preview?page=${previewReference.page}&highlight=${previewReference.sentence_uuid}`}
          className="w-full h-full border-0"
          title="PDF Preview"
        />
      </div>
    </div>
  </div>
)}
```

### 7.2 高亮顯示

通過URL參數傳遞需要高亮的句子UUID，後端API負責在PDF預覽中高亮顯示相應句子。

## 8. 性能優化考量

### 8.1 記憶緩存

使用React的`useCallback`和`useMemo`優化函數和數據：

```typescript
const handleWebSocketMessage = useCallback((event: WebSocketEvent) => {
  // 處理WebSocket消息
}, [/* 依賴項 */]);

const refreshConversation = useCallback(async () => {
  // 刷新對話
}, [conversationId]);
```

### 8.2 條件渲染

使用條件渲染避免不必要的DOM更新：

```tsx
{isProcessing && (
  // 處理進度顯示
)}

{showScrollButton && (
  // 滾動按鈕
)}
```

### 8.3 虛擬化列表（未實現但可考慮）

對於非常長的對話，可以考慮使用虛擬化列表（如react-virtualized或react-window）優化渲染性能。

## 9. 後續優化方向

1. **離線支持**：實現消息暫存和離線發送隊列
2. **消息預覽**：支持Markdown或富文本輸入和預覽
3. **語音輸入**：整合語音識別功能
4. **消息搜索**：在長對話中搜索歷史消息
5. **對話管理**：重命名、歸檔和刪除對話 