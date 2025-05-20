# 參考資訊面板實作說明

## 功能概述

參考資訊面板是一個用於顯示聊天中引用的原文和處理過程中參考的句子的組件。此功能使使用者能夠查看系統回答中引用的原始文本，以及查看處理步驟中參考的句子。面板支援通過點擊直接在PDF中查看原文內容，並高亮顯示引用的句子。

## 主要組件結構

參考資訊面板由以下組件組成：

1. **ReferencePanel** - 主面板組件，根據來源顯示相應的參考信息
2. **ReferenceList** - 參考句子列表組件，顯示多個參考項
3. **ReferenceItem** - 單個參考項組件，顯示句子內容、來源文件、頁碼和定義類型

## 數據結構

參考資訊面板使用以下主要數據類型：

```typescript
// 句子引用類型
export interface SentenceReference {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: 'cd' | 'od' | 'none';
  reason?: string;
  relevance_score?: number;
}

// 處理步驟中參考的句子類型
export interface ProcessingReference {
  event: string;
  file_uuid: string;
  sentences: SentenceReference[];
  timestamp: string;
}
```

## 使用方式

### 在聊天頁面中使用

```tsx
// 在ChatPage.tsx中
<ReferencePanel
  selectedMessageUuid={selectedMessageUuid}
  referenceSource="chat"
  onViewInPdf={handleViewInPdf}
/>
```

### 在處理進度中使用

```tsx
// 在ProcessingDetail.tsx中
<ReferencePanel
  processingReference={processingReference}
  referenceSource="processing"
  onViewInPdf={handleViewInPdf}
/>
```

## 功能特點

### 1. 定義類型標記

參考面板中的每個句子都有一個定義類型標記，可以是：
- CD (概念型定義) - 藍色標記
- OD (操作型定義) - 綠色標記
- 一般句子 - 灰色標記

### 2. PDF跳轉功能

每個參考項都有一個「在PDF中查看」按鈕，點擊後會打開PDF預覽模態框，跳轉到對應的頁面並高亮顯示引用的句子。

```tsx
// 處理查看PDF
const handleViewInPdf = (fileUuid: string, page: number, sentenceUuid: string) => {
  setPdfPreviewData({ fileUuid, page, sentenceUuid });
  setIsPdfModalOpen(true);
};
```

### 3. 自適應內容高度

參考面板會根據內容自動調整高度，並在內容過多時顯示滾動條。

```css
<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
  {/* 參考句子列表 */}
</div>
```

### 4. 來源文件和頁碼顯示

每個參考項都顯示來源文件名稱和頁碼，便於使用者了解引用來源。

```tsx
<span className="text-xs text-gray-500">
  來源: {reference.original_name} (第 {reference.page} 頁)
</span>
```

## 狀態處理

參考面板處理了各種狀態，包括：

1. **加載狀態**：顯示旋轉加載動畫
2. **錯誤狀態**：顯示錯誤信息
3. **空狀態**：當沒有參考句子時顯示提示信息

## API整合

參考面板通過fetchMessageReferences函數從後端獲取特定消息的參考信息：

```typescript
export const fetchMessageReferences = async (messageUuid: string): Promise<{ references: SentenceReference[] }> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/chat/messages/${messageUuid}/references`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('獲取消息參考信息失敗:', error);
    throw error;
  }
};
```

## 響應式設計

參考面板採用響應式設計，適用於各種屏幕尺寸：

1. 在聊天頁面中，參考面板佔據頁面寬度的1/4
2. 在處理進度詳情中，參考面板採用流式布局，適應不同寬度

## 整合PDF預覽

參考面板與PDF預覽功能緊密集成，支持直接從參考項跳轉到PDF中的對應位置：

```tsx
<PDFPreviewModal
  isOpen={isPdfModalOpen}
  onClose={handleClosePdfModal}
  fileUuid={pdfPreviewData.fileUuid}
  sentenceUuid={pdfPreviewData.sentenceUuid}
  initialPage={pdfPreviewData.page}
/>
```

## 技術實現細節

### 性能優化

1. **懶加載**：參考列表使用虛擬滾動技術，只渲染可見區域的項目
2. **數據緩存**：已獲取的參考信息會被緩存，避免重複請求
3. **按需加載**：僅在使用者點擊消息查看參考信息時才加載數據

### 交互優化

1. **點擊高亮**：被選中的消息會被高亮顯示
2. **滑動時保持狀態**：滑動頁面時保持已打開的參考面板狀態
3. **在處理進度中的交互**：處理過程中的參考信息會與進度條聯動 