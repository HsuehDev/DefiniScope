/**
 * 認證相關類型定義
 */

// 用戶資訊
export interface User {
  user_uuid: string;
  email: string;
}

// 認證狀態
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

// 登入請求
export interface LoginRequest {
  email: string;
  password: string;
}

// 登入回應
export interface LoginResponse {
  user_uuid: string;
  email?: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// 註冊請求
export interface RegisterRequest {
  email: string;
  password: string;
}

// 註冊回應
export interface RegisterResponse {
  user_uuid: string;
  email: string;
  created_at: string;
}

// 刷新令牌請求
export interface RefreshTokenRequest {
  refresh_token: string;
}

// 刷新令牌回應
export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
}

// 已解析的JWT令牌
export interface DecodedToken {
  sub: string;    // 用戶UUID
  exp: number;    // 到期時間
  iat: number;    // 發行時間
  type: string;   // 令牌類型
  jti: string;    // JWT ID
} 