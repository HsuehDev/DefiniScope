/**
 * 認證服務
 * 提供登入、註冊、登出和令牌管理功能
 */

import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  DecodedToken
} from '../../types/auth';
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = '/api';

/**
 * 儲存令牌到本地儲存
 */
export const saveTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

/**
 * 從本地儲存獲取訪問令牌
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

/**
 * 從本地儲存獲取刷新令牌
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

/**
 * 清除本地儲存的令牌
 */
export const clearTokens = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

/**
 * 解碼JWT令牌
 */
export const decodeToken = (token: string): DecodedToken => {
  return jwtDecode<DecodedToken>(token);
};

/**
 * 檢查令牌是否過期
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = decodeToken(token);
    // 提前5分鐘視為過期，單位為秒
    const currentTime = Math.floor(Date.now() / 1000) - 300;
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

/**
 * 用戶登入
 */
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const formData = new FormData();
  formData.append('username', credentials.email);
  formData.append('password', credentials.password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '登入失敗');
  }

  const data = await response.json();
  saveTokens(data.access_token, data.refresh_token);
  return data;
};

/**
 * 用戶註冊
 */
export const register = async (userData: RegisterRequest): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '註冊失敗');
  }

  return response.json();
};

/**
 * 刷新訪問令牌
 */
export const refreshToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('沒有刷新令牌可用');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw new Error('刷新令牌失敗');
  }

  const data: RefreshTokenResponse = await response.json();
  localStorage.setItem('accessToken', data.access_token);
  return data.access_token;
};

/**
 * 用戶登出
 */
export const logout = async (): Promise<void> => {
  try {
    const token = getAccessToken();
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    console.error('登出請求失敗:', error);
  } finally {
    clearTokens();
  }
};

/**
 * 獲取當前用戶資訊
 */
export const getCurrentUser = (): { user_uuid: string } | null => {
  const token = getAccessToken();
  if (!token) return null;
  
  try {
    const decoded = decodeToken(token);
    return { user_uuid: decoded.sub };
  } catch (error) {
    console.error('解析用戶資訊失敗:', error);
    return null;
  }
}; 