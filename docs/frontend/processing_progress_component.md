# 進度顯示組件文檔

本文檔詳細介紹了文件分析平台中的進度顯示組件的設計與使用方法，該組件用於實時展示檔案處理和查詢處理的進度。

## 目錄

1. [組件概述](#組件概述)
2. [核心功能](#核心功能)
3. [組件架構](#組件架構)
4. [資料類型](#資料類型)
5. [使用方法](#使用方法)
6. [WebSocket 集成](#websocket-集成)
7. [自定義與擴展](#自定義與擴展)

## 組件概述

進度顯示組件是一個高度互動性的 UI 元素，用於顯示系統中長時間運行任務的處理進度和階段。它主要支援兩種處理類型：

1. **檔案處理進度**：顯示 PDF 文件的處理流程，包括文本提取、句子切分、定義分類等階段。
2. **查詢處理進度**：顯示用戶查詢的處理流程，包括關鍵詞提取、資料庫搜索、答案生成等階段。

組件提供了豐富的視覺反饋和互動元素，使用戶可以實時了解任務進展，並直觀地查看處理過程中的關鍵內容。

## 核心功能

- **進度條視覺化**：以進度條形式直觀展示當前處理進度
- **階段指示器**：顯示當前正在執行的處理階段
- **實時更新**：通過 WebSocket 實時接收和顯示進度更新
- **詳細信息面板**：可折疊的詳細信息區域，顯示處理過程中的句子和關鍵詞
- **句子預覽**：以卡片形式展示處理過程中的句子，支持點擊互動
- **估計剩餘時間**：顯示預估的任務完成剩餘時間
- **錯誤處理**：優雅地處理和顯示處理過程中的錯誤
- **回退機制**：在 WebSocket 連接失敗時支持回退到輪詢模式

## 組件架構

進度顯示組件採用模塊化設計，由以下子組件構成：

- **ProcessingProgress**: 主組件，整合所有子組件並處理狀態邏輯
- **ProgressBar**: 進度條組件，顯示百分比進度
- **StageIndicator**: 階段指示器，顯示當前處理階段及相關圖標
- **DetailPanel**: 詳細信息面板，顯示處理細節和參考內容
- **SentencePreview**: 句子預覽卡片，顯示句子內容及其分類信息

同時，我們提供了相關的 hooks 用於處理 WebSocket 連接和數據更新：

- **useWebSocketProgress**: 通用的 WebSocket 進度更新 hook
- **useFileProcessingWebSocket**: 專用於文件處理進度的 hook
- **useQueryProcessingWebSocket**: 專用於查詢處理進度的 hook

## 資料類型

組件使用以下主要資料類型：

```typescript
// 處理狀態
type FileProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 定義類型
type DefiningType = 'cd' | 'od' | 'none';

// 文件處理進度
interface FileProcessingProgress {
  file_uuid: string;
  progress: number;  // 0-100
  status: FileProcessingStatus;
  currentStep: string;
  current?: number;
  total?: number;
  errorMessage?: string;
  extractedSentences: SentenceData[];
  classifiedSentences: SentenceData[];
}

// 查詢處理進度
interface QueryProcessingProgress {
  query_uuid: string;
  progress: number;  // 0-100
  status: FileProcessingStatus;
  currentStep: string;
  errorMessage?: string;
  keywords: string[];
  foundDefinitions: { cd: number, od: number };
  searchResults: Record<string, ReferencedSentence[]>;
  referencedSentences: ReferencedSentence[];
}
```

## 使用方法

### 基本使用

```tsx
import { ProcessingProgress } from '../components/ProcessingProgress';
import { useFileProcessingWebSocket } from '../hooks/useWebSocketProgress';

const FileProcessingComponent: React.FC = () => {
  const fileUuid = '550e8400-e29b-41d4-a716-446655440000'; // 從路由或props獲取
  const { progress, isConnected, error, isFallbackMode } = useFileProcessingWebSocket(fileUuid);
  
  const handleSentenceClick = (sentence) => {
    // 處理句子點擊，例如跳轉到 PDF 預覽
    console.log('Clicked sentence:', sentence);
  };
  
  return (
    <ProcessingProgress 
      type="file"
      progress={progress}
      error={error}
      isFallbackMode={isFallbackMode}
      onSentenceClick={handleSentenceClick}
    />
  );
};
```

### 查詢處理示例

```tsx
import { ProcessingProgress } from '../components/ProcessingProgress';
import { useQueryProcessingWebSocket } from '../hooks/useWebSocketProgress';

const QueryProcessingComponent: React.FC = () => {
  const queryUuid = '660e8400-e29b-41d4-a716-446655440000'; // 從路由或props獲取
  const { progress, isConnected, error, isFallbackMode } = useQueryProcessingWebSocket(queryUuid);
  
  const handleSentenceClick = (sentence) => {
    // 處理句子點擊，例如顯示引用的詳細信息
    console.log('Clicked referenced sentence:', sentence);
  };
  
  return (
    <ProcessingProgress 
      type="query"
      progress={progress}
      error={error}
      isFallbackMode={isFallbackMode}
      onSentenceClick={handleSentenceClick}
    />
  );
};
```

## WebSocket 集成

組件使用 WebSocket 接收實時進度更新。以下是 WebSocket 集成的關鍵點：

### 連接 URL

- 文件處理進度：`ws://{server}/ws/processing/{file_uuid}`
- 查詢處理進度：`ws://{server}/ws/chat/{query_uuid}`

### 處理的事件類型

#### 文件處理事件

- `processing_started`: 處理開始
- `pdf_extraction_progress`: PDF 文本提取進度
- `sentence_extraction_detail`: 句子提取詳情
- `sentence_classification_progress`: 句子分類進度
- `sentence_classification_detail`: 句子分類詳情
- `processing_completed`: 處理完成
- `processing_failed`: 處理失敗

#### 查詢處理事件

- `query_processing_started`: 查詢處理開始
- `keyword_extraction_completed`: 關鍵詞提取完成
- `database_search_progress`: 資料庫搜尋進度
- `database_search_result`: 資料庫搜尋結果
- `answer_generation_started`: 答案生成開始
- `referenced_sentences`: 參考句子列表
- `query_completed`: 查詢完成
- `query_failed`: 查詢失敗

### 錯誤處理和重連機制

組件內建了錯誤處理和自動重連機制：

- 在連接斷開時自動嘗試重連（最多 5 次）
- 超過最大重連次數後切換到輪詢模式
- 顯示連接狀態和錯誤信息
- 網絡恢復時自動重新連接

## 自定義與擴展

組件支持以下自定義選項：

### 樣式自定義

使用 className 屬性來自定義組件樣式：

```tsx
<ProcessingProgress 
  type="file"
  progress={progress}
  className="my-custom-class"
/>
```

### 擴展新的處理類型

如需添加新的處理類型，可以擴展 `ProcessingProgressProps` 類型並增加相應的條件渲染邏輯：

```tsx
type NewProcessingProgressProps = FileProcessingProgressProps | QueryProcessingProgressProps | NewTypeProgressProps;

// 在 ProcessingProgress 組件中添加新的條件渲染邏輯
if (props.type === 'newType') {
  // 渲染新類型的進度顯示
}
```

### 自定義估算時間算法

可以通過修改 `getEstimatedTimeRemaining` 函數來自定義剩餘時間的計算方式：

```tsx
const getCustomEstimatedTimeRemaining = (progress: number, startTime: number): string => {
  // 實現自定義的剩餘時間計算邏輯
  // 可以基於歷史進度變化率進行更準確的預測
  return `約 ${estimatedMinutes} 分鐘`;
};
``` 