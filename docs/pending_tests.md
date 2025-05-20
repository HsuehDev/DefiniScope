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

## 聊天界面測試待辦事項

以下是目前無法完成但必須進行測試的聊天界面相關功能項目，記錄測試過程中發現的問題和待解決事項。

### 中文輸入法相關測試

1. **多種輸入法組合測試**
   - 問題：目前僅使用基本Event模擬了輸入法事件，無法全面測試各種輸入法
   - 原因：不同輸入法（如注音、倉頡、拼音等）在組合過程中的事件序列和行為有差異
   - 解決方向：
     - 使用真實瀏覽器環境中的各種輸入法進行手動測試
     - 設計更精確的事件序列模擬不同輸入法的行為

2. **長時間輸入法組合狀態測試**
   - 問題：無法測試長時間保持在輸入法組合狀態下的行為
   - 原因：測試環境難以精確模擬持續的組合狀態
   - 解決方向：
     - 開發專用的測試工具來模擬長時間組合狀態
     - 在真實環境中進行長時間組合狀態的手動測試

3. **輸入法狀態切換的視覺反饋測試**
   - 問題：難以透過自動化測試驗證輸入法狀態的視覺反饋是否正確
   - 原因：CSS樣式變化和細微的視覺提示難以用標準測試覆蓋
   - 解決方向：
     - 添加視覺回歸測試
     - 針對特定樣式類的存在和改變編寫專門測試

### 消息渲染與顯示測試

1. **非常長消息的渲染性能測試**
   - 問題：無法有效測試超長消息（數千字）的渲染性能
   - 原因：測試環境中難以模擬實際渲染性能，也難以自動化驗證滾動性能
   - 解決方向：
     - 設計專用的性能測試套件
     - 使用真實瀏覽器性能工具測量渲染時間

2. **多種消息格式混合顯示測試**
   - 問題：無法全面測試包含代碼塊、表格、數學公式等複雜格式的消息渲染
   - 原因：測試數據中缺乏覆蓋所有格式類型的範例
   - 解決方向：
     - 建立覆蓋所有支持格式的測試數據集
     - 為每種消息格式編寫專門的測試用例

3. **消息引用嵌套和交互測試**
   - 問題：無法完全測試深層嵌套引用的顯示和交互
   - 原因：當前測試中的引用模型過於簡單
   - 解決方向：
     - 設計更複雜的引用數據結構進行測試
     - 開發專用測試工具模擬多層引用交互

### 端到端測試挑戰

1. **真實網絡條件下的端到端測試**
   - 問題：無法測試不穩定網絡條件下的聊天體驗
   - 原因：測試環境中網絡條件穩定，難以模擬真實世界的網絡波動
   - 解決方向：
     - 使用網絡模擬工具如Chrome DevTools的網絡調節功能
     - 設置專用的網絡限流環境進行測試

2. **長時間聊天會話的穩定性測試**
   - 問題：無法測試長時間聊天（數小時）過程中的內存使用和穩定性
   - 原因：自動化測試通常運行時間短，難以發現長時間使用問題
   - 解決方向：
     - 開發專用的長時間運行測試
     - 設置定期的手動長時間測試流程

3. **大量歷史消息載入的性能測試**
   - 問題：當載入包含大量歷史消息的對話時，無法測試其性能和滾動行為
   - 原因：測試數據集較小，無法覆蓋大規模歷史消息場景
   - 解決方向：
     - 生成包含大量消息的測試數據
     - 實現專門的性能監測測試

## 後續改進計劃

1. 擴展輸入法測試覆蓋範圍，模擬更多中文輸入法行為
2. 建立視覺回歸測試系統，確保UI樣式和行為一致性
3. 實現長時間運行的穩定性測試流程
4. 開發專用測試工具，模擬更複雜的用戶輸入和網絡條件
5. 擴充測試數據集，覆蓋更多邊緣情況和格式類型

# Redis 相關功能測試問題

## 認證模塊中的 Redis 測試問題

在測試安全模塊中的 Redis 相關功能時，發現以下問題需要解決：

### 1. Redis 客戶端管理測試問題

**問題描述：**
`security.py` 模塊中的 Redis 相關測試失敗，特別是與 Redis 客戶端管理相關的以下測試：
- `test_get_redis_client_successful_connection`
- `test_get_redis_client_connection_error`
- `test_get_redis_client_singleton`

**原因：**
1. `get_redis_client` 函數的單例模式實現與測試預期不匹配
2. 模擬對象的路徑可能不正確，導致無法正確覆蓋實際函數
3. 模擬 Redis 連接池和客戶端的方式可能與實際代碼不符

**解決方向：**
1. 修正測試中的模擬路徑，確保正確模擬 `redis.ConnectionPool` 和 `redis.Redis`：
   ```python
   @patch("app.core.security.redis.ConnectionPool")  # 注意路徑是否正確
   @patch("app.core.security.redis.Redis")
   def test_get_redis_client(self, mock_redis, mock_pool):
       # 測試邏輯
   ```

2. 考慮重構 `get_redis_client` 函數，使其更容易測試：
   ```python
   def get_redis_client():
       global redis_client
       if not redis_client:
           with redis_client_lock:
               if not redis_client:
                   # 創建客戶端...
       return redis_client
   ```

3. 添加重置 Redis 客戶端的輔助函數，便於測試時重置單例：
   ```python
   def _reset_redis_client_for_testing():
       global redis_client, redis_pool
       redis_client = None
       redis_pool = None
   ```

### 2. 登入嘗試限制測試問題

**問題描述：**
`test_check_login_attempts_at_limit` 測試失敗，未能觸發預期的 HTTPException。

**原因：**
1. 模擬的 Redis 客戶端可能無法正確返回登入嘗試次數
2. 測試中的條件設置可能與 `check_login_attempts` 函數的實際判斷條件不一致
3. 測試中的 TTL 返回值可能未符合觸發異常的條件

**解決方向：**
1. 確保 `settings.MAX_LOGIN_ATTEMPTS` 設置正確且與測試一致
2. 仔細檢查 `check_login_attempts` 函數中的條件邏輯
3. 修正模擬 Redis 客戶端的行為，確保 `get` 和 `ttl` 方法返回一致的值：
   ```python
   # 模擬設置
   mock_redis.get.return_value = str(settings.MAX_LOGIN_ATTEMPTS)
   mock_redis.ttl.return_value = 300  # 確保為正數
   
   # 確認 check_login_attempts 函數內的判斷邏輯
   if attempts >= settings.MAX_LOGIN_ATTEMPTS and ttl > 0:
       # 應該拋出異常
   ```

### 3. Redis 依賴問題解決方案

由於 Redis 相關功能在測試環境中難以模擬，可考慮以下整體解決方案：

1. **創建可替換的 Redis 客戶端接口**：
   ```python
   class RedisClientInterface:
       def get(self, key):
           pass
       
       def set(self, key, value, ex=None, nx=None):
           pass
       
       # 其他方法...
   
   class RealRedisClient(RedisClientInterface):
       # 實際實現...
   
   class MockRedisClient(RedisClientInterface):
       # 測試用實現...
   ```

2. **使用依賴注入模式**，便於測試時替換：
   ```python
   def get_redis_client_factory():
       """工廠函數，便於測試時替換"""
       return get_redis_client
   
   # 在需要 Redis 的函數中使用
   async def check_login_attempts(
       email: str,
       get_client=Depends(get_redis_client_factory)
   ) -> None:
       redis_client = get_client()
       # 使用 redis_client...
   ```

3. **考慮使用內存 Redis 模擬**，專門用於測試：
   ```python
   # 測試配置中
   app.dependency_overrides[get_redis_client_factory] = lambda: lambda: MockRedisClient()
   ```

# 進度顯示組件測試待解決問題

本文檔記錄了進度顯示組件測試過程中遇到的問題及其解決方向。

## 1. 測試環境配置問題 ✓

- **問題**: 項目中存在 Jest 和 Vitest 兩種測試框架混用的情況，導致使用 `npm test` 命令會使用 Jest 運行測試，但測試代碼是用 Vitest 編寫的。
- **解決方向**: 確保使用 `npx vitest run` 或 `npm run test:vitest` 命令運行測試，或者統一測試框架，移除不必要的依賴。
- **解決狀態**: ✓ 已解決，使用 `npx vitest --run` 命令運行測試

## 2. ProgressDisplay.test.tsx 問題 ✓

- **問題**: 進度條元素選擇器失敗，`container.querySelector('[class*="ProgressBarFill"]')` 返回 null。
- **解決方向**: 
  1. 在組件中添加 `data-testid` 屬性以便測試選擇
  2. 修改測試代碼，使用 Testing Library 推薦的查詢方法而非直接訪問 DOM
- **解決狀態**: ✓ 已解決
  - 為 ProgressDisplay 組件添加了 `data-testid` 屬性
  - 修改了測試，使用 `getByTestId` 和 `toHaveStyle` 替代直接訪問 DOM
  - 將四捨五入測試拆分為兩個單獨的測試，避免同時渲染兩個組件造成的元素重複問題

## 3. SentencePreview.test.tsx 問題 ✓

- **問題 1**: 長句子截斷測試失敗，期望顯示的文本長度小於原始文本，但實際上相等。
- **解決方向**: 修改測試用例，確保測試數據足夠長以觸發截斷邏輯。
- **解決狀態**: ✓ 已解決，使用 `repeat` 方法創建了足夠長的句子字符串

- **問題 2**: 自定義 CSS 類測試失敗，`closest('div')` 找到的元素沒有預期的類名。
- **解決方向**: 使用 `data-testid` 屬性標記元素，並使用 `getByTestId` 方法查找，避免依賴 DOM 結構。
- **解決狀態**: ✓ 已解決，添加了 `data-testid="sentence-card"` 屬性

## 4. DetailPanel.test.tsx 問題 ⚠️

- **問題 1**: 搜尋結果測試失敗，無法找到文本 "關鍵詞: 自適應專業知識 (1 個相關句子)"。
- **解決方向**: 檢查實際渲染的 DOM 結構，可能需要調整測試匹配方式，使用 `getByText` 的正則表達式模式或使用 `getAllByText` 搭配過濾。
- **解決狀態**: ⚠️ 待解決

- **問題 2**: 類型錯誤，`searchResults` 的類型與 `DefiningType` 不匹配。
- **解決方向**: 
  ```tsx
  import { DefiningType } from '../../../types/progress';
  
  // 修正測試數據
  const searchResults: Record<string, ReferencedSentence[]> = {
    '自適應專業知識': [
      {
        sentence_uuid: 'search-1',
        file_uuid: 'file-1',
        original_name: 'document1.pdf',
        sentence: '自適應專業知識指的是...',
        page: 15,
        defining_type: 'cd' as DefiningType,  // 明確指定類型
        relevance_score: 0.95
      }
    ],
    // ...
  };
  ```
- **解決狀態**: ⚠️ 待解決

## 5. WebSocketIntegration.test.tsx 問題 ⚠️

- **問題 1**: `waitFor` 內有多個斷言，導致測試失敗時難以定位問題。
- **解決方向**: 將每個斷言分開使用 `waitFor` 包裝。
- **解決狀態**: ⚠️ 待解決

- **問題 2**: 文本匹配失敗，實際渲染的文本與測試預期不符。
- **解決方向**: 檢查實際渲染的 DOM 結構，調整測試中的文本匹配以與實際渲染相符。例如，測試中期望 "正在提取PDF文本"，但實際渲染的是 "正在提取PDF文本 (3/10)"。
- **解決狀態**: ⚠️ 待解決

## 6. 應用的改進策略

1. **添加 data-testid 屬性**: ✓
   - 已為 ProgressDisplay 和 SentencePreview 組件添加 data-testid 屬性
   - 需為 DetailPanel 組件添加 data-testid 屬性

2. **使用精確的文本匹配或模糊匹配**: ✓
   - 已在 ProgressDisplay 和 SentencePreview 測試中使用 `toHaveTextContent` 替代直接文本匹配
   - 需在 WebSocketIntegration 測試中使用模糊匹配或正則表達式匹配

3. **修正類型問題**: ⚠️
   - 需在 DetailPanel 測試中修正 `searchResults` 的類型問題

4. **測試隔離與前置條件**: ✓
   - 已將 ProgressDisplay 的四捨五入測試分成兩個獨立測試
   - 需檢查其他測試中是否有類似問題

## 7. 下一步計劃

1. 修復 DetailPanel.test.tsx 的類型錯誤和文本匹配問題
2. 修復 WebSocketIntegration.test.tsx 的 waitFor 和文本匹配問題
3. 優化測試覆蓋率
4. 添加更多邊界情況測試
