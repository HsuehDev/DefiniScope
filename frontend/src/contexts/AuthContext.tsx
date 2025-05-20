import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthState, User, LoginRequest, RegisterRequest } from '../types/auth';
import * as authService from '../services/auth/authService';

// 默認認證狀態
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null
};

// 定義Context類型
interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// 創建Context
export const AuthContext = createContext<AuthContextType>({
  ...initialState,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  clearError: () => {}
});

// Context Provider 組件
export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // 清除錯誤
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  // 登入
  const login = async (credentials: LoginRequest): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await authService.login(credentials);
      const userData: User = {
        user_uuid: response.user_uuid,
        email: credentials.email
      };
      setState({
        isAuthenticated: true,
        user: userData,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '登入失敗'
      }));
      throw error;
    }
  };

  // 註冊
  const register = async (data: RegisterRequest): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await authService.register(data);
      // 註冊成功後自動登入
      await login({
        email: data.email,
        password: data.password
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '註冊失敗'
      }));
      throw error;
    }
  };

  // 登出
  const logout = async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await authService.logout();
      setState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '登出失敗'
      }));
    }
  };

  // 初始化：檢查是否已經登入
  useEffect(() => {
    const initAuth = async () => {
      const token = authService.getAccessToken();
      if (!token) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // 檢查令牌是否過期
      if (authService.isTokenExpired(token)) {
        try {
          // 嘗試刷新令牌
          await authService.refreshToken();
          const userInfo = authService.getCurrentUser();
          if (userInfo) {
            setState({
              isAuthenticated: true,
              user: { ...userInfo, email: '' }, // 從令牌中無法獲取email
              loading: false,
              error: null
            });
          } else {
            throw new Error('無法獲取用戶信息');
          }
        } catch (error) {
          // 刷新失敗，清除令牌並設為未登入
          authService.clearTokens();
          setState({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: null
          });
        }
      } else {
        // 令牌有效
        const userInfo = authService.getCurrentUser();
        if (userInfo) {
          setState({
            isAuthenticated: true,
            user: { ...userInfo, email: '' },
            loading: false,
            error: null
          });
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    initAuth();
  }, []);

  // 監聽存儲變化，處理在其他標籤頁登出的情況
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' && !e.newValue && state.isAuthenticated) {
        setState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [state.isAuthenticated]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定義Hook，方便使用
export const useAuth = () => useContext(AuthContext); 