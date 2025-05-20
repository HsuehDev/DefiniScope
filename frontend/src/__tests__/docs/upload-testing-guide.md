# 檔案上傳功能測試指南

## 概述

本指南提供了檔案上傳功能測試的詳細流程和策略，特別關注斷點續傳和超時機制的測試方法。

## 測試環境準備

1. **安裝依賴**
   ```bash
   npm install
   ```

2. **執行測試**
   ```bash
   npm run test:vitest           # 執行所有測試
   npm run test:vitest -- upload # 僅執行上傳相關測試
   ```

## 測試架構

上傳功能測試分為以下幾個層次：

1. **單元測試**：測試單個函數和組件的邏輯
2. **組件測試**：測試組件的渲染和互動
3. **整合測試**：測試多個組件的協同工作
4. **模擬 API**：使用 MSW 模擬後端 API 響應

## 測試重點

### 1. 檔案拖放與選擇

- 測試拖放區域正確渲染
- 測試檔案選擇按鈕功能
- 測試檔案類型和大小的驗證
- 測試錯誤信息顯示

### 2. 上傳進度顯示

- 測試進度條顯示
- 測試上傳速度和剩餘時間計算
- 測試不同上傳狀態的視覺反饋

### 3. 斷點續傳功能

- 測試暫停/繼續按鈕功能
- 測試暫停狀態下的 UI 變化
- 測試重新連接後的續傳功能
- 測試分片上傳和合併

### 4. 超時處理機制

- 測試超時警告顯示時機
- 測試超時警告的UI元素
- 測試用戶交互（取消或繼續上傳）
- 測試超時自動處理

## 測試案例

### 基本功能測試

1. 正確顯示拖放區域和上傳按鈕
2. 拖放有效檔案後開始上傳
3. 顯示上傳進度和速度
4. 成功完成上傳後更新 UI

### 邊界案例測試

1. 上傳無效檔案類型（非 PDF）
2. 上傳超過大小限制的檔案
3. 同時上傳多個檔案
4. 網絡中斷後重新連接

### 錯誤處理測試

1. 伺服器返回錯誤
2. 上傳中網絡異常
3. 檔案損壞或格式錯誤
4. 用戶權限不足

### 特殊情境測試

1. **斷點續傳測試**
   - 暫停上傳並檢查狀態
   - 繼續上傳並檢查恢復狀態
   - 模擬網絡中斷後自動重試

2. **超時處理測試**
   - 模擬接近超時情況
   - 檢查超時警告顯示
   - 測試取消和繼續選項
   - 模擬超時後自動取消

## 測試模擬策略

### 檔案模擬

```javascript
// 創建測試文件
const createTestFile = (name = 'test.pdf', type = 'application/pdf', size = 1024 * 1024) => {
  return new File(['test file content'], name, { type });
};
```

### Hook 模擬

```javascript
// 模擬 useFileUpload hook
vi.mock('../../../hooks/useFileUpload', () => ({
  useFileUpload: vi.fn().mockReturnValue({
    files: [],
    addFiles: vi.fn(),
    cancelUpload: vi.fn(),
    retryUpload: vi.fn(),
    pauseUpload: vi.fn(),
    resumeUpload: vi.fn(),
    pauseAllActiveUploads: vi.fn(),
    resumeAllPausedUploads: vi.fn()
  })
}));
```

### API 模擬

```javascript
// 使用 MSW 模擬後端 API
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.post('/api/upload/init', (req, res, ctx) => {
    return res(
      ctx.json({
        file_id: 'test-file-id',
        upload_id: 'test-upload-id',
        bucket: 'test-bucket',
        key: 'test-key'
      })
    );
  }),
  // 其他 API 端點模擬...
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## 常見測試問題及解決方案

1. **React 狀態更新警告**
   - 問題：測試中觸發狀態更新但沒有包裝在 act() 中
   - 解決：使用 act() 包裝觸發狀態更新的事件

2. **測試 ID 不匹配**
   - 問題：測試中查找的 data-testid 與組件實際使用的不一致
   - 解決：檢查組件源碼中的 data-testid 並更新測試

3. **事件模擬問題**
   - 問題：事件（如拖放、點擊）沒有正確觸發或被捕獲
   - 解決：使用 fireEvent 或 userEvent 正確模擬事件

4. **異步測試超時**
   - 問題：等待異步操作完成時測試超時
   - 解決：使用 waitFor 和適當的超時設置

## 測試最佳實踐

1. 使用資料屬性 (data-testid) 而非 CSS 選擇器或文本內容進行元素選擇
2. 隔離測試環境，每個測試用例前重置模擬
3. 測試實際用戶行為而非實現細節
4. 為每個重要功能編寫獨立的測試案例
5. 使用 act() 包裝所有會導致 React 狀態更新的操作
6. 模擬最小必要的外部依賴 