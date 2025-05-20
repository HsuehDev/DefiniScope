# 互動式句子引用功能實現文檔

## 1. 功能簡介

互動式句子引用功能是文件分析平台的核心功能之一，它允許用戶在查看AI回答時能夠直接交互式地查看引用的原始句子、上下文以及在PDF中的位置。這項功能大幅提升了AI回答的可信度和可追溯性，為用戶提供了更豐富的研究體驗。

## 2. 安裝依賴

本功能實現依賴以下第三方庫：

```bash
# 安裝PDF渲染相關庫
npm install pdfjs-dist@2.16.105

# 安裝UI和交互相關庫
npm install react react-dom
npm install typescript @types/react @types/react-dom
npm install tailwindcss
```

在`package.json`中添加以下依賴：

```json
{
  "dependencies": {
    "pdfjs-dist": "^2.16.105",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^4.9.5"
  },
  "devDependencies": {
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "tailwindcss": "^3.2.7"
  }
}
```

## 3. 組件結構與關係

互動式句子引用功能主要由以下組件構成：

```
ReferenceTag                  // 引用標籤組件
ReferencePopover              // 引用懸停預覽組件
ReferenceContextViewer        // 上下文查看器組件
PDFViewer                     // PDF預覽組件
PDFPreviewModal               // PDF預覽模態框
ChatMessage                   // 集成引用功能的聊天消息組件
```

組件之間的關係如下：

```
ChatMessage
  ├── ReferenceTag (多個)
  ├── ReferencePopover
  ├── ReferenceContextViewer
  └── PDFPreviewModal
       └── PDFViewer
```

Hook和工具函數：

```
useReferenceManager          // 管理引用交互邏輯的Hook
api.ts                      // 與後端API交互的函數
```

## 4. 核心代碼說明

### 4.1 引用標籤組件（ReferenceTag）

引用標籤組件是用戶最先接觸到的引用界面元素，它顯示引用的基本信息並處理點擊和懸停事件。

```tsx
// frontend/src/components/reference/ReferenceTag.tsx
import React, { useState } from 'react';
import { ReferenceTagProps } from '../../types/reference';

const ReferenceTag: React.FC<ReferenceTagProps> = ({ reference, onClick, onHover }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // 根據定義類型顯示不同的標籤顏色
  const getTagColor = () => {
    switch (reference.defining_type) {
      case 'cd':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'od':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div 
      className={`inline-flex items-center px-2 py-1 rounded-md border cursor-pointer 
                 transition-all duration-200 mx-1 my-1 text-xs 
                 ${getTagColor()} 
                 ${isHovered ? 'shadow-md transform scale-105' : ''}`}
      onClick={() => onClick(reference)}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover(reference);
      }}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`參考出處：${reference.original_name}，第 ${reference.page} 頁`}
      role="button"
      tabIndex={0}
    >
      {/* 標籤內容 */}
    </div>
  );
};
```

### 4.2 引用管理Hook（useReferenceManager）

該自定義Hook集中管理所有引用相關的狀態和交互邏輯，使組件能夠專注於UI渲染。

```tsx
// frontend/src/hooks/useReferenceManager.ts
import { useState, useCallback } from 'react';
import { Reference } from '../types/reference';

export function useReferenceManager() {
  // 懸停預覽相關狀態
  const [hoveredReference, setHoveredReference] = useState<Reference | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  
  // 上下文查看相關狀態
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null);
  const [showContextViewer, setShowContextViewer] = useState(false);
  
  // PDF預覽相關狀態
  const [pdfReference, setPdfReference] = useState<Reference | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // 處理引用懸停
  const handleReferenceHover = useCallback((reference: Reference, event?: React.MouseEvent) => {
    // 處理懸停邏輯
  }, []);

  // 處理引用點擊
  const handleReferenceClick = useCallback((reference: Reference) => {
    // 處理點擊邏輯
  }, []);

  // 其他處理函數...

  return {
    // 返回狀態和處理函數
    hoveredReference,
    popoverPosition,
    showPopover,
    handleReferenceHover,
    // ...其他返回值
  };
}
```

### 4.3 PDF預覽組件（PDFViewer）

PDF預覽組件負責渲染PDF文件並高亮顯示引用的句子，它是整個互動式引用功能的核心組件之一。

```tsx
// frontend/src/components/reference/PDFViewer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { PDFPreviewParams } from '../../types/reference';

const PDFViewer: React.FC<PDFPreviewParams> = ({ 
  file_uuid, 
  page,
  sentence_uuid
}) => {
  // 狀態定義
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page || 1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 使用pdfjs加載PDF文件
  useEffect(() => {
    let isMounted = true;
    
    const loadPdf = async () => {
      // PDF加載邏輯
    };
    
    loadPdf();
    
    return () => {
      isMounted = false;
    };
  }, [file_uuid, currentPage]);

  // 渲染PDF頁面
  const renderPage = async (pdf: any, pageNum: number) => {
    // 頁面渲染邏輯
  };

  // 高亮顯示特定句子
  const highlightSentence = async (sentenceUuid: string) => {
    // 句子高亮邏輯
  };

  return (
    <div className="flex flex-col h-full">
      {/* 工具欄 */}
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
        {/* 頁面導航和縮放控制 */}
      </div>
      
      {/* PDF內容顯示區域 */}
      <div 
        className="flex-1 overflow-auto bg-gray-200 flex justify-center"
        ref={containerRef}
      >
        {/* 加載狀態和錯誤處理 */}
      </div>
    </div>
  );
};
```

### 4.4 上下文查看器（ReferenceContextViewer）

上下文查看器組件顯示引用句子的前後文，為用戶提供更完整的理解背景。

```tsx
// frontend/src/components/reference/ReferenceContextViewer.tsx
import React, { useState, useEffect } from 'react';
import { ContextViewerParams } from '../../types/reference';

const ReferenceContextViewer: React.FC<ContextViewerParams> = ({ 
  reference, 
  isOpen, 
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<{
    before: string[];
    sentence: string;
    after: string[];
  }>({
    before: [],
    sentence: reference?.sentence || "",
    after: []
  });

  useEffect(() => {
    if (isOpen && reference) {
      fetchSentenceContext(reference.file_uuid, reference.sentence_uuid);
    }
  }, [isOpen, reference]);

  // 獲取句子上下文
  const fetchSentenceContext = async (fileUuid: string, sentenceUuid: string) => {
    // API調用邏輯
  };

  // 處理查看PDF
  const handleViewPdf = () => {
    // PDF查看邏輯
  };

  if (!isOpen || !reference) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 模態框內容 */}
      </div>
    </div>
  );
};
```

### 4.5 集成到聊天消息（ChatMessage）

ChatMessage組件將引用功能集成到聊天界面中，使引用與對話無縫銜接。

```tsx
// frontend/src/components/chat/ChatMessage.tsx
import React from 'react';
import { Message } from '../../types/reference';
import ReferenceTag from '../reference/ReferenceTag';
import ReferencePopover from '../reference/ReferencePopover';
import ReferenceContextViewer from '../reference/ReferenceContextViewer';
import PDFPreviewModal from '../reference/PDFPreviewModal';
import { useReferenceManager } from '../../hooks/useReferenceManager';

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const {
    // 從useReferenceManager獲取狀態和方法
  } = useReferenceManager();

  // 渲染消息內容
  const renderMessageContent = () => {
    // 消息渲染邏輯
  };

  return (
    <div className={`py-4 ${isUserMessage ? 'bg-gray-50' : 'bg-white'}`}>
      {/* 消息內容 */}
      
      {/* 引用相關組件 */}
      <ReferencePopover 
        reference={hoveredReference}
        position={popoverPosition}
        isVisible={showPopover}
      />
      
      {selectedReference && (
        <ReferenceContextViewer 
          reference={selectedReference}
          isOpen={showContextViewer}
          onClose={closeContextViewer}
        />
      )}
      
      <PDFPreviewModal 
        reference={pdfReference}
        isOpen={showPdfPreview}
        onClose={closePdfPreview}
      />
    </div>
  );
};
```

## 5. 使用示例

下面是在React應用中使用互動式句子引用功能的示例：

```tsx
import React, { useState, useEffect } from 'react';
import ChatMessage from './components/chat/ChatMessage';
import { Message } from './types/reference';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  // 模擬從API獲取對話
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/chat/conversations/123456');
        const data = await response.json();
        setMessages(data.messages);
      } catch (error) {
        console.error('獲取對話時出錯:', error);
      }
    };
    
    fetchMessages();
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">對話</h1>
      
      <div className="space-y-2">
        {messages.map(message => (
          <ChatMessage key={message.message_uuid} message={message} />
        ))}
      </div>
    </div>
  );
};
```

## 6. 後端API規格

互動式句子引用功能依賴以下後端API:

### 6.1 獲取句子上下文

```
GET /api/files/{file_uuid}/sentences/{sentence_uuid}/context
```

**回應格式:**

```json
{
  "before": [
    "前一句內容",
    "前第二句內容"
  ],
  "sentence": "當前引用的句子內容",
  "after": [
    "後一句內容",
    "後第二句內容"
  ]
}
```

### 6.2 獲取句子在PDF中的位置

```
GET /api/files/{file_uuid}/sentences/{sentence_uuid}/position
```

**回應格式:**

```json
{
  "position": {
    "x": 120,
    "y": 450,
    "width": 400,
    "height": 25
  }
}
```

### 6.3 獲取PDF預覽

```
GET /api/files/{file_uuid}/preview?page={page}&highlight={sentence_uuid}
```

此API以PDF文件的形式直接返回，通常由PDFViewer組件直接使用。

## 7. 性能和可訪問性考量

### 7.1 性能優化

- **懶加載PDFjs庫**：僅在需要顯示PDF時才動態導入pdfjsLib
- **使用useMemo和useCallback**：減少不必要的渲染
- **分頁加載**：對於長對話，實現分頁加載消息
- **引用緩存**：緩存最近查看的引用上下文和PDF頁面

### 7.2 可訪問性

- **鍵盤支持**：所有引用組件支持鍵盤導航和操作
- **ARIA屬性**：添加適當的aria-label和role屬性
- **色彩對比度**：確保所有文本和背景色之間有足夠的對比度
- **響應式設計**：適應不同屏幕尺寸的設備

## 8. 可能遇到的問題與解決方案

### 8.1 PDF渲染問題

**問題**: 在某些瀏覽器中PDF可能無法正確渲染。

**解決方案**: 
- 檢查PDF.js版本與瀏覽器的兼容性
- 使用canvas回退渲染
- 提供PDF下載選項作為備選方案

### 8.2 高亮位置不準確

**問題**: PDF中的高亮位置可能與實際句子位置不符。

**解決方案**:
- 改進後端句子位置提取算法
- 實現搜索功能作為備選定位方式
- 提供頁面預覽縮略圖以便快速導航

### 8.3 移動設備上的交互問題

**問題**: 在小屏幕設備上引用懸停預覽可能不易使用。

**解決方案**:
- 為移動設備提供替代交互模式，如輕觸而非懸停
- 優化模態框大小，適應小屏幕
- 為小屏幕設備提供簡化的PDF查看體驗

## 9. 測試策略

### 9.1 單元測試

使用Jest和React Testing Library測試各個引用組件：
- ReferenceTag的點擊和懸停事件
- useReferenceManager Hook的狀態管理
- ChatMessage組件的引用渲染

### 9.2 集成測試

測試引用功能在整個應用中的表現：
- 模擬API響應以測試上下文加載
- 測試PDF渲染和高亮功能
- 確保模態框和懸停預覽正確顯示

### 9.3 用戶體驗測試

進行實際用戶測試，關注以下方面：
- 引用標籤的可發現性
- 懸停預覽的有用性
- 上下文查看器的閱讀體驗
- PDF預覽和高亮的清晰度

## 10. 結語

互動式句子引用功能為用戶提供了深入理解AI回答的工具，通過細致的UI設計和流暢的交互，使用戶能夠輕松追溯信息來源，增強了平台的專業性和可信度。未來我們會持續優化這一功能，加入更多智能交互元素，進一步提升用戶體驗。 