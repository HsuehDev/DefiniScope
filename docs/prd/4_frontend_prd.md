# IV. 前端 PRD (Frontend PRD - React)

## 1. 概述與職責 (Overview & Responsibilities)

前端應用是系統的使用者介面，提供直觀的視覺化互動環境，負責以下主要職責：
- 提供用戶認證介面 (登入/註冊)
- 呈現三欄式佈局 (檔案管理、聊天對話、參考資訊)
- 支援檔案上傳功能 (含拖放和斷點續傳)
- 即時顯示處理進度 (通過 WebSocket)
- 提供互動式聊天界面 (含引用原文)
- 實現 PDF 預覽功能 (支援翻頁與引用句子高亮顯示)
- 管理檔案完整生命週期 (上傳、預覽、刪除)

## 2. 技術棧 (Technical Stack)

### 2.1 核心框架與語言
- **語言**: TypeScript 5.0+
- **框架**: React 18+
- **建構工具**: Vite 4+
- **路由**: React Router 6+
- **CDN 部署**: 靜態資源透過 CDN 分發，提高全球性能

### 2.2 狀態管理
- **API 狀態**: TanStack Query (React Query) 4+ (內建重試、背景同步和快取)
- **全局狀態**: Redux Toolkit 1.9+ (高效狀態管理)
- **表單狀態**: React Hook Form 7+ (高性能表單處理)
- **前端快取**: Service Workers 和 IndexedDB 用於離線數據快取

### 2.3 UI 與樣式
- **主要樣式庫**: TailwindCSS 3+ (按需編譯，減少 CSS 體積)
- **組件庫**: Headless UI (輕量級)
- **圖標**: Heroicons (SVG 基於組件)
- **主題**: 支援亮色/暗色模式切換
- **資源優化**: 影像壓縮、懶加載和自適應加載

### 2.4 網絡與通信
- **HTTP 客戶端**: Axios (具有請求合併、取消和攔截功能)
- **WebSocket 客戶端**: Socket.IO Client / 原生 WebSocket (自動重連和重試機制)
- **認證管理**: JWT 存儲在 localStorage/Cookies
- **網絡降級**: 網絡條件不佳時自動降級策略
- **批量請求**: 小型請求合併為批量請求以減少網絡開銷
- **上傳超時控制**: 斷點續傳狀態監控，超過10分鐘自動提示用戶

### 2.5 附加庫與工具
- **PDF 渲染**: PDF.js (支援高亮顯示特定文本)
- **表單驗證**: Zod / Yup
- **日期處理**: date-fns
- **國際化**: i18next (預設繁體中文，zh-TW)
- **檔案處理**: dropzone.js (檔案拖放上傳)

## 3. 頁面與路由 (Pages & Routing)

### 3.1 主要路由結構
```
/                      # 首頁，未登入時重定向到登入頁
/login                 # 登入頁面
/register              # 註冊頁面
/app                   # 主應用 (受保護路由，需要認證)
/app/chat/:conversationId  # 特定對話內容
```

### 3.2 路由守衛策略
- 使用自定義 `PrivateRoute` 元件保護受限頁面
- 根據 JWT 令牌有效性判斷用戶認證狀態
- 未認證的訪問會重定向到登入頁面並保存原始導向 URL

## 4. 組件設計與互動 (Component Design & Interactions)

### 4.1 組件層次結構
```
App
├── AuthLayout (登入/註冊頁佈局)
│   ├── LoginForm
│   └── RegistrationForm
└── MainLayout (主應用佈局)
    ├── Navbar
    ├── Sidebar (左側面板)
    │   ├── FileUploadZone
    │   └── FileList
    ├── ChatPanel (中間面板)
    │   ├── ChatHeader
    │   ├── ChatMessageList
    │   │   ├── UserMessage
    │   │   └── AssistantMessage (含引用)
    │   └── ChatInput
    └── InfoPanel (右側面板)
        ├── ProgressDisplay
        └── ReferencesPanel
```

### 4.2 核心組件詳細設計

#### 4.2.1 認證組件

##### 4.2.1.1 LoginForm
- **用途**: 用戶登入表單
- **主要元素**:
  - 電子郵件輸入欄位 (含驗證)
  - 密碼輸入欄位 (含密碼顯示切換)
  - 登入按鈕 (含載入狀態)
  - 錯誤訊息顯示區
  - 前往註冊頁的連結
- **互動行為**:
  - 驗證表單輸入 (電子郵件格式、必填欄位)
  - 提交表單時調用登入 API
  - 顯示後端返回的錯誤信息
  - 登入成功後重定向到 `/app`
- **狀態管理**:
  - 使用 React Hook Form 管理表單
  - 使用 Redux 存儲用戶數據

##### 4.2.1.2 RegistrationForm
- **用途**: 用戶註冊表單
- **主要元素**:
  - 電子郵件輸入欄位 (含驗證)
  - 密碼輸入欄位 (含強度指示)
  - 密碼確認欄位
  - 註冊按鈕 (含載入狀態)
  - 錯誤訊息顯示區
  - 前往登入頁的連結
- **互動行為**:
  - 驗證表單輸入 (電子郵件格式、密碼強度、密碼匹配)
  - 提交表單時調用註冊 API
  - 顯示後端返回的錯誤信息
  - 註冊成功後自動登入或導向登入頁
- **狀態管理**:
  - 使用 React Hook Form 管理表單
  - 使用 React Query 處理註冊請求

#### 4.2.2 左側面板組件

##### 4.2.2.1 FileUploadZone
- **用途**: 檔案上傳區域
- **主要元素**:
  - 拖放區域
  - 上傳進度條
  - 選擇檔案按鈕
  - 上傳超時計時器
- **互動行為**:
  - 支援檔案拖放
  - 支援選擇多個檔案
  - 檢驗檔案類型 (僅 PDF)
  - 檢驗檔案大小 (上限 10MB)
  - 顯示上傳進度
  - 支援斷點續傳
  - 顯示上傳計時器（顯示剩餘時間至10分鐘超時）
  - 超過10分鐘未完成上傳時顯示超時警告
- **狀態管理**:
  - 上傳狀態 (idle, uploading, timeout, success, error)
  - 上傳進度 (百分比)
  - 上傳剩餘時間
  - 上傳錯誤信息

##### 4.2.2.2 FileList
- **用途**: 顯示用戶上傳的檔案列表
- **主要元素**:
  - 檔案名稱
  - 上傳日期
  - 處理狀態標記
  - 進度指示器 (針對正在處理的檔案)
  - 處理階段詳細說明 (PDF提取中、句子分類中等)
  - 檔案操作選項 (預覽、下載、刪除)
  - 刪除確認對話框
- **互動行為**:
  - 點擊檔案名稱開啟預覽
  - 點擊檔案操作按鈕執行相應操作
  - 點擊進度條查看詳細處理狀態和最新處理的句子
  - 即時更新檔案處理狀態
  - 點擊刪除按鈕彈出確認對話框
  - 確認刪除後同步刪除資料庫記錄和MinIO中的檔案
- **狀態管理**:
  - 使用 React Query 獲取檔案列表
  - 通過 WebSocket 接收檔案處理進度更新
  - 存儲最近處理的句子和分類結果用於詳細展示
  - 追踪刪除操作狀態

#### 4.2.3 中間面板組件

##### 4.2.3.1 ChatMessageList
- **用途**: 顯示聊天對話歷史
- **主要元素**:
  - 用戶消息氣泡
  - 系統回覆氣泡
  - 引用原文標記
  - 時間戳
  - 處理進度指示器
  - 關鍵句子預覽卡片
  - PDF快速預覽連結
- **互動行為**:
  - 自動滾動至最新消息
  - 點擊引用原文標記顯示詳細內容
  - 支援複製消息內容
  - 點擊系統回覆中的句子引用可直接跳轉查看原文
  - 在處理過程中可查看系統當前處理的關鍵句子預覽
  - 點擊引用句子可彈出PDF預覽並高亮顯示相關句子
- **狀態管理**:
  - 使用 React Query 獲取對話歷史
  - 通過 WebSocket 接收實時消息更新和處理進度
  - 追踪選中的引用句子

##### 4.2.3.2 ChatInput
- **用途**: 用戶輸入查詢的文本區域
- **主要元素**:
  - 多行文本輸入框
  - 發送按鈕
  - 輸入字數統計
- **互動行為**:
  - 支援 Shift+Enter 換行
  - 僅 Enter 鍵發送消息
  - 禁止發送空消息
  - 發送後清空輸入框
  - 發送消息時展示處理中狀態
- **狀態管理**:
  - 輸入狀態 (idle, typing, sending)
  - 輸入內容

#### 4.2.4 右側面板組件

##### 4.2.4.1 ProgressDisplay
- **用途**: 顯示當前任務進度
- **主要元素**:
  - 進度條
  - 進度文字描述
  - 任務類型標記
  - 處理階段詳細說明
  - 當前正在處理的句子或關鍵詞預覽
- **互動行為**:
  - 即時更新進度信息
  - 展開/收合詳細進度面板
  - 點擊當前處理的句子預覽以查看詳情
  - 任務完成後自動隱藏
- **狀態管理**:
  - 通過 WebSocket 接收進度更新
  - 保存處理各階段的關鍵信息用於展示

##### 4.2.4.2 ReferencesPanel
- **用途**: 顯示聊天中引用的原文和處理過程中參考的句子
- **主要元素**:
  - 原文句子列表
  - 來源檔案名稱
  - 頁碼標記
  - 定義類型標記 (CD/OD)
  - 相關性評分 (僅用於搜尋結果)
  - 分類依據顯示 (僅用於處理結果)
  - 在PDF中查看按鈕
- **互動行為**:
  - 點擊來源檔案打開預覽
  - 點擊頁碼跳轉到對應頁面
  - 高亮當前引用的原文句子
  - 可在系統處理過程中即時查看每個階段的參考句子
  - 提供在原始檔案中查看上下文的功能
  - 點擊"在PDF中查看"按鈕可跳轉至對應PDF頁面並高亮顯示該句
- **狀態管理**:
  - 與當前選中的消息或處理階段關聯
  - 使用 React Query 獲取引用詳情
  - 通過 WebSocket 接收處理過程中的參考句子更新

### 4.3 核心交互流程

#### 4.3.1 檔案上傳流程
1. 用戶將檔案拖放至上傳區或選擇檔案
2. 前端檢驗檔案類型和大小
3. 開始上傳，顯示進度條
4. 上傳完成後，檔案出現在左側檔案列表
5. 後端自動開始處理檔案，前端通過 WebSocket 接收進度更新
6. 前端即時顯示詳細處理階段和進度
7. 用戶可點擊查看處理中的句子和分類結果
8. 處理完成後，更新檔案狀態

#### 4.3.2 聊天對話流程
1. 用戶在聊天輸入框輸入查詢
2. 點擊發送或按 Enter 鍵提交查詢
3. 顯示用戶消息氣泡
4. 系統開始自動處理查詢，右側面板實時顯示處理階段和進度
5. 處理過程中顯示提取的關鍵詞、找到的相關定義和用於生成答案的參考句子
6. 用戶可在處理過程中點擊查看找到的相關句子詳情
7. 接收系統回覆，顯示回覆氣泡
8. 右側面板更新為引用原文，顯示所引用的定義句子
9. 用戶可通過點擊回覆中的引用標記查看原文详情

## 5. 使用者體驗 (User Experience - UX)

### 5.1 設計原則
- **簡潔清晰**: 界面設計簡潔明瞭，減少視覺干擾
- **即時反饋**: 所有操作提供適當的視覺反饋
- **漸進式引導**: 引導用戶完成複雜流程，如首次上傳檔案
- **一致性**: 統一的視覺語言和交互模式
- **可訪問性**: 良好的鍵盤支持和焦點管理

### 5.2 載入與過渡
- 使用骨架屏 (Skeleton) 減少加載等待感
- 頁面切換時使用平滑過渡動畫
- 長時間操作顯示適當的進度指示

### 5.3 錯誤處理與通知
- 表單錯誤就近顯示，清晰指導修正方法
- 操作結果通過 Toast 通知提示
- 網絡錯誤提供重試選項
- 關鍵錯誤使用模態對話框阻斷操作

### 5.4 響應式設計
- 主要針對桌面環境優化 (>= 1024px)
- 支援平板設備 (>= 768px)
- 在小屏幕設備上可透過面板切換按鈕調整佈局

### 5.5 效能優化策略
- **按需加載**: 使用 React.lazy 和 Suspense 實現組件動態加載
- **代碼拆分**: 基於路由的代碼拆分，減少初始載入時間
- **資源預加載**:
  - 使用 `<link rel="preload">` 預加載關鍵資源
  - 使用 `<link rel="prefetch">` 預取可能需要的資源
- **圖片優化**:
  - 使用適當的圖片格式 (如 WebP)
  - 實現響應式圖片加載 (srcset 屬性)
  - 使用主動加載 (eager loading) 和懶加載 (lazy loading) 策略
- **渲染優化**:
  - 使用 `React.memo` 減少不必要的重渲染
  - 列表使用虛擬化技術 (react-window/react-virtualized)
  - 使用 `useMemo` 和 `useCallback` 避免昂貴的計算和函數重建
- **監控與分析**:
  - 使用 Web Vitals 收集關鍵用戶體驗指標
  - 實時用戶監控與錯誤追踪
  - 效能瓶頸分析與改進

### 5.6 高並發處理策略
- **用戶體驗平滑性**:
  - 樂觀 UI 更新 (先更新 UI，後台同步更新)
  - 智能重試機制 (自動處理網絡故障)
  - 背景同步和衝突解決
- **資源限制與優先級**:
  - 限制同時並行請求數
  - HTTP/2 多路復用以減少連接數
  - 按優先級調度重要操作
- **WebSocket 連接管理**:
  - 合併多個事件更新一次 UI 渲染
  - 減少不必要的連接/重連
  - 網絡條件不佳時降級為輪詢
- **異常處理**:
  - 全局錯誤邊界 (Error Boundaries)
  - 精細的錯誤反饋和重試選項
  - 緩存數據作為後備展示內容

## 6. API 與 WebSocket 整合

### 6.1 API 封裝策略
- 使用 Axios 實例統一管理 API 請求
- 自定義請求和響應攔截器處理認證和錯誤
- 按功能模組組織 API 調用函數
- 使用 React Query 管理 API 狀態和快取

### 6.2 API 整合點

| 組件/頁面 | API 端點 | 用途 |
|----------|---------|------|
| LoginForm | POST /auth/login | 用戶登入 |
| RegistrationForm | POST /auth/register | 用戶註冊 |
| FileUploadZone | POST /files/upload | 上傳檔案 |
| FileList | GET /files | 獲取檔案列表 |
| FileList | DELETE /files/{file_uuid} | 刪除檔案 |
| ChatMessageList | GET /chat/conversations/{conversation_uuid} | 獲取對話內容 |
| ChatInput | POST /chat/query | 發送查詢 |

### 6.3 WebSocket 連接管理
- 使用自定義 Hook 管理 WebSocket 連接
- 實現自動重連機制
- 實現按需連接與斷開的邏輯，優化資源使用
- 支援同時處理多個 WebSocket 事件
- 採用階層式重試策略 (短延遲優先，隨後指數增加)
- 實現連接池管理，限制最大並行連接數為 5
- 對同一資源的請求合併為單一 WebSocket 連接
- 在多個標籤頁共享 WebSocket 連接以節省資源
- 實現服務降級：在連接失敗時降級為輪詢

### 6.4 WebSocket 事件處理

| 連接類型 | 事件 | 處理方式 |
|---------|-----|---------|
| 檔案處理 | processing_started | 更新檔案狀態為「處理中」，初始化進度顯示 |
| 檔案處理 | pdf_extraction_progress | 更新檔案處理進度並顯示 PDF 提取階段 |
| 檔案處理 | sentence_extraction_detail | 顯示最近提取的句子內容，可供用戶查看 |
| 檔案處理 | sentence_classification_progress | 更新句子分類進度並顯示分類階段 |
| 檔案處理 | sentence_classification_detail | 顯示最近分類的句子和分類結果，可供用戶互動查看 |
| 檔案處理 | processing_completed | 更新檔案狀態為「已完成」並顯示完成提示 |
| 檔案處理 | processing_failed | 更新檔案狀態為「處理失敗」，顯示錯誤詳情並提供重試選項 |
| 查詢處理 | query_processing_started | 顯示查詢處理中狀態，初始化進度顯示 |
| 查詢處理 | keyword_extraction_completed | 顯示提取的關鍵詞，更新處理階段 |
| 查詢處理 | database_search_progress | 更新資料庫搜尋進度並顯示搜尋階段 |
| 查詢處理 | database_search_result | 實時顯示搜尋到的定義句子，可供用戶互動查看 |
| 查詢處理 | answer_generation_started | 更新處理階段為答案生成 |
| 查詢處理 | referenced_sentences | 顯示用於生成答案的關鍵句子，用戶可互動查看 |
| 查詢處理 | query_completed | 顯示查詢結果、引用原文和處理完成提示 |
| 查詢處理 | query_failed | 顯示查詢失敗錯誤訊息並提供重試選項 |

## 7. 狀態管理策略

### 7.1 TanStack Query (React Query)
- **用途**: 管理伺服器狀態
- **管理範圍**:
  - 檔案列表
  - 對話歷史
  - 當前對話內容
  - 用戶查詢結果
- **主要優勢**:
  - 自動重試
  - 背景更新
  - 樂觀更新
  - 請求去重
  - 快取管理

### 7.2 Redux Toolkit
- **用途**: 管理全局客戶端狀態
- **管理範圍**:
  - 用戶認證信息
  - 應用設置 (主題、語言)
  - 全局 UI 狀態 (側邊欄開合、模態框)
- **主要優勢**:
  - 集中式狀態管理
  - 狀態持久化
  - 動作追踪與調試

### 7.3 狀態管理分層策略
- **局部狀態**: 使用 useState/useReducer
- **局部共享狀態**: 使用 Context API
- **服務端狀態**: 使用 React Query
- **全局應用狀態**: 使用 Redux Toolkit

### 7.4 效能優化措施
- **狀態正規化**: 避免重複資料
- **選擇性訂閱**: 只訂閱組件所需數據片段
- **狀態持久化**: 在 localStorage/IndexedDB 中保存關鍵狀態
- **瞬時狀態標記**: 區分持久狀態和瞬時狀態
- **批量更新**: 多個狀態更新合併為一次渲染
- **數據去重**: 確保相同數據只存儲一次
- **選擇性緩存失效**: 只清除需要更新的數據緩存

## 8. 前端測試策略

### 8.1 單元測試
- **框架**: Vitest + React Testing Library
- **測試範圍**:
  - 獨立組件的渲染和交互
  - 狀態邏輯
  - 工具函數
  - WebSocket Hook 的連接和事件處理
- **測試類型**:
  - 組件渲染測試
  - 事件處理測試
  - WebSocket 事件處理測試
  - 快照測試 (僅對穩定組件)

### 8.2 整合測試
- **框架**: Vitest + React Testing Library
- **測試範圍**:
  - 組件組合
  - 狀態共享
  - 路由功能
- **測試類型**:
  - 路由導航測試
  - 表單提交測試
  - 模擬 API 調用測試

### 8.3 E2E 測試
- **框架**: Playwright
- **測試範圍**:
  - 關鍵用戶流程
  - 跨瀏覽器兼容性
- **測試類型**:
  - 用戶登入/註冊流程
  - 檔案上傳及處理流程
  - 聊天對話流程

### 8.4 測試模擬策略
- 使用 MSW (Mock Service Worker) 模擬 API 響應
- 創建模擬 WebSocket 服務器模擬實時更新
- 構建測試幫助函數簡化重複設置

## 5. 新增功能詳細設計

### 5.1 檔案預覽功能

#### 5.1.1 PDF 預覽組件 (PDFViewer)
- **用途**: 顯示 PDF 檔案內容，支援翻頁和查看特定句子
- **主要元素**:
  - PDF 畫布
  - 頁面導航控制項
  - 縮放控制項
  - 句子高亮顯示
  - 頁面縮略圖側邊欄
  - 全屏切換按鈕
- **互動行為**:
  - 上下頁翻頁
  - 輸入頁碼直接跳轉
  - 點擊縮略圖跳轉
  - 通過URL參數直接跳轉到特定頁並高亮句子
  - 支援鍵盤快捷鍵 (←→翻頁, +/-縮放)
  - 支援觸控裝置手勢 (滑動翻頁, 雙指縮放)
- **狀態管理**:
  - 當前頁碼
  - 縮放級別
  - 高亮句子ID
  - 載入狀態
- **實現細節**:
  - 使用 PDF.js 渲染 PDF
  - 懶加載頁面，只在需要時載入
  - 使用 URL 查詢參數跳轉到特定頁和高亮特定句子
  - 提供 API 以便父組件控制頁面和高亮

#### 5.1.2 PDF 預覽模態框 (PDFPreviewModal)
- **用途**: 在彈出視窗中顯示 PDF 預覽，無需離開當前頁面
- **主要元素**:
  - 模態框窗口
  - PDF 預覽組件
  - 關閉按鈕
  - 功能控制區 (下載、全屏等)
- **互動行為**:
  - 從任何引用點擊可打開
  - 直接跳轉到引用的句子並高亮
  - 可在預覽中繼續瀏覽整個文檔
  - 點擊背景或關閉按鈕退出
- **狀態管理**:
  - 可見狀態
  - 目標文件UUID
  - 目標句子UUID
  - 目標頁碼

### 5.2 斷點續傳與超時控制

#### 5.2.1 上傳管理器 (UploadManager)
- **用途**: 管理檔案上傳狀態和續傳邏輯
- **主要元素**:
  - 內部上傳隊列
  - 進度追踪器
  - 重試機制
  - 超時計時器
- **互動行為**:
  - 顯示當前上傳進度
  - 顯示距離超時的剩餘時間
  - 網絡中斷時自動暫停上傳
  - 網絡恢復時提供續傳選項
  - 超時前提醒用戶
  - 超時時顯示失敗通知
- **狀態管理**:
  - 每個檔案的上傳進度和狀態
  - 上傳開始時間和已用時間
  - 剩餘超時時間 (10分鐘倒計時)
  - 分片上傳狀態

#### 5.2.2 上傳超時通知 (UploadTimeoutNotification)
- **用途**: 顯示上傳即將超時的警告
- **主要元素**:
  - 倒計時顯示
  - 警告圖標
  - 操作建議文本
- **互動行為**:
  - 剩餘時間少於2分鐘時自動顯示
  - 提供取消或繼續選項
  - 超時後顯示上傳失敗通知
- **狀態管理**:
  - 剩餘時間
  - 顯示狀態
  - 關聯的上傳任務ID

### 5.3 檔案刪除功能

#### 5.3.1 檔案刪除確認對話框 (DeleteConfirmationDialog)
- **用途**: 確認用戶刪除檔案的意圖
- **主要元素**:
  - 警告圖標
  - 確認文本
  - 確認和取消按鈕
  - 刪除範圍說明
- **互動行為**:
  - 點擊刪除按鈕時顯示
  - 說明刪除將同時刪除資料庫記錄和MinIO中的檔案
  - 確認後執行刪除操作
  - 取消則關閉對話框
- **狀態管理**:
  - 顯示狀態
  - 目標檔案信息
  - 刪除操作狀態

#### 5.3.2 檔案刪除反饋 (DeleteFeedback)
- **用途**: 顯示檔案刪除操作的結果
- **主要元素**:
  - 成功/失敗圖標
  - 操作結果消息
  - 關閉按鈕
- **互動行為**:
  - 刪除成功後自動更新檔案列表
  - 刪除失敗顯示錯誤原因
  - 支援重試操作
- **狀態管理**:
  - 操作結果狀態
  - 錯誤信息
  - 顯示持續時間

### 5.4 互動式句子引用查看

#### 5.4.1 句子引用標籤 (SentenceReferenceTag)
- **用途**: 在聊天回答中顯示引用的句子
- **主要元素**:
  - 引用標籤
  - 文件名稱
  - 頁碼信息
  - 內容預覽
  - 在PDF中查看按鈕
- **互動行為**:
  - 懸停顯示完整引用內容
  - 點擊可直接在PDF預覽中查看
  - 提供在原文中查看上下文的選項
- **狀態管理**:
  - 引用數據
  - 懸停狀態
  - 點擊跳轉狀態

#### 5.4.2 句子上下文查看器 (SentenceContextViewer)
- **用途**: 顯示引用句子的上下文
- **主要元素**:
  - 引用句子 (高亮顯示)
  - 前後相關句子
  - 來源信息
  - PDF跳轉按鈕
- **互動行為**:
  - 從引用標籤打開
  - 顯示句子的前後文
  - 提供直接跳轉到PDF的選項
- **狀態管理**:
  - 上下文數據
  - 載入狀態
  - 目標句子位置 