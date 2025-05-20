# WebSocket整合測試方案

## 1. 測試目標與範圍

### 1.1 測試目標

WebSocket整合測試的主要目標是驗證進度顯示組件能夠正確地接收、處理並顯示後端通過WebSocket推送的實時更新訊息。具體目標包括：

- 確保WebSocket連接的建立和管理正常工作
- 驗證不同類型的WebSocket事件能被正確解析與處理
- 測試進度顯示UI能夠實時反映WebSocket事件帶來的狀態變化
- 測試句子預覽功能能夠正確展示WebSocket傳送的句子數據
- 驗證WebSocket連接錯誤處理機制的有效性

### 1.2 測試範圍

本測試方案將覆蓋以下範圍：

- `useWebSocketProgress` Hook的功能測試
- ProcessingProgress組件對WebSocket數據的處理與顯示
- 不同類型WebSocket事件的處理邏輯測試
- WebSocket連接錯誤的降級處理測試

## 2. WebSocket數據流分析

### 2.1 WebSocket事件類型

系統使用以下WebSocket事件類型來更新檔案處理進度：

- `processing_started`：處理開始
- `pdf_extraction_progress`：PDF文本提取進度
- `sentence_extraction_detail`：句子提取詳情
- `sentence_classification_progress`：句子分類進度
- `sentence_classification_detail`：句子分類詳情
- `processing_completed`：處理完成
- `processing_failed`：處理失敗

### 2.2 數據流程

1. 後端通過WebSocket推送事件到前端
2. 前端的WebSocket客戶端接收事件
3. `useWebSocketProgress` Hook處理事件並更新組件狀態
4. 進度顯示組件根據狀態變化重新渲染UI

## 3. 測試策略與方法

### 3.1 測試方法選擇

WebSocket整合測試採用以下方法：

- **組件重渲染測試**：模擬WebSocket事件導致的狀態變化，驗證UI更新
- **模擬WebSocket連接**：使用Vitest的模擬功能替換真實WebSocket
- **模擬事件序列**：順序模擬處理流程中的各類事件

### 3.2 WebSocket模擬方案

整合測試需要模擬WebSocket連接及其事件：

```tsx
// 模擬WebSocket連接
vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    error: null,
    isFallbackMode: false,
    sendMessage: vi.fn()
  }))
}));
```

## 4. 測試用例設計

### 4.1 初始連接與處理開始測試

測試WebSocket連接建立後的初始狀態和處理開始事件：

```tsx
it('應該根據WebSocket事件更新進度顯示 (開始處理)', async () => {
  // 渲染組件，傳入初始進度
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查初始狀態
  expect(screen.getByText('等待處理')).toBeInTheDocument();
  expect(screen.getByText('0%')).toBeInTheDocument();
  
  // 模擬接收WebSocket消息 - 處理開始
  const progressStarted: FileProcessingProgress = {
    ...baseProgress,
    status: 'processing',
    progress: 5,
    currentStep: '開始處理文件'
  };
  
  // 重新渲染組件，傳入更新後的進度
  rerender(
    <ProcessingProgress 
      type="file"
      progress={progressStarted}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查UI是否更新
  await waitFor(() => {
    expect(screen.getByText('開始處理文件')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('5%')).toBeInTheDocument();
  });
});
```

### 4.2 PDF提取進度更新測試

測試PDF提取進度事件引起的UI更新：

```tsx
it('應該根據WebSocket事件更新進度顯示 (PDF提取進度)', async () => {
  // 渲染組件，傳入初始進度
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 模擬接收WebSocket消息 - PDF提取進度
  const pdfExtractionProgress: FileProcessingProgress = {
    ...baseProgress,
    status: 'processing',
    progress: 30,
    current: 3,
    total: 10,
    currentStep: '正在提取PDF文本'
  };
  
  // 重新渲染組件，傳入更新後的進度
  rerender(
    <ProcessingProgress 
      type="file"
      progress={pdfExtractionProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查UI是否更新
  await waitFor(() => {
    expect(screen.getByText('正在提取PDF文本')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('30%')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });
});
```

### 4.3 句子分類進度與內容測試

測試句子分類進度和句子內容的顯示：

```tsx
it('應該根據WebSocket事件更新進度顯示 (句子分類進度及句子內容)', async () => {
  // 渲染組件，傳入初始進度
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 模擬接收WebSocket消息 - 句子分類進度和句子
  const sentenceClassificationProgress: FileProcessingProgress = {
    ...baseProgress,
    status: 'processing',
    progress: 65,
    current: 13,
    total: 20,
    currentStep: '正在進行句子分類',
    classifiedSentences: [
      {
        sentence_uuid: 'sent-123',
        file_uuid: 'file-123',
        sentence: '這是一個概念型定義的句子',
        page: 5,
        defining_type: 'cd',
        reason: '包含明確的概念定義'
      }
    ]
  };
  
  // 重新渲染組件，傳入更新後的進度
  rerender(
    <ProcessingProgress 
      type="file"
      progress={sentenceClassificationProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查UI是否更新 - 進度和階段
  await waitFor(() => {
    expect(screen.getByText('正在進行句子分類')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('65%')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('13/20')).toBeInTheDocument();
  });
  
  // 檢查詳細面板中的句子
  expect(screen.getByText('已分類句子')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument(); // 一個已分類句子
  expect(screen.getByText('這是一個概念型定義的句子')).toBeInTheDocument();
  expect(screen.getByText('概念型定義')).toBeInTheDocument();
});
```

### 4.4 處理完成測試

測試處理完成事件觸發的UI更新：

```tsx
it('應該根據WebSocket事件更新進度顯示 (處理完成)', async () => {
  // 渲染組件，傳入初始進度
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 模擬接收WebSocket消息 - 處理完成
  const processingCompleted: FileProcessingProgress = {
    ...baseProgress,
    status: 'completed',
    progress: 100,
    currentStep: '處理完成',
    extractedSentences: [
      {
        sentence_uuid: 'ext-123',
        file_uuid: 'file-123',
        sentence: '這是提取的句子',
        page: 1
      }
    ],
    classifiedSentences: [
      {
        sentence_uuid: 'cls-123',
        file_uuid: 'file-123',
        sentence: '這是分類的句子',
        page: 1,
        defining_type: 'od',
        reason: '包含操作定義'
      }
    ]
  };
  
  // 重新渲染組件，傳入更新後的進度
  rerender(
    <ProcessingProgress 
      type="file"
      progress={processingCompleted}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查UI是否更新 - 進度和階段
  await waitFor(() => {
    expect(screen.getByText('處理完成')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
  
  // 檢查詳細面板中的句子
  expect(screen.getByText('已提取句子')).toBeInTheDocument();
  expect(screen.getByText('已分類句子')).toBeInTheDocument();
});
```

### 4.5 處理失敗測試

測試處理失敗事件時的錯誤信息顯示：

```tsx
it('應該根據WebSocket事件更新進度顯示 (處理失敗)', async () => {
  // 渲染組件，傳入初始進度
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 模擬接收WebSocket消息 - 處理失敗
  const processingFailed: FileProcessingProgress = {
    ...baseProgress,
    status: 'failed',
    progress: 45,
    currentStep: '處理失敗',
    errorMessage: '處理過程中發生錯誤：無法訪問外部API服務'
  };
  
  // 重新渲染組件，傳入更新後的進度
  rerender(
    <ProcessingProgress 
      type="file"
      progress={processingFailed}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查UI是否更新 - 進度和階段
  await waitFor(() => {
    expect(screen.getByText('處理失敗')).toBeInTheDocument();
  });
  
  await waitFor(() => {
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
  
  // 檢查錯誤訊息
  expect(screen.getByText('處理過程中發生錯誤：無法訪問外部API服務')).toBeInTheDocument();
});
```

### 4.6 WebSocket連接錯誤測試

測試WebSocket連接錯誤時的降級處理：

```tsx
it('應該顯示WebSocket連接錯誤', async () => {
  // 渲染組件，傳入連接錯誤
  render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      error="WebSocket連接失敗"
      isFallbackMode={true}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查錯誤訊息顯示
  expect(screen.getByText('WebSocket連接失敗')).toBeInTheDocument();
  expect(screen.getByText(/使用輪詢模式/)).toBeInTheDocument();
});
```

### 4.7 句子點擊事件測試

測試點擊句子卡片時事件處理是否正確：

```tsx
it('應該處理句子點擊事件', async () => {
  // 準備包含句子的進度數據
  const progressWithSentences: FileProcessingProgress = {
    ...baseProgress,
    status: 'processing',
    progress: 65,
    currentStep: '正在進行句子分類',
    classifiedSentences: [
      {
        sentence_uuid: 'sent-123',
        file_uuid: 'file-123',
        sentence: '這是一個測試句子',
        page: 5,
        defining_type: 'cd',
        reason: '測試用'
      }
    ]
  };
  
  // 渲染組件
  render(
    <ProcessingProgress 
      type="file"
      progress={progressWithSentences}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 模擬點擊句子
  const sentenceElement = screen.getByText('這是一個測試句子');
  sentenceElement.click();
  
  // 檢查點擊處理函數是否被調用
  expect(mockHandleSentenceClick).toHaveBeenCalledTimes(1);
  expect(mockHandleSentenceClick).toHaveBeenCalledWith(progressWithSentences.classifiedSentences[0]);
});
```

## 5. 模擬完整處理流程

### 5.1 完整處理流程測試

測試從開始到結束的完整處理流程，模擬各個階段的WebSocket事件：

```tsx
it('應該正確處理完整的文件處理流程', async () => {
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 1. 模擬處理開始事件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        status: 'processing',
        progress: 5,
        currentStep: '開始處理文件'
      }}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  await waitFor(() => expect(screen.getByText('開始處理文件')).toBeInTheDocument());
  
  // 2. 模擬PDF提取進度事件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        status: 'processing',
        progress: 30,
        current: 3,
        total: 10,
        currentStep: '正在提取PDF文本'
      }}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  await waitFor(() => expect(screen.getByText('正在提取PDF文本')).toBeInTheDocument());
  
  // 3. 模擬句子提取詳情事件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        status: 'processing',
        progress: 45,
        current: 6,
        total: 10,
        currentStep: '正在提取PDF文本',
        extractedSentences: [
          {
            sentence_uuid: 'ext-1',
            file_uuid: 'file-123',
            sentence: '這是從PDF提取的句子',
            page: 1
          }
        ]
      }}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  await waitFor(() => expect(screen.getByText('45%')).toBeInTheDocument());
  
  // 4. 模擬句子分類進度事件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        status: 'processing',
        progress: 70,
        current: 15,
        total: 20,
        currentStep: '正在進行句子分類',
        extractedSentences: [
          {
            sentence_uuid: 'ext-1',
            file_uuid: 'file-123',
            sentence: '這是從PDF提取的句子',
            page: 1
          }
        ]
      }}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  await waitFor(() => expect(screen.getByText('正在進行句子分類')).toBeInTheDocument());
  
  // 5. 模擬句子分類詳情事件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        status: 'processing',
        progress: 85,
        current: 18,
        total: 20,
        currentStep: '正在進行句子分類',
        extractedSentences: [
          {
            sentence_uuid: 'ext-1',
            file_uuid: 'file-123',
            sentence: '這是從PDF提取的句子',
            page: 1
          }
        ],
        classifiedSentences: [
          {
            sentence_uuid: 'cls-1',
            file_uuid: 'file-123',
            sentence: '這是概念型定義句子',
            page: 1,
            defining_type: 'cd',
            reason: '包含概念定義'
          }
        ]
      }}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  await waitFor(() => expect(screen.getByText('85%')).toBeInTheDocument());
  expect(screen.getByText('這是概念型定義句子')).toBeInTheDocument();
  
  // 6. 模擬處理完成事件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        status: 'completed',
        progress: 100,
        currentStep: '處理完成',
        extractedSentences: [
          {
            sentence_uuid: 'ext-1',
            file_uuid: 'file-123',
            sentence: '這是從PDF提取的句子',
            page: 1
          }
        ],
        classifiedSentences: [
          {
            sentence_uuid: 'cls-1',
            file_uuid: 'file-123',
            sentence: '這是概念型定義句子',
            page: 1,
            defining_type: 'cd',
            reason: '包含概念定義'
          }
        ]
      }}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  await waitFor(() => expect(screen.getByText('處理完成')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument());
});
```

## 6. 高級測試場景

### 6.1 併發WebSocket事件測試

測試短時間內接收多個WebSocket事件時的處理能力：

```tsx
it('應該正確處理短時間內的多個WebSocket事件', async () => {
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={baseProgress}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 快速連續更新進度
  const events = [10, 20, 30, 40, 50].map(progress => ({
    ...baseProgress,
    status: 'processing',
    progress,
    currentStep: `進度更新到 ${progress}%`
  }));
  
  // 使用短間隔模擬連續事件
  for (const event of events) {
    rerender(
      <ProcessingProgress 
        type="file"
        progress={event}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    await new Promise(r => setTimeout(r, 10)); // 短間隔
  }
  
  // 檢查最終顯示的是最後一個事件的進度
  await waitFor(() => expect(screen.getByText('進度更新到 50%')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument());
});
```

### 6.2 WebSocket重連後數據同步測試

測試WebSocket重連後的數據同步功能：

```tsx
it('應該在WebSocket重連後同步數據', async () => {
  // 模擬WebSocket斷開連接
  const mockWebSocket = {
    isConnected: false,
    error: "連接中斷",
    isFallbackMode: true,
    sendMessage: vi.fn()
  };
  
  (useWebSocket as any).mockReturnValue(mockWebSocket);
  
  // 渲染組件
  const { rerender } = render(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        progress: 45,
        status: 'processing',
        currentStep: '處理中'
      }}
      error="WebSocket連接中斷"
      isFallbackMode={true}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查斷開狀態下的UI
  expect(screen.getByText('WebSocket連接中斷')).toBeInTheDocument();
  expect(screen.getByText(/使用輪詢模式/)).toBeInTheDocument();
  
  // 模擬WebSocket重新連接
  (useWebSocket as any).mockReturnValue({
    isConnected: true,
    error: null,
    isFallbackMode: false,
    sendMessage: vi.fn()
  });
  
  // 重新渲染組件
  rerender(
    <ProcessingProgress 
      type="file"
      progress={{
        ...baseProgress,
        progress: 60,
        status: 'processing',
        currentStep: '恢復連接後更新'
      }}
      error={null}
      isFallbackMode={false}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  // 檢查重連後的UI更新
  await waitFor(() => expect(screen.queryByText('WebSocket連接中斷')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('恢復連接後更新')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument());
});
```

## 7. 性能與可靠性測試

### 7.1 大量數據測試

測試當WebSocket事件包含大量句子數據時的處理性能：

```tsx
it('應該高效處理包含大量句子的WebSocket事件', async () => {
  // 生成大量句子
  const manyExtractedSentences = Array(200).fill(0).map((_, i) => ({
    sentence_uuid: `ext-${i}`,
    file_uuid: 'file-123',
    sentence: `這是第${i}個提取的句子`,
    page: (i % 20) + 1
  }));
  
  const manyClassifiedSentences = Array(100).fill(0).map((_, i) => ({
    sentence_uuid: `cls-${i}`,
    file_uuid: 'file-123',
    sentence: `這是第${i}個分類的句子`,
    page: (i % 20) + 1,
    defining_type: i % 2 === 0 ? 'cd' : 'od',
    reason: `分類理由 ${i}`
  }));
  
  const bigProgressData: FileProcessingProgress = {
    ...baseProgress,
    status: 'processing',
    progress: 85,
    currentStep: '處理大量句子',
    extractedSentences: manyExtractedSentences,
    classifiedSentences: manyClassifiedSentences
  };
  
  // 計時渲染性能
  const startTime = performance.now();
  
  render(
    <ProcessingProgress 
      type="file"
      progress={bigProgressData}
      onSentenceClick={mockHandleSentenceClick}
    />
  );
  
  const renderTime = performance.now() - startTime;
  
  // 檢查渲染是否在合理時間內完成（例如小於1秒）
  expect(renderTime).toBeLessThan(1000);
  
  // 檢查是否顯示已提取和已分類句子的摘要
  await waitFor(() => expect(screen.getByText('已提取句子')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('已分類句子')).toBeInTheDocument());
  
  // 檢查是否顯示句子數量
  expect(screen.getByText('200')).toBeInTheDocument(); // 已提取句子數
  expect(screen.getByText('100')).toBeInTheDocument(); // 已分類句子數
});
```

### 7.2 記憶體使用測試

測試在WebSocket事件持續推送大量數據時的記憶體使用情況：

```tsx
it('應該有效管理記憶體使用', async () => {
  // 這裡只是概念演示，實際實現需要使用特定工具
  const memoryBefore = window.performance.memory?.usedJSHeapSize;
  
  // 渲染5次大數據組件（實際測試中可能需要更多）
  for (let i = 0; i < 5; i++) {
    const { unmount } = render(
      <ProcessingProgress 
        type="file"
        progress={{
          ...baseProgress,
          status: 'processing',
          progress: 50 + i * 10,
          extractedSentences: Array(100).fill(0).map((_, j) => ({
            sentence_uuid: `ext-${i}-${j}`,
            file_uuid: 'file-123',
            sentence: `批次${i}：這是第${j}個提取的句子`,
            page: (j % 20) + 1
          }))
        }}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    await waitFor(() => expect(screen.getByText(`50${i * 10 > 0 ? i * 10 : ''}%`)).toBeInTheDocument());
    unmount();
  }
  
  const memoryAfter = window.performance.memory?.usedJSHeapSize;
  
  // 檢查記憶體增長不超過某個合理值
  if (memoryBefore && memoryAfter) {
    const memoryGrowth = memoryAfter - memoryBefore;
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 例如50MB
  }
});
```

## 8. 自動化與集成

### 8.1 測試自動化策略

WebSocket整合測試應納入CI/CD流程，作為前端自動化測試的一部分：

1. 在每次提交後自動運行
2. 測試失敗時阻止部署
3. 生成測試報告和覆蓋率數據

### 8.2 測試環境設置

在CI環境中配置測試環境：

```yaml
# .github/workflows/test.yml (示例)
name: Frontend Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Test Report
        uses: dorny/test-reporter@v1
        if: success() || failure()
        with:
          name: Vitest Tests
          path: vitest-results.xml
          reporter: jest-junit
```

## 9. 測試覆蓋率目標

WebSocket整合測試應達到以下覆蓋率目標：

- **代碼覆蓋率**: 85% 以上
- **事件類型覆蓋率**: 100%（所有WebSocket事件類型都應測試）
- **UI狀態覆蓋率**: 100%（所有可能的UI狀態都應測試）

## 10. 結論

WebSocket整合測試方案通過模擬WebSocket事件和重渲染測試，全面驗證了進度顯示組件對WebSocket數據的處理和UI更新功能。這些測試有助於確保使用者在實際使用過程中能夠看到準確、即時的進度更新和處理詳情，提升整體用戶體驗。 