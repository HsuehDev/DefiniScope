/**
 * 受保護路由測試
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from '../../components/auth/PrivateRoute';
import { AuthContext } from '../../contexts/AuthContext';
import '@testing-library/jest-dom';

// 模擬useLocation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useLocation: () => ({ pathname: '/protected' })
  };
});

describe('PrivateRoute測試', () => {
  // 模擬AuthContext值
  const defaultAuthContextValue = {
    isAuthenticated: false,
    user: null,
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn()
  };

  // 每個測試前重置模擬
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 測試組件 - 公開頁面
  const PublicPage = () => <div data-testid="public-page">公開頁面</div>;
  
  // 測試組件 - 受保護頁面
  const ProtectedPage = () => <div data-testid="protected-page">受保護頁面</div>;

  // 渲染路由的輔助函數
  const renderWithRouter = (authContextValue = defaultAuthContextValue) => {
    return render(
      <AuthContext.Provider value={authContextValue}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<PublicPage />} />
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
      </AuthContext.Provider>
    );
  };

  test('如果認證狀態載入中，應該顯示載入指示器', () => {
    // 模擬載入中的狀態
    renderWithRouter({
      ...defaultAuthContextValue,
      loading: true
    });
    
    // 檢查是否顯示載入指示器（在PrivateRoute中，載入指示器是一個div，包含animate-spin類名）
    const loadingElement = document.querySelector('.animate-spin');
    expect(loadingElement).toBeTruthy();
    
    // 檢查受保護頁面和公開頁面都沒有顯示
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-page')).not.toBeInTheDocument();
  });

  test('如果用戶未認證，應該重定向到登入頁面', () => {
    // 模擬未認證的狀態
    renderWithRouter();
    
    // 檢查是否顯示登入頁面
    expect(screen.getByTestId('public-page')).toBeInTheDocument();
    
    // 檢查受保護頁面沒有顯示
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  test('如果用戶已認證，應該顯示受保護頁面', () => {
    // 模擬已認證的狀態
    renderWithRouter({
      ...defaultAuthContextValue,
      isAuthenticated: true
    });
    
    // 檢查受保護頁面是否顯示
    expect(screen.getByTestId('protected-page')).toBeInTheDocument();
    
    // 檢查登入頁面沒有顯示
    expect(screen.queryByTestId('public-page')).not.toBeInTheDocument();
  });

  test('應該可以自定義重定向路徑', () => {
    // 使用自定義的渲染函數來測試自定義重定向路徑
    render(
      <AuthContext.Provider value={defaultAuthContextValue}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/custom-login" element={<div data-testid="custom-login">自定義登入頁面</div>} />
            <Route 
              path="/protected" 
              element={
                <PrivateRoute redirectTo="/custom-login">
                  <ProtectedPage />
                </PrivateRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
    
    // 檢查是否顯示自定義登入頁面
    expect(screen.getByTestId('custom-login')).toBeInTheDocument();
    
    // 檢查受保護頁面沒有顯示
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });
}); 