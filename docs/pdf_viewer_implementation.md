# PDF預覽器組件實現說明

## 一、概述

本文檔詳細說明了文件分析平台中PDF預覽器組件的設計與實現。該組件是基於PDF.js和React實現的，支援PDF文件渲染、頁面導航、縮放功能、句子高亮顯示等功能，以滿足產品需求中對PDF預覽和句子引用查看的要求。

## 二、組件架構

PDF預覽器由以下幾個主要組件組成：

1. **PDFViewer**：核心組件，負責PDF文件的載入與渲染，整合了頁面導航、縮放、旋轉等功能
2. **PDFToolbar**：工具欄組件，提供縮放、旋轉、頁面跳轉等功能的用戶界面
3. **PDFThumbnailSidebar**：縮略圖側邊欄組件，顯示PDF文件的縮略圖，支援點擊跳轉
4. **PDFHighlighter**：高亮處理組件，負責查找和高亮顯示PDF文本中的特定句子
5. **PDFPreviewModal**：預覽模態框組件，用於在點擊引用句子時彈出顯示PDF預覽

組件間的關係如下：

```
┌─────────────────────────────────────────────────┐
│                   PDFPreviewModal               │
│                                                 │
│  ┌────────────────────────────────────────────┐ │
│  │               PDFViewer                    │ │
│  │                                            │ │
│  │  ┌────────────────┐                        │ │
│  │  │   PDFToolbar   │                        │ │
│  │  └────────────────┘                        │ │
│  │                                            │ │
│  │  ┌────────────┐    ┌─────────────────────┐ │ │
│  │  │            │    │                     │ │ │
│  │  │            │    │                     │ │ │
│  │  │   PDF      │    │     PDF Document    │ │ │
│  │  │ Thumbnail  │    │                     │ │ │
│  │  │  Sidebar   │    │  ┌─────────────┐    │ │ │
│  │  │            │    │  │PDFHighlighter│   │ │ │
│  │  │            │    │  └─────────────┘    │ │ │
│  │  └────────────┘    └─────────────────────┘ │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 三、功能說明

### 3.1 PDF渲染

使用`react-pdf`庫渲染PDF文件，支援以下功能：

- 使用PDF.js處理PDF文件載入和解析
- 支援從API獲取PDF文件流或URL
- 處理PDF加載過程中的載入狀態顯示
- 支援錯誤處理和顯示

### 3.2 頁面導航

實現了完整的頁面導航功能：

- 上一頁/下一頁按鈕
- 頁碼輸入與跳轉
- 頁面縮略圖側邊欄，支援點擊跳轉
- 鍵盤快捷鍵（左右方向鍵）
- 觸控設備上的滑動手勢

### 3.3 頁面縮略圖

側邊欄提供PDF文件的頁面縮略圖：

- 顯示所有頁面的縮略圖
- 當前頁面高亮顯示
- 點擊縮略圖跳轉到對應頁面
- 優化性能：僅渲染可見範圍內的縮略圖
- 滾動加載功能：初始只載入部分縮略圖，滾動到底部時加載更多

### 3.4 縮放與旋轉

支援PDF文件的縮放和旋轉操作：

- 縮放控制：放大/縮小按鈕
- 顯示當前縮放比例
- 旋轉按鈕：支援90度旋轉
- 鍵盤快捷鍵：`+`放大，`-`縮小，`r`旋轉

### 3.5 句子高亮顯示

核心功能是能夠在PDF中準確定位和高亮顯示特定句子：

- 基於文本內容搜索定位句子位置
- 創建高亮覆蓋層顯示句子位置
- 自動滾動到高亮位置
- 高亮樣式：黃色背景，帶有脈動邊框
- 處理PDF文本層可能存在的文本分段問題

### 3.6 URL參數支援

支援通過URL參數直接控制PDF預覽行為：

- 通過`page`參數指定初始頁碼
- 通過`highlight`參數指定需要高亮的sentence_uuid
- 在頁面導航時同步更新URL參數，但不重新加載頁面

## 四、關鍵技術實現

### 4.1 句子高亮實現原理

句子高亮顯示是本組件的核心技術挑戰，實現步驟如下：

1. **獲取句子信息**：通過API獲取需要高亮的句子文本和所在頁碼
2. **頁面渲染**：等待PDF.js完成頁面渲染和文本層生成
3. **文本搜索**：在當前頁面的文本層中查找匹配的句子文本
4. **位置計算**：計算包含目標文本的元素的邊界框
5. **創建高亮**：在計算出的位置上創建高亮覆蓋層
6. **滾動定位**：將視圖滾動到高亮位置

關鍵實現代碼：

```typescript
// 查找並高亮文本
const findAndHighlightText = (text: string, page: number) => {
  const pageContainer = pageRefs.current[page - 1];
  if (!pageContainer) return;
  
  const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
  if (!textLayer) return;
  
  // 查找文本元素
  const textElements = textLayer.querySelectorAll('span');
  let match = findBestTextMatch(textElements, text);
  
  if (match) {
    const { elements, rect } = match;
    
    // 創建高亮元素
    const highlight = document.createElement('div');
    highlight.className = 'pdf-text-highlight';
    
    // 設置位置和樣式...
    highlight.style.left = `${rect.x}px`;
    highlight.style.top = `${rect.y}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    
    // 添加到DOM
    pageContainer.appendChild(highlight);
    
    // 滾動到位置
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
```

### 4.2 性能優化策略

為保證良好的用戶體驗，實施了以下性能優化：

1. **延遲加載**：只加載當前查看的頁面，減少初始加載時間
2. **文本層優化**：只在需要的時候啟用文本層渲染
3. **縮略圖虛擬化**：只渲染當前視圖範圍內的縮略圖
4. **防抖和節流**：對滾動和調整大小等頻繁事件應用防抖處理
5. **資源預加載**：當用戶查看引用時預加載相關資源

### 4.3 響應式與適配策略

組件設計考慮了不同設備和屏幕大小：

1. **彈性佈局**：使用Flexbox實現自適應佈局
2. **觸控支援**：支援觸控設備上的滑動和手勢操作
3. **縮略圖顯示控制**：在小屏幕上可隱藏縮略圖側邊欄
4. **動態縮放**：自動調整為適合屏幕的縮放比例
5. **鍵盤和觸控的等效操作**：確保所有操作可通過不同輸入方式完成

## 五、使用方法

### 5.1 基本使用

```tsx
import { PDFViewer } from './components/PDFViewer';

// 基本使用
<PDFViewer fileUuid="550e8400-e29b-41d4-a716-446655440000" />

// 帶初始頁碼
<PDFViewer 
  fileUuid="550e8400-e29b-41d4-a716-446655440000"
  initialPage={5} 
/>

// 高亮指定句子
<PDFViewer 
  fileUuid="550e8400-e29b-41d4-a716-446655440000"
  highlightSentenceUuid="660e8400-e29b-41d4-a716-446655440000" 
/>
```

### 5.2 模態框中使用

```tsx
import { PDFPreviewModal } from './components/PDFViewer';

// 在組件內使用
const MyComponent = () => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsPreviewOpen(true)}>
        查看文件
      </button>
      
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileUuid="550e8400-e29b-41d4-a716-446655440000"
        sentenceUuid="660e8400-e29b-41d4-a716-446655440000"
        initialPage={3}
      />
    </>
  );
};
```

### 5.3 在句子引用中使用

在顯示聊天回答的引用句子時，可以點擊句子跳轉到PDF原文：

```tsx
import { SentenceReferenceView } from './components/SentenceReference';

// 在聊天回答中渲染引用
const ChatMessage = ({ message }) => {
  return (
    <div className="message">
      <div className="content">{message.content}</div>
      
      {message.references && message.references.map(reference => (
        <SentenceReferenceView
          key={reference.sentence_uuid}
          reference={reference}
        />
      ))}
    </div>
  );
};
```

## 六、依賴項

本組件需要以下依賴庫：

- react-pdf: ^6.2.2 (PDF渲染核心)
- react-swipeable: ^7.0.0 (滑動手勢支援)
- lodash: ^4.17.21 (工具函數，主要用於防抖處理)

## 七、兼容性考慮

- **瀏覽器兼容性**：支援所有主流現代瀏覽器，包括Chrome、Firefox、Safari、Edge
- **移動設備**：適配移動設備屏幕和觸控操作
- **鍵盤可訪問性**：支援完整的鍵盤導航
- **中文輸入法兼容**：確保在使用中文輸入法時快捷鍵功能依然能正常運作

## 八、後續優化方向

1. **文本搜索算法優化**：改進句子匹配算法，更好地處理中文文本和段落分隔
2. **注釋支援**：增加對PDF注釋的支援
3. **高性能渲染**：使用虛擬列表技術優化大型PDF文件的渲染
4. **文本選擇功能**：允許用戶選擇PDF中的文本進行操作
5. **跨頁高亮**：支援跨頁的句子高亮顯示
6. **自動滾動功能**：支援自動滾動閱讀模式 