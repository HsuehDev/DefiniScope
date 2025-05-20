# 文件分析平台前端

本專案是基於React實現的文件分析平台前端部分，專注於檔案上傳功能，支援拖放上傳、分片上傳和斷點續傳功能。

## 功能特色

- 拖放上傳界面 (使用react-dropzone)
- 分片上傳 (大檔案自動分片)
- 斷點續傳 (網絡中斷可從斷點處續傳)
- 上傳進度顯示 (顯示進度、速度和剩餘時間)
- 超時監控 (10分鐘上傳超時機制)
- 上傳控制 (暫停/繼續/取消/重試)
- 錯誤處理與提示
- 自動重試機制

## 技術棧

- React 18+
- TypeScript 4+
- TailwindCSS 3+
- TanStack Query (React Query) 4+
- Axios (HTTP請求)
- React Dropzone (檔案拖放)

## 項目結構

```
src/
  ├── api/                 # API相關函數
  │   └── uploadApi.ts     # 上傳相關API
  ├── components/          # React組件
  │   └── upload/          # 上傳相關組件
  │       ├── FileUploadZone.tsx       # 檔案上傳區域
  │       ├── UploadProgressBar.tsx    # 上傳進度條
  │       └── UploadTimeoutWarning.tsx # 上傳超時警告
  ├── hooks/               # 自定義Hook
  │   └── useFileUpload.ts # 檔案上傳Hook
  ├── types/               # TypeScript類型定義
  │   └── upload.ts        # 上傳相關類型
  └── utils/               # 工具函數
      └── uploadUtils.ts   # 上傳相關工具函數
```

## 安裝與使用

1. 安裝依賴：
```bash
npm install
```

2. 啟動開發服務器：
```bash
npm start
```

3. 構建生產版本：
```bash
npm run build
```

## 組件關係與數據流

檔案上傳實現的核心是`useFileUpload` Hook，負責管理上傳狀態和邏輯。`FileUploadZone`組件整合了拖放功能和上傳界面，而`UploadProgressBar`和`UploadTimeoutWarning`組件用於顯示上傳進度和警告。

詳細的組件關係和數據流可參考：`docs/file_upload_component_architecture.md`

## 分片上傳實現

系統會根據檔案大小自動啟用分片上傳，預設分片大小為1MB。每個分片獨立上傳，支援並行上傳多個分片以提高速度。當所有分片上傳完成後，後端會自動合併這些分片。

## 斷點續傳機制

當上傳過程中發生網絡中斷或用戶主動暫停時，系統會記錄已上傳的分片。當網絡恢復或用戶繼續上傳時，系統只會上傳尚未完成的分片，避免重複上傳。

## 超時處理

為防止上傳過程無限期阻塞，系統設置了10分鐘的上傳超時限制。當上傳時間接近10分鐘時（默認在剩餘2分鐘時），系統會顯示警告，讓用戶選擇繼續等待或取消上傳。超過10分鐘後，系統會自動標記該上傳為超時狀態。

## 注意事項

1. 目前僅支援PDF檔案上傳
2. 單個檔案大小上限為10MB
3. 瀏覽器會話結束後，未完成的上傳進度不會保存 