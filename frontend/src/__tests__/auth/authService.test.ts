/**
 * 認證服務測試
 */
import { describe, beforeEach, test, expect, vi } from 'vitest';
import * as authService from '../../services/auth/authService';

// 模擬fetch API
global.fetch = vi.fn();

// 模擬localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    store
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 模擬jwt-decode
vi.mock('jwt-decode', () => {
  return {
    jwtDecode: (token: string) => {
      if (token === 'valid_token') {
        return {
          sub: 'test-user-uuid',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1小時後過期
          iat: Math.floor(Date.now() / 1000),
          type: 'access',
          jti: 'test-jwt-id'
        };
      } else if (token === 'expired_token') {
        return {
          sub: 'test-user-uuid',
          exp: Math.floor(Date.now() / 1000) - 3600, // 1小時前過期
          iat: Math.floor(Date.now() / 1000) - 7200,
          type: 'access',
          jti: 'test-jwt-id'
        };
      } else if (token === 'refresh_token') {
        return {
          sub: 'test-user-uuid',
          exp: Math.floor(Date.now() / 1000) + 604800, // 7天後過期
          iat: Math.floor(Date.now() / 1000),
          type: 'refresh',
          jti: 'test-jwt-id'
        };
      } else {
        throw new Error('Invalid token');
      }
    }
  };
});

describe('認證服務測試', () => {
  beforeEach(() => {
    // 重置所有模擬
    vi.clearAllMocks();
    localStorageMock.clear();
    (fetch as any).mockClear();
  });

  describe('令牌管理', () => {
    test('應該可以保存並獲取令牌', () => {
      // 安排
      const accessToken = 'test_access_token';
      const refreshToken = 'test_refresh_token';

      // 行動
      authService.saveTokens(accessToken, refreshToken);

      // 斷言
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', accessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', refreshToken);
      expect(authService.getAccessToken()).toBe(accessToken);
      expect(authService.getRefreshToken()).toBe(refreshToken);
    });

    test('應該可以清除令牌', () => {
      // 安排
      const accessToken = 'test_access_token';
      const refreshToken = 'test_refresh_token';
      authService.saveTokens(accessToken, refreshToken);

      // 行動
      authService.clearTokens();

      // 斷言
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(authService.getAccessToken()).toBeNull();
      expect(authService.getRefreshToken()).toBeNull();
    });
  });

  describe('令牌過期檢查', () => {
    test('如果令牌有效，應該回傳false', () => {
      // 安排 - 使用jwt-decode模擬返回未過期的令牌
      // 行動
      const result = authService.isTokenExpired('valid_token');

      // 斷言
      expect(result).toBe(false);
    });

    test('如果令牌已過期，應該回傳true', () => {
      // 安排 - 使用jwt-decode模擬返回已過期的令牌
      // 行動
      const result = authService.isTokenExpired('expired_token');

      // 斷言
      expect(result).toBe(true);
    });

    test('如果令牌無效，應該回傳true', () => {
      // 安排 - 使用jwt-decode模擬拋出錯誤
      // 行動
      const result = authService.isTokenExpired('invalid_token');

      // 斷言
      expect(result).toBe(true);
    });
  });

  describe('登入功能', () => {
    test('登入成功時應該儲存令牌', async () => {
      // 安排
      const loginResponse = {
        user_uuid: 'test-user-uuid',
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        token_type: 'bearer'
      };
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => loginResponse
      });

      // 行動
      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123'
      });

      // 斷言
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.anything());
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', loginResponse.access_token);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', loginResponse.refresh_token);
      expect(result).toEqual(loginResponse);
    });

    test('登入失敗時應該拋出錯誤', async () => {
      // 安排
      const errorDetail = { detail: '帳號或密碼錯誤' };
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => errorDetail
      });

      // 行動 & 斷言
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong_password'
        })
      ).rejects.toThrow(errorDetail.detail);
    });
  });

  describe('註冊功能', () => {
    test('註冊成功時應該回傳用戶資訊', async () => {
      // 安排
      const registerResponse = {
        user_uuid: 'test-user-uuid',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z'
      };
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => registerResponse
      });

      // 行動
      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123'
      });

      // 斷言
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.anything());
      expect(result).toEqual(registerResponse);
    });

    test('註冊失敗時應該拋出錯誤', async () => {
      // 安排
      const errorDetail = { detail: '使用者已存在' };
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => errorDetail
      });

      // 行動 & 斷言
      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'Password123'
        })
      ).rejects.toThrow(errorDetail.detail);
    });
  });

  describe('刷新令牌功能', () => {
    test('成功刷新令牌時應該更新訪問令牌', async () => {
      // 安排
      const refreshResponse = {
        access_token: 'new_access_token',
        token_type: 'bearer'
      };
      localStorageMock.setItem('refreshToken', 'test_refresh_token');
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => refreshResponse
      });

      // 行動
      const result = await authService.refreshToken();

      // 斷言
      expect(fetch).toHaveBeenCalledWith('/api/auth/refresh', expect.anything());
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', refreshResponse.access_token);
      expect(result).toBe(refreshResponse.access_token);
    });

    test('刷新令牌失敗時應該拋出錯誤並清除令牌', async () => {
      // 安排
      localStorageMock.setItem('refreshToken', 'test_refresh_token');
      localStorageMock.setItem('accessToken', 'test_access_token');
      (fetch as any).mockResolvedValueOnce({
        ok: false
      });

      // 行動 & 斷言
      await expect(authService.refreshToken()).rejects.toThrow('刷新令牌失敗');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });

    test('如果沒有刷新令牌可用，應該拋出錯誤', async () => {
      // 安排 - 不設置刷新令牌

      // 行動 & 斷言
      await expect(authService.refreshToken()).rejects.toThrow('沒有刷新令牌可用');
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('登出功能', () => {
    test('登出時應該呼叫API並清除令牌', async () => {
      // 安排
      localStorageMock.setItem('accessToken', 'test_access_token');
      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      // 行動
      await authService.logout();

      // 斷言
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.anything());
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });

    test('即使登出API呼叫失敗，仍應清除令牌', async () => {
      // 安排
      localStorageMock.setItem('accessToken', 'test_access_token');
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // 行動
      await authService.logout();

      // 斷言
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.anything());
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('獲取當前用戶資訊', () => {
    test('如果有有效的令牌，應該回傳用戶資訊', () => {
      // 安排
      localStorageMock.setItem('accessToken', 'valid_token');

      // 行動
      const result = authService.getCurrentUser();

      // 斷言
      expect(result).toEqual({ user_uuid: 'test-user-uuid' });
    });

    test('如果沒有令牌，應該回傳null', () => {
      // 安排 - 不設置令牌

      // 行動
      const result = authService.getCurrentUser();

      // 斷言
      expect(result).toBeNull();
    });

    test('如果令牌無效，應該回傳null', () => {
      // 安排
      localStorageMock.setItem('accessToken', 'invalid_token');

      // 行動
      const result = authService.getCurrentUser();

      // 斷言
      expect(result).toBeNull();
    });
  });
}); 