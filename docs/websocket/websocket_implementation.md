# WebSocket實時更新功能設計文檔

本文檔描述智能文件助手前端的WebSocket實時更新功能設計和實現方法。通過WebSocket連接，我們能夠實時獲取文件處理和查詢處理的進度更新，提供良好的用戶體驗。

## 1. 設計概述

### 1.1 設計目標

- 實現穩定可靠的WebSocket連接，支持自動重連和錯誤處理
- 處理兩種主要WebSocket事件流：文件處理進度和查詢處理進度
- 提供直觀的進度顯示界面，包括階段性進度和詳細處理信息
- 實現降級策略，在WebSocket連接失敗時使用HTTP輪詢

### 1.2 核心組件

- **useWebSocket**: 通用的WebSocket Hook，處理連接生命週期
- **useFileProcessing**: 文件處理進度Hook，處理特定事件類型
- **useQueryProcessing**: 查詢處理進度Hook，處理特定事件類型
- **ProgressDisplay**: 通用進度條和狀態顯示組件
- **FileProcessingProgress**: 文件處理進度詳細顯示組件
- **QueryProcessingProgress**: 查詢處理進度詳細顯示組件

## 2. 技術實現

### 2.1 WebSocket連接管理

`useWebSocket` Hook 負責WebSocket連接的創建、維護和關閉，主要功能：

- 自動建立WebSocket連接
- 處理連接狀態變化（連接中、已連接、斷開、錯誤）
- 自動重連（可配置重試次數和間隔）
- 發送消息和手動斷開連接
- 清理資源（組件卸載時關閉連接）

### 2.2 特定業務邏輯處理

`useFileProcessing` 和 `useQueryProcessing` Hooks 封裝特定業務邏輯：

- 解析不同類型的WebSocket事件消息
- 維護和更新相應的進度狀態
- 提供降級策略（在WebSocket連接失敗時切換到HTTP輪詢）
- 處理完成和失敗回調

### 2.3 視覺化進度顯示

- 使用進度條直觀顯示處理進度
- 使用顏色區分不同處理狀態（進行中、完成、失敗）
- 顯示當前處理階段和詳細信息
- 提供交互式界面查看處理過程中的句子
- 支持直接跳轉到PDF預覽查看相關句子

### 2.4 降級策略

當WebSocket連接失敗時，系統會：

1. 顯示連接錯誤提示
2. 自動切換到HTTP輪詢模式
3. 每隔一定時間（默認2秒）請求進度更新
4. 在連接恢復正常時或者處理完成/失敗時停止輪詢

## 3. WebSocket事件類型

### 3.1 文件處理事件

- `processing_started`: 處理開始
- `pdf_extraction_progress`: PDF文本提取進度
- `sentence_extraction_detail`: 句子提取詳情
- `sentence_classification_progress`: 句子分類進度
- `sentence_classification_detail`: 句子分類詳情
- `processing_completed`: 處理完成
- `processing_failed`: 處理失敗

### 3.2 查詢處理事件

- `query_processing_started`: 查詢處理開始
- `keyword_extraction_completed`: 關鍵詞提取完成
- `database_search_progress`: 資料庫搜尋進度
- `database_search_result`: 資料庫搜尋結果
- `answer_generation_started`: 答案生成開始
- `referenced_sentences`: 參考的關鍵句子
- `query_completed`: 查詢處理完成
- `query_failed`: 查詢處理失敗

## 4. 使用方法

### 4.1 文件處理進度監控

```tsx
// 檔案處理頁面中
const { progress, wsStatus, connectionError, fallbackMode } = useFileProcessing({
  fileUuid: 'file-uuid-here',
  onComplete: () => console.log('Processing completed'),
  onFail: (error) => console.error('Processing failed:', error)
});

return (
  <FileProcessingProgress 
    progress={progress} 
    onViewSentence={handleViewSentence}
    connectionError={connectionError}
    fallbackMode={fallbackMode}
  />
);
```

### 4.2 查詢處理進度監控

```tsx
// 聊天查詢頁面中
const { progress, wsStatus, connectionError, fallbackMode } = useQueryProcessing({
  queryUuid: 'query-uuid-here',
  onComplete: () => fetchAnswer(),
  onFail: (error) => console.error('Query failed:', error)
});

return (
  <QueryProcessingProgress 
    progress={progress} 
    onViewSentence={handleViewSentence}
    connectionError={connectionError}
    fallbackMode={fallbackMode}
  />
);
```

## 5. 故障排除

### 5.1 WebSocket連接問題

- 檢查後端WebSocket服務是否正常運行
- 確認WebSocket URL格式是否正確（ws:// 或 wss://）
- 檢查瀏覽器是否支持WebSocket
- 檢查網絡連接和防火牆設置

### 5.2 事件處理問題

- 確保WebSocket消息格式與前端解析邏輯一致
- 檢查事件類型是否正確
- 確認消息中是否包含所有必要字段

### 5.3 降級策略問題

- 檢查API端點是否正確
- 確認HTTP輪詢端點是否可用
- 檢查輪詢間隔是否合適

## 6. 後續優化方向

- 增加心跳機制，更早檢測連接中斷
- 實現消息緩衝，處理網絡波動期間的消息
- 增加更多交互功能，如暫停/繼續處理
- 細化進度顯示，增加預估剩餘時間
- 增加更多視覺化效果，提升用戶體驗 