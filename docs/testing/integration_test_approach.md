# 互動式句子引用功能集成測試方法

## 1. 集成測試概述

集成測試旨在驗證系統中多個組件協同工作的能力，重點關注：

- 組件間的通信流程
- 數據正確傳遞
- 狀態管理一致性
- API服務整合
- 用戶交互場景

對於互動式句子引用功能，我們需要測試從引用標籤的點擊到PDF查看器打開的完整流程，確保各組件能無縫協作。

## 2. 測試範圍

集成測試涉及以下組件及其交互：

1. **ChatMessage → SentenceReferenceTag → SentenceContextViewer**
   - 測試點擊引用標籤到顯示上下文查看器的流程

2. **ChatMessage → SentenceReferenceTag → PDFViewer**
   - 測試點擊引用標籤到在PDF中查看的流程

3. **SentenceContextViewer → PDFViewer**
   - 測試從上下文查看器直接跳轉到PDF查看的流程

4. **API服務整合**
   - 測試與句子上下文獲取API的整合
   - 測試與PDF查看相關API的整合

## 3. 測試環境設置

### 3.1 模組依賴模擬策略

```javascript
// 模擬API服務
vi.mock('../../services/api', () => ({
  fetchSentenceContext: vi.fn(),
  getFilePreviewUrl: vi.fn(),
  highlightSentenceInPdf: vi.fn()
}));

// 使用實際狀態管理
import { PDFViewerProvider } from '../../contexts/PDFViewerContext';
import { ContextViewerProvider } from '../../contexts/ContextViewerContext';
```

### 3.2 測試容器組件

```jsx
// 集成測試容器
const IntegrationTestWrapper = ({ children }) => (
  <MemoryRouter>
    <PDFViewerProvider>
      <ContextViewerProvider>
        {children}
      </ContextViewerProvider>
    </PDFViewerProvider>
  </MemoryRouter>
);
```

## 4. 測試方法

### 4.1 組件通信測試

我們使用狀態追蹤和事件觸發監聽來測試組件間通信：

```javascript
// 測試引用標籤點擊到上下文查看器的通信
it('點擊引用標籤後應打開上下文查看器', async () => {
  // 設置API模擬
  const { fetchSentenceContext } = require('../../services/api');
  fetchSentenceContext.mockResolvedValue(mockContexts.standard);
  
  // 渲染測試組件
  const { getByText } = render(
    <IntegrationTestWrapper>
      <ChatMessage message={mockMessages.singleReference} />
      <SentenceContextViewer />
    </IntegrationTestWrapper>
  );
  
  // 點擊引用標籤
  const user = userEvent.setup();
  await user.click(getByText(/自適應專業知識定義/));
  
  // 點擊「查看上下文」選項
  await user.click(getByText('查看上下文'));
  
  // 驗證上下文查看器是否顯示
  await waitFor(() => {
    expect(fetchSentenceContext).toHaveBeenCalledWith(
      mockReferences.basicCd.file_uuid,
      mockReferences.basicCd.sentence_uuid
    );
    expect(getByText('上下文查看')).toBeInTheDocument();
  });
});
```

### 4.2 數據流測試

追蹤數據在不同組件間傳遞的過程：

```javascript
// 測試數據在組件間正確傳遞
it('從上下文查看器跳轉到PDF查看器時應傳遞正確數據', async () => {
  // 設置API模擬
  const { fetchSentenceContext, getFilePreviewUrl } = require('../../services/api');
  fetchSentenceContext.mockResolvedValue(mockContexts.standard);
  getFilePreviewUrl.mockResolvedValue('http://example.com/pdf/123');
  
  // 渲染測試組件
  const { getByText } = render(
    <IntegrationTestWrapper>
      <SentenceContextViewer 
        isOpen={true}
        reference={mockReferences.basicCd}
        context={mockContexts.standard}
      />
      <PDFViewer />
    </IntegrationTestWrapper>
  );
  
  // 點擊「在PDF中查看」按鈕
  const user = userEvent.setup();
  await user.click(getByText('在PDF中查看'));
  
  // 驗證PDF查看器是否接收到正確數據
  await waitFor(() => {
    expect(getFilePreviewUrl).toHaveBeenCalledWith(mockReferences.basicCd.file_uuid);
    // 驗證PDF查看器狀態更新
    const pdfViewer = screen.getByTestId('pdf-viewer');
    expect(pdfViewer).toHaveAttribute('data-file-uuid', mockReferences.basicCd.file_uuid);
    expect(pdfViewer).toHaveAttribute('data-page', String(mockReferences.basicCd.page));
  });
});
```

### 4.3 狀態管理測試

測試全局狀態在不同操作下的變化：

```javascript
// 測試全局狀態管理
it('引用操作應正確更新全局狀態', async () => {
  // 設置API模擬
  const { fetchSentenceContext } = require('../../services/api');
  fetchSentenceContext.mockResolvedValue(mockContexts.standard);
  
  // 使用實際Context Provider，但添加監聽器
  const pdfStateChangeSpy = vi.fn();
  const contextStateChangeSpy = vi.fn();
  
  // 使用測試版Context
  const TestContextProviders = ({ children }) => {
    const [pdfState, setPdfState] = useState({
      isOpen: false,
      fileUuid: '',
      pageNumber: 1,
      highlightedSentenceUuid: '',
    });
    
    const [contextState, setContextState] = useState({
      isOpen: false,
      reference: null,
      context: { beforeContext: [], afterContext: [], isLoading: false }
    });
    
    // 使用間諜函數包裝狀態更新
    const updatePdfState = (newState) => {
      pdfStateChangeSpy(newState);
      setPdfState(newState);
    };
    
    const updateContextState = (newState) => {
      contextStateChangeSpy(newState);
      setContextState(newState);
    };
    
    return (
      <PDFViewerContext.Provider value={{ pdfState, setPdfState: updatePdfState }}>
        <ContextViewerContext.Provider value={{ contextState, setContextState: updateContextState }}>
          {children}
        </ContextViewerContext.Provider>
      </PDFViewerContext.Provider>
    );
  };
  
  // 渲染測試組件
  render(
    <MemoryRouter>
      <TestContextProviders>
        <ChatMessage message={mockMessages.singleReference} />
        <SentenceContextViewer />
        <PDFViewer />
      </TestContextProviders>
    </MemoryRouter>
  );
  
  // 執行操作流程
  const user = userEvent.setup();
  await user.click(screen.getByText(/自適應專業知識定義/));
  await user.click(screen.getByText('在PDF中查看'));
  
  // 驗證狀態更新
  expect(pdfStateChangeSpy).toHaveBeenCalledWith(expect.objectContaining({
    isOpen: true,
    fileUuid: mockReferences.basicCd.file_uuid,
    pageNumber: mockReferences.basicCd.page,
    highlightedSentenceUuid: mockReferences.basicCd.sentence_uuid
  }));
});
```

## 5. 模擬API響應

### 5.1 模擬上下文獲取API

```javascript
// 模擬成功響應
fetchSentenceContext.mockResolvedValue(mockContexts.standard);

// 模擬載入中狀態
fetchSentenceContext.mockImplementation(() => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockContexts.standard);
    }, 1000);
  });
});

// 模擬錯誤響應
fetchSentenceContext.mockRejectedValue(new Error('Failed to fetch context'));
```

### 5.2 模擬PDF相關API

```javascript
// 模擬PDF預覽URL獲取
getFilePreviewUrl.mockResolvedValue('http://example.com/pdf/123');

// 模擬句子高亮
highlightSentenceInPdf.mockResolvedValue(true);

// 模擬錯誤情況
getFilePreviewUrl.mockRejectedValue(new Error('File not found'));
```

## 6. 端到端關鍵場景測試

### 6.1 完整引用點擊到PDF查看流程

```javascript
it('從聊天消息點擊引用到在PDF中查看的完整流程', async () => {
  // 設置API模擬
  const { getFilePreviewUrl, highlightSentenceInPdf } = require('../../services/api');
  getFilePreviewUrl.mockResolvedValue('http://example.com/pdf/123');
  highlightSentenceInPdf.mockResolvedValue(true);
  
  render(
    <IntegrationTestWrapper>
      <ChatMessage message={mockMessages.singleReference} />
      <PDFViewer />
    </IntegrationTestWrapper>
  );
  
  const user = userEvent.setup();
  
  // 1. 點擊引用標籤
  await user.click(screen.getByText(/自適應專業知識定義/));
  
  // 2. 選擇在PDF中查看
  await user.click(screen.getByText('在PDF中查看'));
  
  // 3. 驗證PDF查看器打開並顯示正確內容
  await waitFor(() => {
    expect(getFilePreviewUrl).toHaveBeenCalledWith(mockReferences.basicCd.file_uuid);
    expect(highlightSentenceInPdf).toHaveBeenCalledWith(
      mockReferences.basicCd.file_uuid, 
      mockReferences.basicCd.sentence_uuid
    );
    expect(screen.getByTestId('pdf-viewer')).toBeVisible();
    expect(screen.getByText(`第 ${mockReferences.basicCd.page} 頁`)).toBeVisible();
  });
});
```

## 7. 常見問題與解決方案

### 7.1 異步狀態更新問題

使用`waitFor`確保異步狀態更新完成：

```javascript
await waitFor(() => {
  expect(screen.getByText('PDF查看器')).toBeVisible();
}, { timeout: 2000 });
```

### 7.2 Context嵌套問題

使用自定義測試容器包裝多個Context提供者：

```jsx
const TestProviders = ({ children }) => (
  <MemoryRouter>
    <PDFViewerProvider initialState={{ isOpen: false }}>
      <ContextViewerProvider initialState={{ isOpen: false }}>
        {children}
      </ContextViewerProvider>
    </PDFViewerProvider>
  </MemoryRouter>
);
```

### 7.3 組件渲染條件測試

測試條件渲染行為：

```javascript
// 測試條件渲染
it('PDF查看器應僅在開啟狀態時渲染內容', async () => {
  // 初始狀態：關閉
  render(
    <PDFViewerProvider initialState={{ isOpen: false }}>
      <PDFViewer />
    </PDFViewerProvider>
  );
  
  // 驗證內容不可見
  expect(screen.queryByTestId('pdf-content')).not.toBeInTheDocument();
  
  // 重新渲染：開啟狀態
  rerender(
    <PDFViewerProvider initialState={{ isOpen: true, fileUuid: 'test-uuid' }}>
      <PDFViewer />
    </PDFViewerProvider>
  );
  
  // 驗證內容可見
  expect(screen.getByTestId('pdf-content')).toBeInTheDocument();
});
```

## 8. 測試執行與報告

### 8.1 測試運行命令

```bash
# 運行所有集成測試
npm run test:integration

# 運行特定測試文件
npm run test:integration -- PDFViewIntegration.test.tsx

# 監視模式
npm run test:integration -- --watch
```

### 8.2 測試覆蓋率報告

```bash
# 生成覆蓋率報告
npm run test:integration -- --coverage

# 輸出HTML格式報告
npm run test:integration -- --coverage --reporter=html
```

## 9. 最佳實踐建議

1. **隔離狀態**：每個測試用例應重置全局狀態
2. **模擬外部依賴**：API調用應模擬，但保留關鍵應用邏輯
3. **測試真實流程**：測試實際用戶會執行的操作流程
4. **避免測試實現細節**：專注於行為而非實現
5. **優先API測試**：確保組件與後端API正確交互 