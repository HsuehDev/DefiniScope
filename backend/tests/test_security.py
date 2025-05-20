"""
JWT安全管理模組的單元測試
"""
import os
import time
import pytest
import jwt
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.utils.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    add_token_to_blacklist, is_token_blacklisted, verify_jti, get_redis_client,
    check_login_attempts, increment_login_attempts, reset_login_attempts
)
from app.core.config import settings


class TestPasswordFunctions:
    """密碼函數測試集"""
    
    def test_hash_password(self):
        """測試密碼雜湊功能"""
        password = "secure_password123"
        hashed = hash_password(password)
        
        # 確保雜湊結果不等於原始密碼
        assert hashed != password
        # 確保每次雜湊結果不同（因為鹽值不同）
        assert hash_password(password) != hashed
    
    def test_verify_password(self):
        """測試密碼驗證功能"""
        password = "secure_password123"
        wrong_password = "wrong_password"
        hashed = hash_password(password)
        
        # 正確密碼驗證
        assert verify_password(password, hashed) is True
        # 錯誤密碼驗證
        assert verify_password(wrong_password, hashed) is False


class TestJWTFunctions:
    """JWT函數測試集"""
    
    def test_create_access_token(self):
        """測試創建訪問令牌"""
        user_id = "test-user-id"
        token = create_access_token(subject=user_id)
        
        # 解析並驗證令牌
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 檢查載荷內容
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert "jti" in payload
        assert "exp" in payload
        assert "iat" in payload
        
        # 檢查過期時間設置正確
        exp_time = datetime.fromtimestamp(payload["exp"])
        iat_time = datetime.fromtimestamp(payload["iat"])
        assert (exp_time - iat_time).total_seconds() == settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    
    def test_create_access_token_with_custom_expiry(self):
        """測試創建自定義過期時間的訪問令牌"""
        user_id = "test-user-id"
        expires_delta = timedelta(minutes=30)
        token = create_access_token(subject=user_id, expires_delta=expires_delta)
        
        # 解析並驗證令牌
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 檢查過期時間設置正確
        exp_time = datetime.fromtimestamp(payload["exp"])
        iat_time = datetime.fromtimestamp(payload["iat"])
        assert (exp_time - iat_time).total_seconds() == expires_delta.total_seconds()
    
    def test_create_refresh_token(self):
        """測試創建刷新令牌"""
        user_id = "test-user-id"
        token = create_refresh_token(subject=user_id)
        
        # 解析並驗證令牌
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 檢查載荷內容
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"
        assert "jti" in payload
        assert "exp" in payload
        assert "iat" in payload
        
        # 檢查過期時間設置正確 (天數轉換為秒)
        exp_time = datetime.fromtimestamp(payload["exp"])
        iat_time = datetime.fromtimestamp(payload["iat"])
        assert (exp_time - iat_time).total_seconds() == settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    
    def test_create_refresh_token_with_custom_expiry(self):
        """測試創建自定義過期時間的刷新令牌"""
        user_id = "test-user-id"
        expires_delta = timedelta(days=10)
        token = create_refresh_token(subject=user_id, expires_delta=expires_delta)
        
        # 解析並驗證令牌
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 檢查過期時間設置正確
        exp_time = datetime.fromtimestamp(payload["exp"])
        iat_time = datetime.fromtimestamp(payload["iat"])
        assert (exp_time - iat_time).total_seconds() == expires_delta.total_seconds()


class TestTokenBlacklist:
    """令牌黑名單函數測試集"""
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis客戶端"""
        with patch("app.utils.security.get_redis_client") as mock:
            redis_mock = MagicMock()
            mock.return_value = redis_mock
            yield redis_mock
    
    def test_add_token_to_blacklist(self, mock_redis):
        """測試添加令牌到黑名單"""
        # 設置數據
        token_jti = "test-jti"
        expires_at = int((datetime.utcnow() + timedelta(minutes=30)).timestamp())
        
        # 執行函數
        add_token_to_blacklist(token_jti, expires_at)
        
        # 驗證Redis命令被調用
        mock_redis.set.assert_called_once()
        # 驗證參數
        args, kwargs = mock_redis.set.call_args
        assert kwargs["nx"] is True
        assert f"token_blacklist:{token_jti}" in args or f"token_blacklist:{token_jti}" in kwargs.values()
    
    def test_is_token_blacklisted(self, mock_redis):
        """測試檢查令牌是否在黑名單中"""
        # 設置數據
        token_jti = "test-jti"
        
        # 設置Redis模擬行為
        mock_redis.exists.return_value = 1
        
        # 執行函數並驗證結果
        assert is_token_blacklisted(token_jti) is True
        
        # 驗證Redis命令被調用
        mock_redis.exists.assert_called_once_with(f"token_blacklist:{token_jti}")
        
        # 測試不在黑名單中的情況
        mock_redis.exists.return_value = 0
        assert is_token_blacklisted(token_jti) is False
    
    def test_is_token_blacklisted_error_handling(self, mock_redis):
        """測試黑名單檢查出錯時的異常處理"""
        # 設置數據
        token_jti = "test-jti"
        
        # 設置Redis模擬異常
        mock_redis.exists.side_effect = Exception("Redis連接失敗")
        
        # 執行函數並驗證結果 - 應該不引發異常，而是返回False
        assert is_token_blacklisted(token_jti) is False
    
    def test_verify_jti(self, mock_redis):
        """測試JTI驗證功能"""
        # 設置數據
        token_jti = "test-jti"
        
        # 設置Redis模擬行為
        mock_redis.exists.return_value = 1
        
        # 執行函數並驗證結果
        assert verify_jti(token_jti) is True
        
        # 驗證Redis命令被調用
        mock_redis.exists.assert_called_once_with(f"token_jti:{token_jti}")
        
        # 測試無效JTI的情況
        mock_redis.exists.return_value = 0
        assert verify_jti(token_jti) is False


class TestLoginAttempts:
    """登入嘗試函數測試集"""
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis客戶端"""
        with patch("app.utils.security.get_redis_client") as mock:
            redis_mock = MagicMock()
            mock.return_value = redis_mock
            yield redis_mock
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_under_limit(self, mock_redis):
        """測試低於嘗試次數限制時的檢查"""
        # 設置數據
        email = "test@example.com"
        
        # 設置Redis模擬行為 - 嘗試次數低於限制
        mock_redis.get.return_value = str(settings.MAX_LOGIN_ATTEMPTS - 1)
        
        # 執行函數 - 不應引發異常
        await check_login_attempts(email)
        
        # 驗證Redis命令被調用
        mock_redis.get.assert_called_once_with(f"login_attempts:{email}")
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_at_limit(self, mock_redis):
        """測試達到嘗試次數限制時的檢查"""
        # 設置數據
        email = "test@example.com"
        
        # 設置Redis模擬行為 - 嘗試次數達到限制
        mock_redis.get.return_value = str(settings.MAX_LOGIN_ATTEMPTS)
        mock_redis.ttl.return_value = 300  # 5分鐘的鎖定
        
        # 執行函數 - 應引發HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await check_login_attempts(email)
        
        # 驗證異常詳情
        assert exc_info.value.status_code == 429
        assert "登入嘗試次數過多" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_redis_error(self, mock_redis):
        """測試Redis錯誤時的異常處理"""
        # 設置數據
        email = "test@example.com"
        
        # 設置Redis模擬異常
        mock_redis.get.side_effect = Exception("Redis連接失敗")
        
        # 執行函數 - 不應引發異常
        await check_login_attempts(email)
    
    @pytest.mark.asyncio
    async def test_increment_login_attempts_first_attempt(self, mock_redis):
        """測試第一次登入嘗試的遞增"""
        # 設置數據
        email = "test@example.com"
        
        # 設置Redis模擬行為 - 第一次嘗試
        mock_redis.incr.return_value = 1
        
        # 執行函數
        await increment_login_attempts(email)
        
        # 驗證Redis命令被調用
        mock_redis.incr.assert_called_once_with(f"login_attempts:{email}")
        mock_redis.expire.assert_called_once_with(f"login_attempts:{email}", settings.LOGIN_ATTEMPTS_WINDOW)
    
    @pytest.mark.asyncio
    async def test_increment_login_attempts_at_limit(self, mock_redis):
        """測試達到嘗試次數限制時的遞增"""
        # 設置數據
        email = "test@example.com"
        
        # 設置Redis模擬行為 - 嘗試次數達到限制
        mock_redis.incr.return_value = settings.MAX_LOGIN_ATTEMPTS
        
        # 執行函數
        await increment_login_attempts(email)
        
        # 驗證Redis命令被調用
        mock_redis.incr.assert_called_once_with(f"login_attempts:{email}")
        mock_redis.expire.assert_called_once_with(f"login_attempts:{email}", settings.ACCOUNT_LOCKOUT_TIME)
    
    @pytest.mark.asyncio
    async def test_reset_login_attempts(self, mock_redis):
        """測試重置登入嘗試次數"""
        # 設置數據
        email = "test@example.com"
        
        # 執行函數
        await reset_login_attempts(email)
        
        # 驗證Redis命令被調用
        mock_redis.delete.assert_called_once_with(f"login_attempts:{email}")


class TestRedisClientManagement:
    """Redis客戶端管理測試集"""
    
    def test_get_redis_client_successful_connection(self):
        """測試獲取Redis客戶端成功連接"""
        with patch("app.utils.security.redis.ConnectionPool") as mock_pool:
            with patch("app.utils.security.redis.Redis") as mock_redis:
                # 設置模擬對象
                mock_redis_instance = MagicMock()
                mock_redis.return_value = mock_redis_instance
                
                # 獲取客戶端
                client = get_redis_client()
                
                # 驗證連接池和客戶端被創建
                mock_pool.assert_called_once()
                mock_redis.assert_called_once()
                assert client is mock_redis_instance
    
    def test_get_redis_client_connection_error(self):
        """測試獲取Redis客戶端連接失敗"""
        with patch("app.utils.security.redis.ConnectionPool") as mock_pool:
            with patch("app.utils.security.redis.Redis") as mock_redis:
                # 設置模擬對象拋出異常
                mock_redis_instance = MagicMock()
                mock_redis.return_value = mock_redis_instance
                mock_redis_instance.ping.side_effect = Exception("連接失敗")
                
                # 獲取客戶端應拋出異常
                with pytest.raises(RuntimeError) as exc_info:
                    get_redis_client()
                
                # 驗證錯誤信息
                assert "無法連接到Redis服務" in str(exc_info.value)
    
    def test_get_redis_client_singleton(self):
        """測試Redis客戶端單例模式"""
        with patch("app.utils.security.redis.ConnectionPool") as mock_pool:
            with patch("app.utils.security.redis.Redis") as mock_redis:
                # 設置模擬對象
                mock_redis_instance = MagicMock()
                mock_redis.return_value = mock_redis_instance
                
                # 獲取客戶端多次，應該只創建一次
                client1 = get_redis_client()
                client2 = get_redis_client()
                
                # 驗證只創建了一次
                assert mock_pool.call_count == 1
                assert mock_redis.call_count == 1
                assert client1 is client2


# 參數化測試 - 不同場景的JWT令牌創建和驗證
@pytest.mark.parametrize(
    "subject,token_type,expires_delta,expected_type",
    [
        ("user1", "access", timedelta(minutes=15), "access"),
        ("user2", "refresh", timedelta(days=7), "refresh"),
        ("user3", "access", None, "access"),  # 使用默認過期時間
        ("user4", "refresh", None, "refresh"),  # 使用默認過期時間
    ],
)
def test_token_creation_parametrized(subject, token_type, expires_delta, expected_type):
    """參數化測試不同場景的令牌創建"""
    # 選擇合適的創建函數
    if token_type == "access":
        token = create_access_token(subject=subject, expires_delta=expires_delta)
    else:
        token = create_refresh_token(subject=subject, expires_delta=expires_delta)
    
    # 解析並驗證令牌
    payload = jwt.decode(
        token, 
        settings.JWT_SECRET_KEY, 
        algorithms=[settings.JWT_ALGORITHM]
    )
    
    # 驗證載荷
    assert payload["sub"] == subject
    assert payload["type"] == expected_type
    assert "jti" in payload
    assert "exp" in payload
    assert payload["exp"] > payload["iat"] 