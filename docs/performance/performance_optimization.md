# 前端效能優化與用戶體驗提升方案

## 目錄
1. [代碼拆分與動態導入策略](#1-代碼拆分與動態導入策略)
2. [資源預加載與懶加載策略](#2-資源預加載與懶加載策略)
3. [渲染優化技術](#3-渲染優化技術)
4. [用戶體驗優化方案](#4-用戶體驗優化方案)
5. [效能監控與分析](#5-效能監控與分析)

## 1. 代碼拆分與動態導入策略

### 1.1 路由級別代碼拆分
透過 React.lazy 和 Suspense 實現基於路由的代碼拆分，減少初始載入時間，加快首頁渲染速度：

```tsx
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// 路由級別的代碼拆分
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const MainApp = lazy(() => import('@/pages/MainApp'));

// 在路由中使用
<Routes>
  <Route path="/login" element={
    <Suspense fallback={<LoadingSpinner />}>
      <Login />
    </Suspense>
  } />
  {/* 其他路由... */}
</Routes>
```

### 1.2 組件級別代碼拆分
對大型組件和不常用功能進行拆分，例如 PDF 預覽組件和檔案上傳模組：

```tsx
// 僅在需要時載入 PDF 預覽組件
const PDFViewer = lazy(() => import('@/components/PDFViewer'));

// 使用時包裹在 Suspense 中
{showPDFPreview && (
  <Suspense fallback={<PDFPreviewSkeleton />}>
    <PDFViewer fileUuid={selectedFile.uuid} />
  </Suspense>
)}
```

### 1.3 功能模塊拆分
按功能模塊拆分業務邏輯，提高代碼可維護性並實現更細粒度的加載：

```tsx
// 動態導入較大的功能模塊
const useFileUploadLogic = () => {
  const [uploadLogic, setUploadLogic] = useState(null);
  
  useEffect(() => {
    import('@/features/fileUpload/uploadLogic').then(module => {
      setUploadLogic(module.default);
    });
  }, []);
  
  return uploadLogic;
};
```

### 1.4 優化分割點選擇
根據用戶行為分析，選擇最優的代碼分割點：

- 首次渲染關鍵路徑與非關鍵路徑分離
- 用戶交互觸發的功能按需加載
- 將大型第三方庫單獨分割

## 2. 資源預加載與懶加載策略

### 2.1 預加載策略
實現智能資源預加載，提前加載後續可能需要的資源：

```html
<!-- 在 HTML 頭部使用 link 預加載關鍵資源 -->
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/css/critical.css" as="style">
```

```tsx
// 在 React 組件中實現預加載
const prefetchResources = () => {
  const prefetchPDFViewer = () => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '/chunks/PDFViewer.chunk.js';
    document.head.appendChild(link);
  };
  
  // 當用戶鼠標懸停在文件列表上時預加載 PDF 查看器
  useEffect(() => {
    document.querySelector('.file-list').addEventListener('mouseover', prefetchPDFViewer, { once: true });
    return () => {
      document.querySelector('.file-list')?.removeEventListener('mouseover', prefetchPDFViewer);
    };
  }, []);
};
```

### 2.2 懶加載實現
對非關鍵內容實施懶加載，減少初始加載時間：

```tsx
// 圖片懶加載
const LazyImage = ({ src, alt, ...props }) => {
  return <img src={src} alt={alt} loading="lazy" {...props} />;
};

// 組件懶加載結合 Intersection Observer
const LazyComponent = ({ children, height = '200px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  return (
    <div ref={ref} style={{ minHeight: isVisible ? 'auto' : height }}>
      {isVisible ? children : null}
    </div>
  );
};
```

### 2.3 資源優先級管理
根據資源重要性設置加載優先級：

```tsx
// 使用 fetchPriority 屬性設置資源優先級
<img 
  src="/hero-image.jpg" 
  alt="Hero" 
  fetchPriority="high" 
  loading="eager" 
/>

// 非關鍵資源使用低優先級
<img 
  src="/decoration.jpg" 
  alt="Decoration" 
  fetchPriority="low" 
  loading="lazy" 
/>
```

## 3. 渲染優化技術

### 3.1 使用 React.memo 減少重渲染
對於純展示組件使用 React.memo 避免不必要的重渲染：

```tsx
// 優化純展示組件
const FileItem = React.memo(({ file, onSelect }) => {
  console.log('FileItem render');
  
  return (
    <div className="file-item" onClick={() => onSelect(file.id)}>
      <span>{file.name}</span>
      <span>{file.size} KB</span>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定義比較函數，僅當文件ID改變時才重新渲染
  return prevProps.file.id === nextProps.file.id && 
         prevProps.file.lastModified === nextProps.file.lastModified;
});
```

### 3.2 使用 useMemo 緩存計算結果
對於複雜計算結果使用 useMemo 緩存，避免重複計算：

```tsx
const FileList = ({ files, searchTerm }) => {
  // 使用 useMemo 緩存過濾結果
  const filteredFiles = useMemo(() => {
    console.log('Computing filtered files');
    return files.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [files, searchTerm]);
  
  return (
    <div className="file-list">
      {filteredFiles.map(file => (
        <FileItem key={file.id} file={file} />
      ))}
    </div>
  );
};
```

### 3.3 使用 useCallback 避免函數重建
使用 useCallback 避免每次渲染都創建新的函數引用：

```tsx
const ChatPanel = ({ conversationId }) => {
  // 使用 useCallback 避免函數重建
  const handleSendMessage = useCallback((message) => {
    console.log('Sending message');
    sendMessage(conversationId, message);
  }, [conversationId]);
  
  return (
    <div className="chat-panel">
      <ChatInput onSend={handleSendMessage} />
    </div>
  );
};
```

### 3.4 虛擬列表優化
使用虛擬列表技術處理長列表，僅渲染可視區域的項目：

```tsx
import { FixedSizeList as List } from 'react-window';

const MessageList = ({ messages }) => {
  const listRef = useRef();
  
  // 列表項渲染器
  const Row = ({ index, style }) => (
    <div style={style}>
      <MessageItem message={messages[index]} />
    </div>
  );
  
  // 在新消息到達時滾動到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(messages.length - 1);
    }
  }, [messages.length]);
  
  return (
    <List
      ref={listRef}
      height={500}
      width="100%"
      itemCount={messages.length}
      itemSize={70} // 每個消息項的平均高度
    >
      {Row}
    </List>
  );
};
```

## 4. 用戶體驗優化方案

### 4.1 骨架屏實現
使用骨架屏減少加載等待感：

```tsx
const FileSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

const FileListSkeleton = () => (
  <div className="space-y-3">
    {Array(5).fill(0).map((_, i) => (
      <FileSkeleton key={i} />
    ))}
  </div>
);

// 使用方式
{isLoading ? <FileListSkeleton /> : <FileList files={files} />}
```

### 4.2 平滑過渡動畫
實現頁面切換和操作的平滑過渡：

```tsx
// 使用 framer-motion 實現平滑過渡
import { motion, AnimatePresence } from 'framer-motion';

const PageTransition = ({ children, keyValue }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={keyValue}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

// 使用方式
<PageTransition keyValue={location.pathname}>
  <Outlet />
</PageTransition>
```

### 4.3 預期回應時間管理
根據操作類型設置預期響應時間，提升用戶體驗：

```tsx
const useFeedbackTimer = (durationMs = 500) => {
  const [showFeedback, setShowFeedback] = useState(false);
  
  const trigger = useCallback(() => {
    const timer = setTimeout(() => {
      setShowFeedback(true);
    }, durationMs);
    
    return () => clearTimeout(timer);
  }, [durationMs]);
  
  return [showFeedback, trigger, () => setShowFeedback(false)];
};

// 使用方式
const SubmitButton = ({ onSubmit, isLoading }) => {
  const [showLoading, triggerLoading, resetLoading] = useFeedbackTimer(300);
  
  const handleClick = async () => {
    triggerLoading();
    await onSubmit();
    resetLoading();
  };
  
  return (
    <button onClick={handleClick} disabled={isLoading}>
      {(isLoading && showLoading) ? <Spinner /> : 'Submit'}
    </button>
  );
};
```

### 4.4 樂觀 UI 更新
實現樂觀 UI 更新，提前顯示操作結果：

```tsx
const useOptimisticUpdate = (queryKey, updateFn) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateFn,
    onMutate: async (newData) => {
      // 取消任何外發的重獲取
      await queryClient.cancelQueries({ queryKey });
      
      // 保存舊數據以便回滾
      const previousData = queryClient.getQueryData(queryKey);
      
      // 樂觀更新數據
      queryClient.setQueryData(queryKey, oldData => {
        // 根據具體數據結構實現更新邏輯
        return {...oldData, ...newData};
      });
      
      return { previousData };
    },
    onError: (err, newData, context) => {
      // 發生錯誤時回滾到舊數據
      queryClient.setQueryData(queryKey, context.previousData);
    },
    onSettled: () => {
      // 操作完成後重新獲取最新數據
      queryClient.invalidateQueries({ queryKey });
    },
  });
};
```

## 5. 效能監控與分析

### 5.1 Web Vitals 監控
實現 Web Vitals 關鍵指標監控：

```tsx
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';

const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    getCLS(onPerfEntry); // Cumulative Layout Shift
    getFID(onPerfEntry); // First Input Delay
    getLCP(onPerfEntry); // Largest Contentful Paint
    getFCP(onPerfEntry); // First Contentful Paint
    getTTFB(onPerfEntry); // Time to First Byte
  }
};

// 在 React 中初始化
reportWebVitals((metric) => {
  // 發送到分析服務
  console.log(metric);
  
  // 例如發送到自定義分析端點
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric)
    });
  }
});
```

### 5.2 瓶頸分析與優化
使用 React Profiler 辨識渲染瓶頸：

```tsx
// 在開發環境中啟用 React Profiler
import { Profiler } from 'react';

const onRenderCallback = (
  id, // 發生提交的 Profiler 樹的 "id"
  phase, // "mount" （首次渲染）或 "update" （重新渲染）
  actualDuration, // 本次更新的渲染所花費的時間
  baseDuration, // 渲染整個子樹所需的估計時間
  startTime, // React 開始渲染的時間戳
  commitTime // React 提交更新的時間戳
) => {
  // 記錄渲染時間超過閾值的組件
  if (actualDuration > 16) { // 大於一個幀的時間（16.67ms）
    console.warn(`Slow rendering detected in ${id}: ${actualDuration.toFixed(2)}ms`);
    
    // 在生產環境可發送到監控服務
    if (process.env.NODE_ENV === 'production') {
      reportSlowRendering({
        componentId: id,
        duration: actualDuration,
        timestamp: commitTime
      });
    }
  }
};

// 使用方式
<Profiler id="ChatPanel" onRender={onRenderCallback}>
  <ChatPanel />
</Profiler>
```

### 5.3 自定義性能標記
使用 Performance API 添加自定義標記：

```tsx
const usePerformanceMark = (name) => {
  useEffect(() => {
    // 開始測量
    performance.mark(`${name}-start`);
    
    return () => {
      // 結束測量
      performance.mark(`${name}-end`);
      performance.measure(
        `${name}-duration`,
        `${name}-start`,
        `${name}-end`
      );
      
      // 獲取測量結果
      const measurements = performance.getEntriesByName(`${name}-duration`);
      if (measurements.length > 0) {
        console.log(`${name} took ${measurements[0].duration.toFixed(2)}ms`);
      }
      
      // 清理標記
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(`${name}-duration`);
    };
  }, [name]);
};

// 使用方式
const PDFViewer = ({ fileUuid }) => {
  usePerformanceMark(`PDFViewer-${fileUuid}`);
  
  // 組件實現...
};
```

上述優化策略將大幅提升應用的效能與用戶體驗。實施時應優先關注影響用戶體驗的關鍵路徑，逐步應用這些技術到整個應用中。 