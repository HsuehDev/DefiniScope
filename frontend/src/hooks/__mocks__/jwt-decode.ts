import { DecodedToken } from '../../types/auth';

// 模擬jwt-decode函數，用於測試
export const jwtDecode = jest.fn().mockImplementation((token: string): DecodedToken => {
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
}); 