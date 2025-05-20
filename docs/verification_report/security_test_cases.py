"""
JWT安全管理模組的單元測試案例
使用pytest和pytest-mock
"""
import pytest
import jwt
import time
import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app.utils.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    add_token_to_blacklist, is_token_blacklisted, verify_jti, get_redis_client,
    check_login_attempts, increment_login_attempts, reset_login_attempts
)
from app.core.config import settings


class TestJWTTokenCreation:
    """JWT令牌創建相關測試"""
    
    def test_access_token_creation_with_default_expiry(self):
        """測試使用預設過期時間創建訪問令牌"""
        # 安排
        user_id = "test-user-id"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.set.return_value = True
            
            # 執行
            token = create_access_token(subject=user_id)
            
            # 驗證
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
            
            # 驗證Redis調用
            mock_redis.set.assert_called_once()
            args, kwargs = mock_redis.set.call_args
            assert f"token_jti:{payload['jti']}" in args or f"token_jti:{payload['jti']}" in kwargs.values()
            assert "1" in args or "1" in kwargs.values()
            assert kwargs["nx"] is True
            assert "ex" in kwargs
    
    def test_access_token_creation_with_custom_expiry(self):
        """測試自定義過期時間創建訪問令牌"""
        # 安排
        user_id = "test-user-id"
        custom_expiry = timedelta(minutes=45)
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.set.return_value = True
            
            # 執行
            token = create_access_token(subject=user_id, expires_delta=custom_expiry)
            
            # 驗證
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # 檢查過期時間設置正確
            exp_time = datetime.fromtimestamp(payload["exp"])
            iat_time = datetime.fromtimestamp(payload["iat"])
            assert (exp_time - iat_time).total_seconds() == custom_expiry.total_seconds()
            
            # 驗證Redis調用
            mock_redis.set.assert_called_once()
            args, kwargs = mock_redis.set.call_args
            assert "ex" in kwargs
            assert kwargs["ex"] == int(custom_expiry.total_seconds())
    
    def test_refresh_token_creation(self):
        """測試刷新令牌創建"""
        # 安排
        user_id = "test-user-id"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.set.return_value = True
            
            # 執行
            token = create_refresh_token(subject=user_id)
            
            # 驗證
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
            expected_seconds = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
            assert abs((exp_time - iat_time).total_seconds() - expected_seconds) < 2  # 允許1-2秒誤差
            
            # 驗證Redis調用
            mock_redis.set.assert_called_once()
            args, kwargs = mock_redis.set.call_args
            assert kwargs["ex"] == expected_seconds
    
    def test_token_creation_redis_failure(self):
        """測試Redis連接失敗時的令牌創建"""
        # 安排
        user_id = "test-user-id"
        
        # 模擬Redis客戶端拋出異常
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis_func.side_effect = Exception("Redis連接失敗")
            
            # 執行 - 不應拋出異常
            token = create_access_token(subject=user_id)
            
            # 驗證仍然創建了有效的令牌
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            assert payload["sub"] == user_id
            assert payload["type"] == "access"


class TestTokenBlacklist:
    """令牌黑名單相關測試"""
    
    def test_add_token_to_blacklist_success(self):
        """測試成功添加令牌到黑名單"""
        # 安排
        token_jti = str(uuid.uuid4())
        # 30分鐘後過期
        expires_at = int((datetime.utcnow() + timedelta(minutes=30)).timestamp())
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.set.return_value = True
            
            # 執行
            result = add_token_to_blacklist(token_jti, expires_at)
            
            # 驗證
            assert result is True
            mock_redis.set.assert_called_once()
            args, kwargs = mock_redis.set.call_args
            assert f"token_blacklist:{token_jti}" in args or f"token_blacklist:{token_jti}" in kwargs.values()
            assert "1" in args or "1" in kwargs.values()
            assert kwargs["nx"] is True
            assert "ex" in kwargs
            
            # 檢查TTL計算正確
            now = int(datetime.utcnow().timestamp())
            expected_ttl = max(expires_at - now, 0)
            actual_ttl = kwargs["ex"]
            # 允許1-2秒誤差
            assert abs(actual_ttl - expected_ttl) <= 2
    
    def test_add_token_to_blacklist_already_expired(self):
        """測試添加已過期令牌到黑名單"""
        # 安排
        token_jti = str(uuid.uuid4())
        # 已過期的令牌 (10分鐘前)
        expires_at = int((datetime.utcnow() - timedelta(minutes=10)).timestamp())
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.set.return_value = True
            
            # 執行
            result = add_token_to_blacklist(token_jti, expires_at)
            
            # 驗證
            assert result is True
            mock_redis.set.assert_called_once()
            args, kwargs = mock_redis.set.call_args
            assert kwargs["ex"] == 0  # TTL應為0
    
    def test_add_token_to_blacklist_redis_failure(self):
        """測試Redis連接失敗時添加令牌到黑名單"""
        # 安排
        token_jti = str(uuid.uuid4())
        expires_at = int((datetime.utcnow() + timedelta(minutes=30)).timestamp())
        
        # 模擬Redis客戶端拋出異常
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis_func.side_effect = Exception("Redis連接失敗")
            
            # 執行
            result = add_token_to_blacklist(token_jti, expires_at)
            
            # 驗證
            assert result is False
    
    def test_is_token_blacklisted_true(self):
        """測試檢查令牌在黑名單中 (是)"""
        # 安排
        token_jti = str(uuid.uuid4())
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.exists.return_value = 1
            
            # 執行
            result = is_token_blacklisted(token_jti)
            
            # 驗證
            assert result is True
            mock_redis.exists.assert_called_once_with(f"token_blacklist:{token_jti}")
    
    def test_is_token_blacklisted_false(self):
        """測試檢查令牌在黑名單中 (否)"""
        # 安排
        token_jti = str(uuid.uuid4())
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.exists.return_value = 0
            
            # 執行
            result = is_token_blacklisted(token_jti)
            
            # 驗證
            assert result is False
            mock_redis.exists.assert_called_once_with(f"token_blacklist:{token_jti}")
    
    def test_is_token_blacklisted_redis_failure(self):
        """測試Redis連接失敗時檢查令牌在黑名單中"""
        # 安排
        token_jti = str(uuid.uuid4())
        
        # 模擬Redis客戶端拋出異常
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.exists.side_effect = Exception("Redis連接失敗")
            
            # 執行
            result = is_token_blacklisted(token_jti)
            
            # 驗證 - 失敗時應返回False
            assert result is False
            mock_redis.exists.assert_called_once_with(f"token_blacklist:{token_jti}")


class TestLoginAttempts:
    """登入嘗試相關測試"""
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_no_previous_attempts(self):
        """測試無先前登入嘗試時的檢查"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.get.return_value = None
            
            # 執行 - 不應拋出異常
            await check_login_attempts(email)
            
            # 驗證
            mock_redis.get.assert_called_once_with(f"login_attempts:{email}")
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_under_limit(self):
        """測試低於嘗試次數限制時的檢查"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.get.return_value = str(settings.MAX_LOGIN_ATTEMPTS - 1)
            
            # 執行 - 不應拋出異常
            await check_login_attempts(email)
            
            # 驗證
            mock_redis.get.assert_called_once_with(f"login_attempts:{email}")
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_at_limit_not_locked(self):
        """測試達到嘗試次數限制但未鎖定時的檢查"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.get.return_value = str(settings.MAX_LOGIN_ATTEMPTS)
            # 模擬已經沒有鎖定時間
            mock_redis.ttl.return_value = -1
            
            # 執行 - 不應拋出異常
            await check_login_attempts(email)
            
            # 驗證
            mock_redis.get.assert_called_once_with(f"login_attempts:{email}")
            mock_redis.ttl.assert_called_once_with(f"login_attempts:{email}")
    
    @pytest.mark.asyncio
    async def test_check_login_attempts_at_limit_locked(self):
        """測試達到嘗試次數限制且鎖定時的檢查"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.get.return_value = str(settings.MAX_LOGIN_ATTEMPTS)
            # 模擬還有鎖定時間
            mock_redis.ttl.return_value = 300  # 5分鐘
            
            # 執行 - 應拋出異常
            with pytest.raises(Exception) as excinfo:
                await check_login_attempts(email)
            
            # 驗證
            assert "登入嘗試次數過多" in str(excinfo.value)
            mock_redis.get.assert_called_once_with(f"login_attempts:{email}")
            mock_redis.ttl.assert_called_once_with(f"login_attempts:{email}")
    
    @pytest.mark.asyncio
    async def test_increment_login_attempts_first_attempt(self):
        """測試首次增加登入嘗試次數"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.incr.return_value = 1
            
            # 執行
            await increment_login_attempts(email)
            
            # 驗證
            mock_redis.incr.assert_called_once_with(f"login_attempts:{email}")
            mock_redis.expire.assert_called_once_with(
                f"login_attempts:{email}", 
                settings.LOGIN_ATTEMPTS_WINDOW
            )
    
    @pytest.mark.asyncio
    async def test_increment_login_attempts_at_limit(self):
        """測試達到限制時增加登入嘗試次數"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            mock_redis.incr.return_value = settings.MAX_LOGIN_ATTEMPTS
            
            # 執行
            await increment_login_attempts(email)
            
            # 驗證
            mock_redis.incr.assert_called_once_with(f"login_attempts:{email}")
            mock_redis.expire.assert_called_once_with(
                f"login_attempts:{email}", 
                settings.ACCOUNT_LOCKOUT_TIME
            )
    
    @pytest.mark.asyncio
    async def test_reset_login_attempts(self):
        """測試重置登入嘗試次數"""
        # 安排
        email = "test@example.com"
        
        # 模擬Redis客戶端
        with patch("app.utils.security.get_redis_client") as mock_redis_func:
            mock_redis = MagicMock()
            mock_redis_func.return_value = mock_redis
            
            # 執行
            await reset_login_attempts(email)
            
            # 驗證
            mock_redis.delete.assert_called_once_with(f"login_attempts:{email}")


class TestPasswordFunctions:
    """密碼相關函數測試"""
    
    def test_hash_password(self):
        """測試密碼雜湊功能"""
        # 安排
        password = "SecureP@ssw0rd123"
        
        # 執行
        hashed = hash_password(password)
        
        # 驗證
        assert hashed != password
        assert len(hashed) > 0
        # 確保每次雜湊結果不同
        assert hash_password(password) != hashed
    
    def test_verify_password_correct(self):
        """測試正確密碼驗證"""
        # 安排
        password = "SecureP@ssw0rd123"
        hashed = hash_password(password)
        
        # 執行
        result = verify_password(password, hashed)
        
        # 驗證
        assert result is True
    
    def test_verify_password_incorrect(self):
        """測試錯誤密碼驗證"""
        # 安排
        password = "SecureP@ssw0rd123"
        wrong_password = "WrongP@ssw0rd"
        hashed = hash_password(password)
        
        # 執行
        result = verify_password(wrong_password, hashed)
        
        # 驗證
        assert result is False


if __name__ == "__main__":
    pytest.main(["-xvs", __file__]) 