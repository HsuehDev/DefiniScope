# WebSocket即時通訊測試待辦事項

以下是目前無法完成但必須進行測試的WebSocket相關功能項目，記錄測試過程中發現的問題和待解決事項。

## 核心功能單元測試

### useWebSocket Hook

1. **自動重連機制測試**
   - 問題：在測試環境中難以模擬網絡斷線和不穩定連接
   - 原因：Jest/Vitest timer模擬與真實網絡事件的交互不夠精確
   - 解決方向：擴展MockWebSocket以支持模擬不同網絡條件

2. **長時間連接穩定性測試**
   - 問題：無法在單元測試中進行長時間連接測試
   - 解決方向：考慮實現模擬時間快進或建立專用的長時間運行測試環境

3. **並發連接處理測試**
   - 問題：當同時開啟多個WebSocket連接時的行為測試
   - 解決方向：擴展測試框架支持多連接情境測試

### useFileProcessing Hook

1. **完整事件序列測試**
   - 問題：難以在單一測試中模擬完整的檔案處理流程
   - 解決方向：實現事件序列播放機制，按時間順序模擬多個事件

2. **服務端延遲回應測試**
   - 問題：輪詢模式下，服務端延遲回應的情境測試不完整
   - 解決方向：增強MSW模擬以支持延遲和不穩定回應

3. **大量數據處理測試**
   - 問題：無法模擬大量句子數據的處理性能
   - 解決方向：生成合適的大量測試數據並測量處理效率

### useQueryProcessing Hook

1. **複雜事件序列測試**
   - 問題：查詢處理中多關鍵詞搜尋結果的累積與合併測試
   - 解決方向：開發更複雜的事件序列生成器

2. **事件排序容錯測試**
   - 問題：當WebSocket事件到達順序不一致時的處理
   - 解決方向：模擬亂序事件序列並驗證hook的處理邏輯

3. **會話恢復與狀態持久化測試**
   - 問題：在連接中斷後恢復進度的功能未充分測試
   - 解決方向：模擬瀏覽器重載並測試狀態恢復機制

## UI組件與集成測試

1. **ProcessingIndicator組件測試**
   - 問題：難以確保進度指示器正確反映WebSocket事件狀態
   - 解決方向：實現更嚴謹的組件與WebSocket事件交互測試

2. **連接狀態可視化組件測試**
   - 問題：連接狀態指示器的CSS轉換與動畫難以驗證
   - 解決方向：開發視覺回歸測試或使用更專業的UI測試工具

3. **WebSocket狀態與路由變化測試**
   - 問題：頁面導航時WebSocket連接的維護與清理
   - 解決方向：設計涵蓋多頁面導航的測試用例

## 邊緣情況測試

1. **網絡切換處理測試**
   - 問題：在線/離線狀態變化時的行為測試
   - 解決方向：模擬navigator.onLine狀態變化並測試相應處理

2. **同時使用多個WebSocket Hook測試**
   - 問題：同一頁面多個WebSocket hook的資源共享與衝突
   - 解決方向：設計多hook交互測試環境

3. **極端網絡條件測試**
   - 問題：極低帶寬和高延遲環境下的表現測試
   - 解決方向：使用網絡調節工具進行模擬或設置特定測試環境

## 性能與負載測試

1. **WebSocket連接數限制測試**
   - 問題：瀏覽器對同一域名的連接數限制對應用的影響
   - 解決方向：實現連接池和資源共享機制的負載測試

2. **大量快速消息處理測試**
   - 問題：短時間內大量消息的處理效率和UI響應測試
   - 解決方向：開發高頻率消息生成器並測量系統響應

3. **降級策略性能對比測試**
   - 問題：不同網絡條件下WebSocket和輪詢模式的性能對比
   - 解決方向：建立性能基準測試框架

## 整合測試與真實環境測試

1. **前後端協議一致性測試**
   - 問題：確保前端模型與後端API的事件類型和格式完全一致
   - 解決方向：自動化比較TypeScript類型與後端Schema定義

2. **真實瀏覽器環境中的WebSocket測試**
   - 問題：不同瀏覽器實現的細微差異可能導致問題
   - 解決方向：使用Playwright或Cypress在真實瀏覽器中進行測試

3. **跨網絡環境測試**
   - 問題：不同網絡配置下的表現未完全測試
   - 解決方向：設置VPN或代理模擬不同網絡環境

## 下一步計劃

1. 擴展MockWebSocket實現以支持更複雜的網絡情境模擬
2. 開發事件序列生成器用於複雜流程測試
3. 建立真實瀏覽器環境的自動化測試流程
4. 實現性能測試框架以比較不同通訊策略的效率

# 待完成測試事項清單

本文件記錄了目前無法完成但必須測試的項目，以及測試過程中遇到的問題和解決方向。這些測試項目被認為是重要的，但由於各種原因暫時無法實現。

## 檔案管理測試

### 1. 檔案刪除功能的完整測試

**問題描述：**
目前無法完全測試檔案刪除功能，特別是在下列情況：
- 無法準確識別刪除按鈕和確認對話框
- 缺乏測試刪除過程中的樂觀更新機制
- 缺乏測試刪除失敗後的錯誤處理和回滾機制

**原因：**
1. 刪除按鈕缺少明確的測試標識符（如 `data-testid="delete-button"`）
2. 實際 UI 元素的實現與測試期望不匹配
3. 複雜的非同步操作和狀態管理難以在測試中模擬

**解決方向：**
1. 為相關組件添加 `data-testid` 屬性，特別是：
   ```jsx
   <button data-testid="delete-button" title="刪除檔案">...</button>
   <button data-testid="confirm-delete-button">確認刪除</button>
   <button data-testid="cancel-delete-button">取消</button>
   ```

2. 增強 mock 實現以更好地模擬 React Query 的行為，特別是 optimistic updates：
   ```tsx
   const deleteFileMock = vi.fn().mockImplementation((fileId) => {
     // 返回一個函數，允許測試控制解析/拒絕時間
     return new Promise((resolve, reject) => {
       window.resolveDelete = resolve;
       window.rejectDelete = reject;
     });
   });
   ```

3. 擴展測試覆蓋範圍，包括：
   - 使用者取消刪除的情況
   - 網路錯誤導致刪除失敗的情況
   - 伺服器拒絕刪除請求的情況
   - 樂觀更新期間的 UI 反饋

### 2. 檔案列表排序功能測試

**問題描述：**
無法測試檔案列表的排序功能，測試期望找到排序下拉選單但實際 UI 中不存在。

**原因：**
1. 排序功能尚未實現或實現方式與測試預期不同
2. 測試中尋找的 `getByLabelText('排序方式')` 和 `getByLabelText('排序方向')` 元素不存在

**解決方向：**
1. 實現排序 UI 界面：
   ```jsx
   <label htmlFor="sort-by">排序方式</label>
   <select id="sort-by" aria-label="排序方式">
     <option value="created_at">上傳日期</option>
     <option value="original_name">檔案名稱</option>
   </select>
   
   <label htmlFor="sort-order">排序方向</label>
   <select id="sort-order" aria-label="排序方向">
     <option value="desc">降序</option>
     <option value="asc">升序</option>
   </select>
   ```

2. 或者調整測試以匹配實際實現：
   ```tsx
   // 如果排序是通過按鈕而非下拉選單實現
   test('應支援按檔案名稱排序', () => {
     renderComponent();
     const sortByNameButton = screen.getByTitle('按檔案名稱排序');
     fireEvent.click(sortByNameButton);
     // 測試排序結果
   });
   ```

## TypeScript 類型問題

### 1. React Query 模擬返回值類型不匹配

**問題描述：**
模擬 React Query 的 `useFilesList` 和 `useDeleteFile` 時出現 TypeScript 類型錯誤，提示缺少某些屬性。

**原因：**
React Query 的 hook 返回的對象包含許多屬性，但我們的模擬只提供了測試所需的幾個屬性。

**解決方向：**
1. 使用 Partial 類型來避免類型錯誤：
   ```tsx
   const mockUseFilesList = vi.fn().mockReturnValue({
     isLoading: false,
     isError: false,
     data: { ... },
     error: null,
     refetch: vi.fn(),
   } as Partial<UseQueryResult<FileListResponse, unknown>>);
   ```

2. 完整實現 React Query 返回的類型結構：
   ```tsx
   const mockUseFilesList = vi.fn().mockReturnValue({
     isLoading: false,
     isError: false,
     isSuccess: true,
     isIdle: false,
     status: 'success',
     data: { ... },
     error: null,
     refetch: vi.fn(),
     remove: vi.fn(),
     fetchStatus: 'idle',
     // ... 其他需要的屬性
   } as UseQueryResult<FileListResponse, unknown>);
   ```

### 2. toBeInTheDocument 斷言類型錯誤

**問題描述：**
測試中使用 `toBeInTheDocument()` 斷言時出現 TypeScript 錯誤，提示該方法不存在。

**原因：**
雖然已經創建了 `testing.d.ts` 文件來擴展 Vitest 的斷言類型，但 TypeScript 編譯器可能未正確處理這些聲明。

**解決方向：**
1. 確保 `testing.d.ts` 文件在 `tsconfig.json` 的 `include` 路徑中：
   ```json
   {
     "include": [
       "src/**/*.ts",
       "src/**/*.tsx",
       "src/**/*.d.ts"
     ]
   }
   ```

2. 確保在測試文件頂部引入：
   ```tsx
   import '@testing-library/jest-dom';
   ```

## 其他待處理測試事項

### 1. 文件上傳過程的測試

建議實現以下測試：
- 文件選擇和驗證
- 上傳進度顯示
- 上傳錯誤處理
- 大文件上傳的性能測試

### 2. 文件處理狀態的測試

建議實現以下測試：
- 處理進度顯示
- 處理錯誤的視覺反饋
- 處理完成後的狀態更新

### 3. 端到端測試

使用 Playwright 實現完整的端到端測試，涵蓋：
- 文件上傳、處理、列表和刪除的完整流程
- 不同網路條件下的表現
- 多文件同時操作的情況

## 後續行動項目

1. 為所有 UI 元素添加適當的 `data-testid` 屬性，便於測試識別
2. 改進 mock 實現，更準確模擬實際 API 行為
3. 擴展測試覆蓋範圍，包括錯誤情況和邊界條件
4. 解決 TypeScript 類型警告
5. 實現端到端測試套件 