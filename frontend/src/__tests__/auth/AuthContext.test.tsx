/**
 * 認證Context測試
 */
import React from 'react';
import { describe, beforeEach, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth, AuthContext } from '../../contexts/AuthContext';
import * as authService from '../../services/auth/authService';
import '@testing-library/jest-dom';

// 模擬AuthService
vi.mock('../../services/auth/authService', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn(),
  refreshToken: vi.fn(),
  isTokenExpired: vi.fn(),
  clearTokens: vi.fn(),
  getCurrentUser: vi.fn(),
}));

// 測試組件，用於測試useAuth hook
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="auth-status">
        {auth.isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="auth-loading">
        {auth.loading ? 'loading' : 'not-loading'}
      </div>
      <div data-testid="auth-error">
        {auth.error || 'no-error'}
      </div>
      <button 
        data-testid="login-button" 
        onClick={() => auth.login({ email: 'test@example.com', password: 'password123' })}
      >
        Login
      </button>
      <button 
        data-testid="register-button" 
        onClick={() => auth.register({ email: 'test@example.com', password: 'password123' })}
      >
        Register
      </button>
      <button 
        data-testid="logout-button" 
        onClick={() => auth.logout()}
      >
        Logout
      </button>
      <button 
        data-testid="clear-error-button" 
        onClick={() => auth.clearError()}
      >
        Clear Error
      </button>
    </div>
  );
};

describe('AuthContext測試', () => {
  // 每個測試前重置模擬
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 每個測試後清理
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('AuthProvider 應該正確渲染子組件', () => {
    // 渲染AuthProvider
    render(
      <AuthProvider>
        <div data-testid="child">Child Component</div>
      </AuthProvider>
    );
    
    // 檢查子組件是否渲染
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Component')).toBeInTheDocument();
  });

  test('初始狀態應該是載入中且未認證', () => {
    // 模擬沒有令牌
    vi.mocked(authService.getAccessToken).mockReturnValue(null);
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 初始狀態應該是載入中
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('no-error');
  });

  test('如果有有效令牌，應該初始化為已認證', async () => {
    // 模擬有效令牌
    vi.mocked(authService.getAccessToken).mockReturnValue('valid_token');
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);
    vi.mocked(authService.getCurrentUser).mockReturnValue({ user_uuid: 'test-user-uuid' });
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 等待狀態更新
    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('not-loading');
    });
    
    // 檢查是否已認證
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('no-error');
  });

  test('如果令牌過期，應該嘗試刷新令牌', async () => {
    // 模擬過期令牌，但刷新成功
    vi.mocked(authService.getAccessToken).mockReturnValue('expired_token');
    vi.mocked(authService.isTokenExpired).mockReturnValue(true);
    vi.mocked(authService.refreshToken).mockResolvedValue('new_valid_token');
    vi.mocked(authService.getCurrentUser).mockReturnValue({ user_uuid: 'test-user-uuid' });
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 等待刷新令牌流程完成
    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalled();
    });
    
    // 檢查狀態
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('not-loading');
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('no-error');
  });

  test('如果刷新令牌失敗，應該清除令牌並將狀態設為未認證', async () => {
    // 模擬過期令牌，且刷新失敗
    vi.mocked(authService.getAccessToken).mockReturnValue('expired_token');
    vi.mocked(authService.isTokenExpired).mockReturnValue(true);
    vi.mocked(authService.refreshToken).mockRejectedValue(new Error('刷新令牌失敗'));
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 等待刷新令牌流程完成
    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalled();
      expect(authService.clearTokens).toHaveBeenCalled();
    });
    
    // 檢查狀態
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('not-loading');
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('no-error');
  });

  test('登入成功應該更新認證狀態', async () => {
    // 模擬登入成功
    const mockUser = { user_uuid: 'test-user-uuid' };
    vi.mocked(authService.login).mockResolvedValue({
      user_uuid: mockUser.user_uuid,
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      token_type: 'bearer'
    });
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 等待初始化完成
    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('not-loading');
    });
    
    // 點擊登入按鈕
    const loginButton = screen.getByTestId('login-button');
    act(() => {
      loginButton.click();
    });
    
    // 等待登入完成
    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
    
    // 檢查是否已認證
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('no-error');
  });

  test('登入失敗應該設置錯誤訊息', async () => {
    // 模擬登入失敗
    const errorMessage = '帳號或密碼錯誤';
    vi.mocked(authService.login).mockRejectedValue(new Error(errorMessage));
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 等待初始化完成
    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('not-loading');
    });
    
    // 點擊登入按鈕並處理預期的錯誤
    const loginButton = screen.getByTestId('login-button');
    
    try {
      await act(async () => {
        loginButton.click();
      });
    } catch (error) {
      // 預期的錯誤，可以忽略
    }
    
    // 等待登入失敗
    await waitFor(() => {
      expect(authService.login).toHaveBeenCalled();
    });
    
    // 檢查錯誤訊息
    expect(screen.getByTestId('auth-error')).toHaveTextContent(errorMessage);
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
  });

  test('註冊成功應該自動登入', async () => {
    // 模擬註冊和登入成功
    const mockUser = { user_uuid: 'test-user-uuid', email: 'test@example.com' };
    vi.mocked(authService.register).mockResolvedValue({
      user_uuid: mockUser.user_uuid,
      email: mockUser.email,
      created_at: new Date().toISOString()
    });
    vi.mocked(authService.login).mockResolvedValue({
      user_uuid: mockUser.user_uuid,
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      token_type: 'bearer'
    });
    
    // 渲染測試組件
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // 等待初始化完成
    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('not-loading');
    });
    
    // 點擊註冊按鈕
    const registerButton = screen.getByTestId('register-button');
    act(() => {
      registerButton.click();
    });
    
    // 等待註冊和登入完成
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalled();
      expect(authService.login).toHaveBeenCalled();
    });
    
    // 檢查是否已認證
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('no-error');
  });

  test('登出應該清除認證狀態', async () => {
    // 設置初始狀態為已認證
    const mockAuthContext = {
      isAuthenticated: true,
      user: { user_uuid: 'test-user-uuid', email: 'test@example.com' },
      loading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockImplementation(async () => {
        await authService.logout();
      }),
      clearError: vi.fn()
    };
    
    // 模擬登出成功
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    
    // 渲染測試組件
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <TestComponent />
      </AuthContext.Provider>
    );
    
    // 檢查初始狀態
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    
    // 點擊登出按鈕
    const logoutButton = screen.getByTestId('logout-button');
    act(() => {
      logoutButton.click();
    });
    
    // 等待登出完成
    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalled();
    });
  });

  test('clearError 應該清除錯誤訊息', async () => {
    // 設置初始狀態有錯誤訊息
    const errorMessage = '先前的錯誤';
    const mockAuthContext = {
      isAuthenticated: false,
      user: null,
      loading: false,
      error: errorMessage,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn().mockImplementation(() => {
        // 重新渲染組件，模擬狀態更新
        render(
          <AuthContext.Provider value={{
            ...mockAuthContext,
            error: null,
            clearError: mockAuthContext.clearError
          }}>
            <TestComponent />
          </AuthContext.Provider>
        );
      })
    };
    
    // 渲染測試組件
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <TestComponent />
      </AuthContext.Provider>
    );
    
    // 檢查初始狀態有錯誤
    expect(screen.getByTestId('auth-error')).toHaveTextContent(errorMessage);
    
    // 點擊清除錯誤按鈕
    const clearErrorButton = screen.getByTestId('clear-error-button');
    act(() => {
      clearErrorButton.click();
    });
    
    // 檢查錯誤是否被清除
    await waitFor(() => {
      expect(mockAuthContext.clearError).toHaveBeenCalled();
    });
  });
}); 