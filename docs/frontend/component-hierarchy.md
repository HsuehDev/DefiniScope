# 前端組件層次結構

## 組件層次關係

```
App
├── AuthProvider (認證狀態上下文)
├── AppRoutes (路由配置)
    ├── LoginPage
    │   └── LoginForm
    ├── RegisterPage
    │   └── RegisterForm
    ├── MainLayout (主應用布局)
    │   ├── Navbar (頂部導航)
    │   ├── Sidebar (側邊導航)
    │   └── 子路由
    │       ├── ChatPage (智能對話)
    │       │   ├── MessageList
    │       │   │   ├── UserMessage
    │       │   │   └── AssistantMessage
    │       │   ├── ChatInput
    │       │   └── ReferencePanel
    │       ├── FilesManagementPage (檔案管理)
    │       │   ├── FilesList
    │       │   └── FileUploadZone
    │       ├── UploadPage (上傳檔案)
    │       │   ├── FileUploadZone
    │       │   └── FileProcessingProgress
    │       └── SettingsPage (設定)
    └── NotFoundPage (404頁面)
```

## 主要布局組件說明

### MainLayout

`MainLayout` 是所有應用頁面的基礎布局，包含：

1. **頂部導航欄** (Navbar)
   - 應用標題
   - 主要導航連結
   - 用戶資訊和操作選單
   
2. **側邊欄** (Sidebar)
   - 主要功能模塊的導航連結
   - 可展開/折疊的側邊欄，響應式設計

3. **主內容區域**
   - React Router 的 `<Outlet />` 組件
   - 根據當前路由顯示對應的子頁面

### ThreeColumnLayout

`ThreeColumnLayout` 是適用於複雜功能頁面的特殊布局，包含：

1. **左側面板**
   - 通常用於檔案列表或導航
   - 可折疊，節省空間
   
2. **中央面板**
   - 主要內容或對話界面
   - 在小屏幕上可以占用全部寬度
   
3. **右側面板**
   - 輔助內容，如參考資訊或進度顯示
   - 可折疊，配合中央面板使用

## 組件間通信方式

1. **Props 傳遞**
   - 父組件向子組件傳遞數據和回調函數
   - 例如：`<ChatInput onSendMessage={handleSendMessage} />`

2. **Context API**
   - 全局共享狀態，避免 prop drilling
   - 主要用於認證狀態、主題設定等
   - 例如：`useAuth()` 提供全局認證狀態

3. **自定義 Hooks**
   - 封裝通用邏輯，便於多個組件復用
   - 例如：`useWebSocket()` 管理 WebSocket 連接

4. **Redux 狀態管理**
   - 用於複雜的全局狀態
   - 主要用於用戶設定、應用配置等

## 頁面組件結構

### ChatPage

智能對話頁面，用於與系統進行文本對話，包含：

1. **MessageList**: 顯示對話消息記錄
   - UserMessage: 用戶發送的消息
   - AssistantMessage: 系統回答的消息

2. **ChatInput**: 用戶輸入區
   - 發送消息
   - 顯示處理狀態

3. **ReferencePanel**: 參考資訊面板
   - 顯示系統回答中引用的文本來源
   - 提供跳轉到原始文檔的功能

### FilesManagementPage

檔案管理頁面，用於查看和管理已上傳的文件，包含：

1. **FilesList**: 已上傳文件列表
   - 顯示文件資訊
   - 提供檔案操作 (預覽、刪除)

2. **文件預覽模態框**: 檢視 PDF 內容

### UploadPage

檔案上傳頁面，用於上傳新文件，包含：

1. **FileUploadZone**: 文件上傳區域
   - 支援拖放上傳
   - 顯示上傳進度

2. **FileProcessingProgress**: 文件處理進度顯示
   - 顯示處理階段和進度
   - 處理完成通知

## 響應式設計策略

前端組件的響應式設計策略基於以下斷點：

1. **小屏幕 (< 640px)**
   - 單欄布局
   - 面板選擇器用於切換不同面板
   - 折疊側邊欄

2. **中等屏幕 (≥ 768px, < 1024px)**
   - 雙欄布局
   - 可折疊左右面板
   - 展開側邊欄顯示圖標和文字

3. **大屏幕 (≥ 1024px)**
   - 三欄布局
   - 同時顯示所有面板
   - 可調整面板寬度

## 組件通用模式

1. **容器/展示組件模式**
   - 容器組件處理邏輯和數據
   - 展示組件負責渲染 UI

2. **狀態提升**
   - 將共用狀態提升到最近的共同父組件
   - 通過 props 向下傳遞

3. **自定義 Hooks**
   - 將復雜邏輯封裝為自定義 Hooks
   - 保持組件代碼簡潔

4. **異步數據加載**
   - 使用 React Query 管理服務端數據
   - 提供加載狀態和錯誤處理 