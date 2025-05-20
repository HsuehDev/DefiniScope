import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import * as authService from '../services/auth/authService';

// 創建axios實例
const axiosInstance: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000, // 10秒
  headers: {
    'Content-Type': 'application/json',
  }
});

// 是否正在刷新令牌
let isRefreshing = false;

// 等待刷新令牌的請求隊列
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * 將重試請求添加到隊列
 */
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

/**
 * 處理令牌刷新完成後的重新嘗試
 */
const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

/**
 * 刷新令牌並重新嘗試請求
 */
const refreshTokenAndRetry = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
  try {
    const newToken = await authService.refreshToken();
    const newConfig = {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${newToken}`
      }
    };
    return await axios(newConfig);
  } catch (error) {
    authService.clearTokens();
    window.location.href = '/login';
    return Promise.reject(error);
  }
};

// 請求攔截器
axiosInstance.interceptors.request.use(
  (config) => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 回應攔截器
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // 如果是401錯誤（未授權）並且不是刷新令牌的請求
    if (error.response?.status === 401 && 
        originalRequest && 
        !originalRequest.url?.includes('/auth/refresh')) {
      
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          // 嘗試刷新令牌
          const newToken = await authService.refreshToken();
          isRefreshing = false;
          onRefreshed(newToken);
          
          // 使用新的令牌重試原始請求
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return axios(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          authService.clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // 等待令牌刷新完成後重試請求
        return new Promise(resolve => {
          subscribeTokenRefresh(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(axios(originalRequest));
          });
        });
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance; 