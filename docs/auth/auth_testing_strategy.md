# 用戶認證與授權測試策略

本文檔描述了針對前端認證與授權功能的測試策略。測試包括單元測試、集成測試和安全測試，以確保系統的驗證和授權機制正確可靠。

## 1. 測試範圍

測試涵蓋以下功能：

### 1.1 表單驗證

- 登入表單驗證
- 註冊表單驗證
- 密碼強度驗證
- 表單錯誤處理和顯示

### 1.2 認證流程

- 用戶登入
- 用戶註冊
- 錯誤處理和顯示
- 載入狀態顯示

### 1.3 令牌管理

- JWT令牌儲存
- 令牌過期檢查
- 令牌刷新
- 令牌安全性

### 1.4 路由保護

- 私有路由重定向
- 認證狀態檢查
- 路由導航

## 2. 測試策略

### 2.1 單元測試

#### 2.1.1 認證服務測試

使用Vitest測試認證服務（`authService.ts`）的各項功能：

- 令牌儲存和獲取
- 令牌過期檢查
- 登入功能
- 註冊功能
- 刷新令牌功能
- 登出功能
- 獲取當前用戶資訊

**測試檔案**：`src/__tests__/auth/authService.test.ts`

#### 2.1.2 登入和註冊表單測試

測試登入和註冊表單組件的功能：

- 表單渲染
- 表單驗證
- 錯誤提示
- 提交功能
- 載入狀態
- 密碼顯示切換

**測試檔案**：
- `src/__tests__/auth/LoginForm.test.tsx`
- `src/__tests__/auth/RegisterForm.test.tsx`

### 2.2 集成測試

#### 2.2.1 認證Context測試

測試認證Context的功能和狀態管理：

- 初始狀態
- 登入流程
- 註冊流程
- 登出流程
- 令牌刷新流程
- 錯誤狀態管理

**測試檔案**：`src/__tests__/auth/AuthContext.test.tsx`

#### 2.2.2 路由保護測試

測試PrivateRoute組件的功能：

- 未認證時的重定向
- 認證時的顯示
- 載入中的顯示

**測試檔案**：`src/__tests__/auth/PrivateRoute.test.tsx`

#### 2.2.3 令牌刷新機制測試

在axios攔截器中測試令牌刷新機制：

- 令牌過期時自動刷新
- 刷新成功後重試原請求
- 刷新失敗時重定向到登入頁面

**測試檔案**：`src/__tests__/auth/axiosInstance.test.ts`

### 2.3 安全測試

#### 2.3.1 XSS防護測試

確保應用程式防範XSS攻擊：

- 測試在表單輸入中注入腳本
- 確保表單數據經過適當轉義

#### 2.3.2 CSRF防護測試

測試CSRF防護措施：

- 確保敏感操作使用了適當的CSRF保護機制

#### 2.3.3 令牌儲存安全性測試

測試令牌儲存的安全性：

- 確保令牌只儲存在合適的地方（localStorage適用於開發環境，生產環境考慮使用HttpOnly cookies）
- 確保令牌包含適當的過期時間
- 測試登出時令牌的清除

## 3. 測試環境設置

### 3.1 模擬設置

使用vitest的模擬功能模擬：

- `localStorage` 操作
- `fetch` API 請求
- `jwt-decode` 函數

```typescript
// localStorage 模擬
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// fetch API 模擬
global.fetch = vi.fn();

// jwt-decode 模擬
vi.mock('jwt-decode', () => ({
  default: vi.fn()
}));
```

### 3.2 AuthContext 模擬

為測試組件提供模擬的AuthContext：

```typescript
const mockAuthContext = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn()
};

render(
  <AuthContext.Provider value={mockAuthContext}>
    <ComponentToTest />
  </AuthContext.Provider>
);
```

### 3.3 路由模擬

使用React Router的MemoryRouter模擬路由：

```typescript
render(
  <MemoryRouter initialEntries={['/protected']}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/protected" 
        element={
          <PrivateRoute>
            <ProtectedPage />
          </PrivateRoute>
        } 
      />
    </Routes>
  </MemoryRouter>
);
```

## 4. 覆蓋範圍目標

測試覆蓋率目標：

- 程式碼覆蓋率 > 85%
- 分支覆蓋率 > 80%
- 函數覆蓋率 > 90%

特別關注的測試案例：

- 錯誤情況處理
- 邊界情況（如令牌剛好過期）
- 安全漏洞

## 5. 持續集成

在CI/CD流程中集成測試：

1. 在Pull Request時運行所有測試
2. 設置測試覆蓋率門檻
3. 在部署前執行所有測試

## 6. 最佳實踐

- 使用AAA測試模式（Arrange-Act-Assert）
- 每個測試只測試一個行為
- 使用有意義的測試和變數名稱
- 在測試中提供足夠的上下文，以便於理解測試的目的
- 模擬外部依賴，以便於測試
- 使用實際的DOM渲染測試，而非淺渲染
- 避免測試實現細節，專注於測試公共API

## 7. 注意事項

- 確保測試環境與生產環境盡可能接近
- 避免測試中的代碼重複
- 定期審查和更新測試
- 遇到問題先寫測試，再修復 