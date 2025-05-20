/**
 * 登入表單測試
 */
import React from 'react';
import { describe, beforeEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';
import { AuthContext } from '../../contexts/AuthContext';
import '@testing-library/jest-dom';

// 模擬useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => navigateMock
  };
});

const navigateMock = vi.fn();

describe('LoginForm測試', () => {
  // 模擬AuthContext的值
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();
  
  // 默認的AuthContext值
  const defaultAuthContextValue = {
    isAuthenticated: false,
    user: null,
    loading: false,
    error: null,
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
    clearError: mockClearError
  };
  
  // 每個測試前重置模擬
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  // 渲染組件的輔助函數
  const renderLoginForm = (authContextValue = defaultAuthContextValue) => {
    return render(
      <AuthContext.Provider value={authContextValue}>
        <BrowserRouter>
          <LoginForm />
        </BrowserRouter>
      </AuthContext.Provider>
    );
  };
  
  test('應該正確渲染登入表單', () => {
    // 渲染組件
    renderLoginForm();
    
    // 檢查表單是否有預期的元素
    expect(screen.getByTestId('login-email')).toBeInTheDocument();
    expect(screen.getByTestId('login-password')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();
    expect(screen.getByText('立即註冊')).toBeInTheDocument();
  });
  
  test('如果有錯誤，應該顯示錯誤訊息', () => {
    // 模擬有錯誤的情況
    const errorMessage = '帳號或密碼錯誤';
    renderLoginForm({
      ...defaultAuthContextValue,
      error: errorMessage as any
    });
    
    // 檢查錯誤訊息是否顯示
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
  
  test('應該在提交前驗證表單', async () => {
    // 渲染組件
    renderLoginForm();
    
    // 獲取登入按鈕並點擊
    const submitButton = screen.getByTestId('login-submit');
    fireEvent.click(submitButton);
    
    // 檢查是否顯示驗證錯誤
    expect(screen.getByText('請輸入電子郵件')).toBeInTheDocument();
    expect(screen.getByText('請輸入密碼')).toBeInTheDocument();
    
    // 檢查login函數沒有被調用
    expect(mockLogin).not.toHaveBeenCalled();
  });
  
  test('應該在電子郵件格式無效時顯示錯誤', () => {
    // 渲染組件
    renderLoginForm();
    
    // 輸入無效的電子郵件
    const emailInput = screen.getByTestId('login-email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    // 檢查是否顯示驗證錯誤
    expect(screen.getByText('請輸入有效的電子郵件格式')).toBeInTheDocument();
  });
  
  test('密碼應該可以切換顯示/隱藏', () => {
    // 渲染組件
    renderLoginForm();
    
    // 獲取密碼輸入和切換按鈕
    const passwordInput = screen.getByTestId('login-password');
    const toggleButton = screen.getByText('顯示');
    
    // 默認應該是密碼類型
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // 點擊顯示按鈕
    fireEvent.click(toggleButton);
    
    // 應該變為文本類型
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByText('隱藏')).toBeInTheDocument();
    
    // 再次點擊隱藏按鈕
    fireEvent.click(screen.getByText('隱藏'));
    
    // 應該變回密碼類型
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
  
  test('提交有效表單時應該呼叫login函數並導航', async () => {
    // 模擬成功登入
    mockLogin.mockResolvedValueOnce({});
    
    // 渲染組件
    renderLoginForm();
    
    // 填寫表單
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // 提交表單
    const submitButton = screen.getByTestId('login-submit');
    fireEvent.click(submitButton);
    
    // 檢查login函數是否被正確呼叫
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
    
    // 檢查是否導航到默認路徑
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/app');
    });
  });
  
  test('提交表單前應該清除之前的錯誤', async () => {
    // 渲染組件
    renderLoginForm({
      ...defaultAuthContextValue,
      error: '先前的錯誤' as any
    });
    
    // 填寫表單
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // 提交表單
    const submitButton = screen.getByTestId('login-submit');
    fireEvent.click(submitButton);
    
    // 檢查clearError是否被呼叫
    expect(mockClearError).toHaveBeenCalled();
  });
  
  test('登入過程中應該顯示載入狀態', async () => {
    // 模擬登入過程
    mockLogin.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(resolve, 100);
    }));
    
    // 渲染組件
    renderLoginForm();
    
    // 填寫表單
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // 提交表單
    const submitButton = screen.getByTestId('login-submit');
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    // 檢查載入中的文字
    expect(screen.getByText('登入中...')).toBeInTheDocument();
    
    // 檢查按鈕是否禁用
    expect(submitButton).toBeDisabled();
    
    // 等待登入完成
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });
  
  test('登入失敗時不應該導航', async () => {
    // 模擬登入失敗
    mockLogin.mockRejectedValueOnce(new Error('登入失敗'));
    
    // 渲染組件
    renderLoginForm();
    
    // 填寫表單
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong_password' } });
    
    // 提交表單
    const submitButton = screen.getByTestId('login-submit');
    fireEvent.click(submitButton);
    
    // 檢查login函數是否被呼叫
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    
    // 檢查導航函數沒有被呼叫
    expect(navigateMock).not.toHaveBeenCalled();
  });
}); 