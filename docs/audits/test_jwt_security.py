"""
JWT安全管理模組單元測試
使用pytest和pytest-mock測試JWT功能
"""
import os
import pytest
import jwt
import time
import redis
from unittest.mock import MagicMock, patch, ANY
from datetime import datetime, timedelta
from fastapi import HTTPException, status

# 導入要測試的模組
from docs.audits.jwt_security_improvements import (
    get_redis_client_with_retry,
    create_access_token_improved,
    add_token_to_blacklist_improved,
    decode_access_token_improved
)


# 創建共用的fixture
@pytest.fixture
def mock_settings():
    """模擬設置對象"""
    with patch("docs.audits.jwt_security_improvements.settings") as mock_settings:
        mock_settings.JWT_SECRET_KEY = "test_secret_key"
        mock_settings.JWT_ALGORITHM = "HS256"
        mock_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 30
        mock_settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7
        mock_settings.REDIS_HOST = "localhost"
        mock_settings.REDIS_PORT = 6379
        mock_settings.REDIS_DB = 0
        mock_settings.REDIS_PASSWORD = None
        yield mock_settings


@pytest.fixture
def mock_redis_client():
    """模擬Redis客戶端"""
    with patch("docs.audits.jwt_security_improvements.redis_client") as mock_client:
        with patch("docs.audits.jwt_security_improvements.get_redis_client_with_retry", return_value=mock_client):
            # 配置模擬行為
            mock_client.ping.return_value = True
            mock_client.set.return_value = True
            mock_client.get.return_value = None
            mock_client.exists.return_value = 0
            mock_client.incr.return_value = 1
            mock_client.sadd.return_value = 1
            mock_client.expire.return_value = True
            yield mock_client


class TestGetRedisClientWithRetry:
    """測試Redis客戶端獲取函數"""
    
    @patch("docs.audits.jwt_security_improvements.redis.ConnectionPool")
    @patch("docs.audits.jwt_security_improvements.redis.Redis")
    def test_get_redis_client_with_retry_success(self, mock_redis, mock_pool, mock_settings):
        """測試成功獲取Redis客戶端"""
        # 設置模擬對象
        mock_client = MagicMock()
        mock_redis.return_value = mock_client
        mock_client.ping.return_value = True
        
        # 執行函數
        with patch("docs.audits.jwt_security_improvements.redis_client", None):
            with patch("docs.audits.jwt_security_improvements.redis_pool", None):
                with patch("docs.audits.jwt_security_improvements.redis_client_lock", None):
                    result = get_redis_client_with_retry()
                    
        # 驗證結果
        assert result == mock_client
        mock_pool.assert_called_once_with(
            host=mock_settings.REDIS_HOST,
            port=mock_settings.REDIS_PORT,
            db=mock_settings.REDIS_DB,
            password=mock_settings.REDIS_PASSWORD,
            decode_responses=True,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
            retry_on_timeout=True
        )
        mock_redis.assert_called_once_with(connection_pool=mock_pool.return_value)
        mock_client.ping.assert_called_once()
    
    @patch("docs.audits.jwt_security_improvements.redis.ConnectionPool")
    @patch("docs.audits.jwt_security_improvements.redis.Redis")
    def test_get_redis_client_with_retry_connection_error(self, mock_redis, mock_pool, mock_settings):
        """測試Redis連接失敗時的重試行為"""
        # 設置模擬對象
        mock_client = MagicMock()
        mock_redis.return_value = mock_client
        # 設置第一次ping失敗，第二次成功
        mock_client.ping.side_effect = [
            redis.RedisError("連接失敗"),
            True
        ]
        
        # 執行函數
        with patch("docs.audits.jwt_security_improvements.redis_client", mock_client):
            with patch("docs.audits.jwt_security_improvements.redis_pool", None):
                with patch("docs.audits.jwt_security_improvements.redis_client_lock", None):
                    # tenacity裝飾器應會重試
                    with pytest.raises(RuntimeError):
                        get_redis_client_with_retry()


class TestCreateAccessToken:
    """測試訪問令牌創建函數"""
    
    def test_create_access_token_improved_success(self, mock_redis_client, mock_settings):
        """測試正常創建訪問令牌"""
        # 設置模擬對象
        subject = "test_user_id"
        
        # 執行函數
        with patch("docs.audits.jwt_security_improvements.uuid.uuid4", return_value="test-uuid"):
            token = create_access_token_improved(subject)
        
        # 解碼令牌驗證內容
        payload = jwt.decode(
            token,
            mock_settings.JWT_SECRET_KEY,
            algorithms=[mock_settings.JWT_ALGORITHM]
        )
        
        # 驗證結果
        assert payload["sub"] == subject
        assert payload["type"] == "access"
        assert payload["jti"] == "test-uuid"
        assert "exp" in payload
        assert "iat" in payload
        
        # 驗證Redis調用
        mock_redis_client.set.assert_called_once_with(
            "token_jti:test-uuid",
            "1",
            nx=True,
            ex=mock_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    def test_create_access_token_improved_with_custom_expiry(self, mock_redis_client, mock_settings):
        """測試使用自定義過期時間創建訪問令牌"""
        # 設置模擬對象
        subject = "test_user_id"
        expires_delta = timedelta(minutes=15)
        
        # 執行函數
        with patch("docs.audits.jwt_security_improvements.uuid.uuid4", return_value="test-uuid"):
            token = create_access_token_improved(subject, expires_delta)
        
        # 解碼令牌驗證內容
        payload = jwt.decode(
            token,
            mock_settings.JWT_SECRET_KEY,
            algorithms=[mock_settings.JWT_ALGORITHM]
        )
        
        # 驗證結果
        assert payload["sub"] == subject
        assert payload["type"] == "access"
        assert payload["jti"] == "test-uuid"
        assert "exp" in payload
        assert "iat" in payload
        
        # 驗證Redis調用
        mock_redis_client.set.assert_called_once_with(
            "token_jti:test-uuid",
            "1",
            nx=True,
            ex=int(expires_delta.total_seconds())
        )
    
    def test_create_access_token_improved_redis_error(self, mock_redis_client, mock_settings):
        """測試Redis錯誤時的處理"""
        # 設置模擬對象
        subject = "test_user_id"
        mock_redis_client.set.side_effect = redis.RedisError("Redis連接失敗")
        
        # 執行函數
        with patch("docs.audits.jwt_security_improvements.uuid.uuid4", return_value="test-uuid"):
            with pytest.raises(RuntimeError) as excinfo:
                create_access_token_improved(subject)
                
        # 驗證錯誤信息
        assert "無法創建有效令牌" in str(excinfo.value)


class TestTokenBlacklist:
    """測試令牌黑名單相關函數"""
    
    def test_add_token_to_blacklist_improved_success(self, mock_redis_client):
        """測試成功添加令牌到黑名單"""
        # 設置模擬對象
        jti = "test-jti"
        # 過期時間設置為1小時後
        expires_at = int((datetime.utcnow() + timedelta(hours=1)).timestamp())
        
        # 執行函數
        result = add_token_to_blacklist_improved(jti, expires_at)
        
        # 驗證結果
        assert result is True
        # 驗證Redis調用
        mock_redis_client.set.assert_called_once()
        mock_redis_client.incr.assert_called_once_with("stats:tokens_blacklisted")
        mock_redis_client.sadd.assert_called_once_with("monitoring:recent_blacklisted", jti)
        mock_redis_client.expire.assert_called_once_with("monitoring:recent_blacklisted", 86400)
    
    def test_add_token_to_blacklist_improved_expired_token(self, mock_redis_client):
        """測試添加已過期令牌到黑名單"""
        # 設置模擬對象
        jti = "test-jti"
        # 過期時間設置為過去
        expires_at = int((datetime.utcnow() - timedelta(hours=1)).timestamp())
        
        # 執行函數
        result = add_token_to_blacklist_improved(jti, expires_at)
        
        # 驗證結果
        assert result is False
        # 驗證沒有Redis調用
        mock_redis_client.set.assert_not_called()
    
    def test_add_token_to_blacklist_improved_redis_error(self, mock_redis_client):
        """測試Redis錯誤時的處理"""
        # 設置模擬對象
        jti = "test-jti"
        expires_at = int((datetime.utcnow() + timedelta(hours=1)).timestamp())
        mock_redis_client.set.side_effect = redis.RedisError("Redis連接失敗")
        
        # 執行函數
        result = add_token_to_blacklist_improved(jti, expires_at)
        
        # 驗證結果
        assert result is False


# 使用 pytest.mark.asyncio 裝飾器標記異步測試類
@pytest.mark.asyncio
class TestDecodeAccessToken:
    """測試訪問令牌解碼函數"""
    
    async def test_decode_access_token_improved_valid_token(self, mock_redis_client, mock_settings):
        """測試解碼有效的訪問令牌"""
        # 創建有效的測試令牌
        subject = "test_user_id"
        jti = "test-jti"
        exp = datetime.utcnow() + timedelta(minutes=30)
        
        payload = {
            "sub": subject,
            "exp": exp,
            "iat": datetime.utcnow(),
            "type": "access",
            "jti": jti
        }
        
        token = jwt.encode(
            payload,
            mock_settings.JWT_SECRET_KEY,
            algorithm=mock_settings.JWT_ALGORITHM
        )
        
        # 設置模擬行為
        mock_redis_client.exists.side_effect = [0, 1]  # 第一次調用返回0（不在黑名單中），第二次調用返回1（JTI有效）
        
        # 執行函數
        result = await decode_access_token_improved(token)
        
        # 驗證結果
        assert result["sub"] == subject
        assert result["jti"] == jti
        
        # 驗證Redis調用
        assert mock_redis_client.exists.call_count == 2
        mock_redis_client.exists.assert_any_call(f"token_blacklist:{jti}")
        mock_redis_client.exists.assert_any_call(f"token_jti:{jti}")
        mock_redis_client.incr.assert_called_once_with("stats:token_usages")
    
    async def test_decode_access_token_improved_invalid_token_type(self, mock_settings):
        """測試非訪問令牌類型"""
        # 創建有效的測試令牌，但類型為refresh
        subject = "test_user_id"
        jti = "test-jti"
        exp = datetime.utcnow() + timedelta(minutes=30)
        
        payload = {
            "sub": subject,
            "exp": exp,
            "iat": datetime.utcnow(),
            "type": "refresh",  # 使用refresh類型
            "jti": jti
        }
        
        token = jwt.encode(
            payload,
            mock_settings.JWT_SECRET_KEY,
            algorithm=mock_settings.JWT_ALGORITHM
        )
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            await decode_access_token_improved(token)
        
        # 驗證錯誤
        assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "不是有效的訪問令牌" in excinfo.value.detail
    
    async def test_decode_access_token_improved_blacklisted_token(self, mock_redis_client, mock_settings):
        """測試已列入黑名單的令牌"""
        # 創建有效的測試令牌
        subject = "test_user_id"
        jti = "test-jti"
        exp = datetime.utcnow() + timedelta(minutes=30)
        
        payload = {
            "sub": subject,
            "exp": exp,
            "iat": datetime.utcnow(),
            "type": "access",
            "jti": jti
        }
        
        token = jwt.encode(
            payload,
            mock_settings.JWT_SECRET_KEY,
            algorithm=mock_settings.JWT_ALGORITHM
        )
        
        # 設置模擬行為 - 令牌在黑名單中
        mock_redis_client.exists.return_value = 1
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            await decode_access_token_improved(token)
        
        # 驗證錯誤
        assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "令牌已被撤銷" in excinfo.value.detail
        
        # 驗證Redis調用
        mock_redis_client.exists.assert_called_once_with(f"token_blacklist:{jti}")
    
    async def test_decode_access_token_improved_invalid_jti(self, mock_redis_client, mock_settings):
        """測試無效JTI的令牌"""
        # 創建有效的測試令牌
        subject = "test_user_id"
        jti = "test-jti"
        exp = datetime.utcnow() + timedelta(minutes=30)
        
        payload = {
            "sub": subject,
            "exp": exp,
            "iat": datetime.utcnow(),
            "type": "access",
            "jti": jti
        }
        
        token = jwt.encode(
            payload,
            mock_settings.JWT_SECRET_KEY,
            algorithm=mock_settings.JWT_ALGORITHM
        )
        
        # 設置模擬行為 - 令牌不在黑名單中，但JTI無效
        mock_redis_client.exists.side_effect = [0, 0]
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            await decode_access_token_improved(token)
        
        # 驗證錯誤
        assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "無效的令牌" in excinfo.value.detail
        
        # 驗證Redis調用
        assert mock_redis_client.exists.call_count == 2
        mock_redis_client.exists.assert_any_call(f"token_blacklist:{jti}")
        mock_redis_client.exists.assert_any_call(f"token_jti:{jti}")
    
    async def test_decode_access_token_improved_expired_token(self, mock_settings):
        """測試過期的令牌"""
        # 創建過期的測試令牌
        subject = "test_user_id"
        jti = "test-jti"
        exp = datetime.utcnow() - timedelta(minutes=5)  # 設置為過去時間
        
        payload = {
            "sub": subject,
            "exp": exp,
            "iat": datetime.utcnow() - timedelta(minutes=35),
            "type": "access",
            "jti": jti
        }
        
        token = jwt.encode(
            payload,
            mock_settings.JWT_SECRET_KEY,
            algorithm=mock_settings.JWT_ALGORITHM
        )
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            await decode_access_token_improved(token)
        
        # 驗證錯誤
        assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "令牌已過期" in excinfo.value.detail
    
    async def test_decode_access_token_improved_invalid_signature(self, mock_settings):
        """測試簽名無效的令牌"""
        # 創建有效的測試令牌
        subject = "test_user_id"
        jti = "test-jti"
        exp = datetime.utcnow() + timedelta(minutes=30)
        
        payload = {
            "sub": subject,
            "exp": exp,
            "iat": datetime.utcnow(),
            "type": "access",
            "jti": jti
        }
        
        # 使用錯誤的secret key簽名
        token = jwt.encode(
            payload,
            "wrong_secret_key",
            algorithm=mock_settings.JWT_ALGORITHM
        )
        
        # 執行函數
        with pytest.raises(HTTPException) as excinfo:
            await decode_access_token_improved(token)
        
        # 驗證錯誤
        assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "令牌無效" in excinfo.value.detail 