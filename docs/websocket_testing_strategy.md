# WebSocket 實時進度更新功能測試策略

## 1. 測試概述

本文檔詳細說明了針對系統中 WebSocket 實時進度更新功能的測試策略。該功能主要負責：

1. 透過 WebSocket 連接獲取檔案處理和查詢處理的實時進度
2. 處理各種類型的事件通知
3. 在連接失敗時自動進行重連
4. 當 WebSocket 連接無法建立或失敗時，降級至輪詢模式

本測試策略採用多層次測試方法，涵蓋單元測試、整合測試和模擬網絡故障的情境。

## 2. 測試工具與環境

### 2.1 測試工具

- **Vitest**: 測試框架
- **React Testing Library**: 用於測試 React 組件和 Hooks
- **MSW (Mock Service Worker)**: 攔截和模擬 HTTP 請求
- **自定義 WebSocket 模擬**: 模擬 WebSocket 行為的自定義模塊

### 2.2 測試環境

- 測試在隔離的節點環境中運行
- 使用虛擬計時器模擬時間流逝
- 通過模擬模塊替換真實的 WebSocket 實例

## 3. WebSocket 模擬策略

### 3.1 WebSocket 模擬架構

我們創建了一個 `MockWebSocket` 類來替代瀏覽器原生的 WebSocket 實例，該類：

- 完全實現了 WebSocket 介面
- 提供了控制連接狀態的方法
- 可以模擬消息接收、連接斷開和錯誤
- 支持追踪已發送的消息
- 通過靜態實例列表支持查找和管理

### 3.2 模擬安裝機制

```typescript
// 安裝 Mock WebSocket
const cleanup = installMockWebSocket();

// 使用後清理
cleanup();
```

此機制允許在測試中替換全局 WebSocket 構造函數，並在測試完成後恢復原始實現。

## 4. 單元測試策略

### 4.1 useWebSocket Hook 測試

針對基礎 WebSocket 連接管理 Hook 的測試，涵蓋：

- 連接建立與狀態追踪
- 消息接收與處理
- 消息發送
- 錯誤處理
- 自動重連機制
- 資源清理

### 4.2 useFileProcessing Hook 測試

針對檔案處理進度追踪 Hook 的測試，涵蓋：

- 處理各種類型的 WebSocket 事件
- 處理提取的句子和分類結果
- 完成和失敗事件的回調
- WebSocket 連接失敗時的降級策略
- 輪詢模式下的進度更新

### 4.3 useQueryProcessing Hook 測試

針對查詢處理進度追踪 Hook 的測試，涵蓋：

- 關鍵詞提取和資料庫搜尋進度
- 搜尋結果處理
- 引用句子追踪
- 完成和失敗事件的回調
- WebSocket 連接失敗時的降級策略
- 輪詢模式下的進度更新

## 5. 測試場景

### 5.1 WebSocket 事件處理測試

模擬所有類型的 WebSocket 事件，確保每種事件都能正確處理：

- **檔案處理事件**:
  - `processing_started`
  - `pdf_extraction_progress`
  - `sentence_extraction_detail`
  - `sentence_classification_progress`
  - `sentence_classification_detail`
  - `processing_completed`
  - `processing_failed`

- **查詢處理事件**:
  - `query_processing_started`
  - `keyword_extraction_completed`
  - `database_search_progress`
  - `database_search_result`
  - `answer_generation_started`
  - `referenced_sentences`
  - `query_completed`
  - `query_failed`

### 5.2 連接故障與重連測試

測試 WebSocket 連接在各種故障情境下的行為：

- 初始連接失敗
- 連接中途斷開
- 多次重連嘗試
- 超出最大重連次數
- 連接中途出錯

### 5.3 降級策略測試

測試當 WebSocket 連接無法使用時的降級策略：

- 切換到輪詢模式
- 輪詢間隔控制
- 輪詢請求的正確處理
- 輪詢過程中的完成和失敗處理

## 6. 網絡延遲模擬

### 6.1 使用虛擬計時器模擬網絡延遲

```typescript
// 模擬網絡延遲
vi.useFakeTimers();

// 模擬時間經過
vi.advanceTimersByTime(1000); // 前進 1 秒

// 執行所有待處理的計時器回調
vi.runAllTimers();
```

### 6.2 重連間隔測試

針對重連機制測試不同的間隔設置，確保：

- 重連計時器正確啟動和清理
- 重連間隔遵循設置的值
- 計數器正確累加直到達到最大嘗試次數

## 7. 測試 UI 響應

### 7.1 進度顯示組件測試

確保 UI 組件正確響應進度更新：

- 進度條顯示
- 當前步驟描述
- 處理細節的顯示與互動
- 錯誤信息的顯示

### 7.2 連接狀態指示器測試

測試 UI 中對 WebSocket 連接狀態的反饋：

- 連接中狀態
- 已連接狀態
- 重連中狀態
- 錯誤狀態
- 降級到輪詢模式後的狀態指示

## 8. 模擬服務器響應

### 8.1 輪詢模式 API 模擬

使用 MSW 模擬輪詢端點的回應：

```typescript
server.use(
  rest.get(`${API_BASE_URL}/files/${mockFileUuid}/progress`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        progress: 75,
        current: 15,
        total: 20,
        status: 'processing',
        current_step: '句子分類中',
        error_message: null
      })
    );
  })
);
```

### 8.2 模擬不同階段的進度

針對不同處理階段，模擬不同的進度回應：

- 初始啟動階段
- 處理中間階段
- 接近完成階段
- 完成階段
- 失敗情境

## 9. 測試覆蓋率目標

### 9.1 代碼覆蓋率

針對 WebSocket 相關功能的代碼覆蓋率目標：

- **行覆蓋率**: 90%+
- **分支覆蓋率**: 85%+
- **函數覆蓋率**: 95%+

### 9.2 事件類型覆蓋率

- 確保測試涵蓋所有定義的 WebSocket 事件類型
- 每種事件類型至少有一個專門的測試用例

## 10. 自動化與 CI 整合

### 10.1 測試自動化

所有 WebSocket 相關測試將集成到自動化測試流程中：

- 作為 `npm test` 的一部分運行
- 包含在預提交檢查中
- 納入 CI/CD 流程

### 10.2 測試報告

測試執行後生成詳細報告，包括：

- 測試覆蓋率統計
- 失敗測試的詳細信息
- 性能指標

## 11. 最佳實踐與注意事項

### 11.1 避免條件式斷言

避免在條件語句中使用斷言，例如：

```typescript
// 錯誤做法
if (condition) {
  expect(result).toBe(value1);
} else {
  expect(result).toBe(value2);
}

// 正確做法：拆分為獨立測試
it('condition true case', () => {
  // 設置 condition 為 true
  expect(result).toBe(value1);
});

it('condition false case', () => {
  // 設置 condition 為 false
  expect(result).toBe(value2);
});
```

### 11.2 清理資源

每個測試後確保清理所有資源，特別是：

- 模擬的 WebSocket 實例
- 計時器
- 服務器處理程序
- 事件監聽器

### 11.3 隔離測試

確保測試之間相互隔離，不共享狀態：

- 每個測試前重置 mock
- 使用 `beforeEach` 和 `afterEach` 進行設置和清理
- 避免依賴測試執行順序

## 12. 結論

本測試策略提供了全面測試 WebSocket 實時進度更新功能的框架。通過實施這些測試，我們可以確保系統中的 WebSocket 功能：

- 可靠地處理各種類型的事件
- 在連接問題時優雅地降級
- 提供一致的用戶體驗，即使在網絡不穩定的情況下

這些測試不僅驗證了當前實現的正確性，還提供了回歸測試，確保未來的更改不會破壞現有功能。 