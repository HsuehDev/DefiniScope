"""
JWT 安全模組測試
"""
import sys
import os
import asyncio
import pytest
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# 添加父目錄到 path 以便能夠導入應用模塊
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 創建 Redis 模擬對象
mock_redis = MagicMock()

# 不要實際連接 Redis
@pytest.fixture
def setup_redis_mock():
    """配置 Redis 模擬"""
    with patch('app.core.jwt_security_improvements.get_redis_client_with_retry', return_value=mock_redis), \
         patch('app.core.jwt_security_improvements.get_redis_client', return_value=mock_redis), \
         patch('app.core.jwt_security_improvements.RedisConnectionManager.get_client', return_value=mock_redis):
        # 重置模擬對象的調用歷史
        mock_redis.reset_mock()
        # 重置 side_effect
        mock_redis.exists.side_effect = None
        yield mock_redis

# 替換配置
from app.core.mock_config import settings
with patch('app.core.jwt_security_improvements.settings', settings):
    from app.core.jwt_security_improvements import (
        hash_password, verify_password, create_access_token, create_refresh_token,
        verify_jti, add_token_to_blacklist, is_token_blacklisted, decode_access_token,
        RedisConnectionManager, TokenType, get_redis_client
    )

# 測試用的用戶數據
TEST_USER_ID = "123e4567-e89b-12d3-a456-426614174000"


def test_hash_password():
    """測試密碼雜湊函數"""
    password = "secure_password123"
    hashed = hash_password(password)
    
    # 確認雜湊不是原始密碼
    assert hashed != password
    
    # 確認雜湊值是有效的 bcrypt 雜湊值
    assert hashed.startswith("$2")


def test_verify_password():
    """測試密碼驗證函數"""
    password = "secure_password123"
    wrong_password = "incorrect_password"
    hashed = hash_password(password)
    
    # 正確的密碼
    assert verify_password(password, hashed) is True
    
    # 錯誤的密碼
    assert verify_password(wrong_password, hashed) is False


def test_create_access_token(setup_redis_mock):
    """測試創建訪問令牌"""
    # 設置模擬行為
    mock_redis.set.return_value = True
    
    # 創建令牌
    token = create_access_token(TEST_USER_ID)
    
    # 驗證返回值是字符串
    assert isinstance(token, str)
    
    # 驗證 redis.set 被調用
    mock_redis.set.assert_called_once()
    
    # 確認設置的是 JTI
    call_args = mock_redis.set.call_args[0]
    assert "token_jti:" in call_args[0]


def test_create_refresh_token(setup_redis_mock):
    """測試創建刷新令牌"""
    # 設置模擬行為
    mock_redis.set.return_value = True
    mock_redis.sadd.return_value = 1
    mock_redis.expire.return_value = True
    
    # 創建令牌
    token = create_refresh_token(TEST_USER_ID)
    
    # 驗證返回值是字符串
    assert isinstance(token, str)
    
    # 驗證 redis.set 被調用
    mock_redis.set.assert_called_once()
    
    # 檢查令牌關聯到用戶
    mock_redis.sadd.assert_called_once()
    mock_redis.expire.assert_called_once()


def test_verify_jti(setup_redis_mock):
    """測試驗證 JTI"""
    # 設置模擬行為 - 模擬 JTI 存在
    mock_redis.exists.return_value = 1
    
    # 驗證存在的 JTI
    jti = "test-jti-123"
    assert verify_jti(jti) is True
    
    # 模擬 JTI 不存在
    mock_redis.exists.return_value = 0
    assert verify_jti(jti) is False


def test_add_token_to_blacklist(setup_redis_mock):
    """測試將令牌加入黑名單"""
    # 設置模擬行為
    mock_redis.set.return_value = True
    mock_redis.incr.return_value = 1
    mock_redis.sadd.return_value = 1
    mock_redis.expire.return_value = True
    
    # 測試加入黑名單
    jti = "test-jti-123"
    expires_at = int(time.time()) + 3600  # 1小時後過期
    
    assert add_token_to_blacklist(jti, expires_at) is True
    
    # 驗證 redis 調用
    mock_redis.set.assert_called_once()
    mock_redis.incr.assert_called_once()
    mock_redis.sadd.assert_called_once()
    mock_redis.expire.assert_called_once()
    
    # 重置模擬對象以測試過期令牌
    mock_redis.reset_mock()
    
    # 手動模擬 add_token_to_blacklist_improved 函數來測試過期令牌
    with patch('app.core.jwt_security_improvements.add_token_to_blacklist_improved', return_value=False) as mock_add:
        past_expiry = int(time.time()) - 100  # 過去的時間戳
        assert add_token_to_blacklist(jti, past_expiry) is False
        mock_add.assert_called_once_with(jti, past_expiry)


def test_is_token_blacklisted(setup_redis_mock):
    """測試檢查令牌是否在黑名單中"""
    # 設置模擬行為
    mock_redis.exists.return_value = 1
    
    # 檢查黑名單
    jti = "blacklisted-jti"
    assert is_token_blacklisted(jti) is True
    
    # 模擬不在黑名單
    mock_redis.exists.return_value = 0
    assert is_token_blacklisted(jti) is False


@pytest.mark.asyncio
async def test_decode_access_token(setup_redis_mock):
    """測試解碼訪問令牌"""
    # 設置模擬行為 - 確保不在黑名單中但在JTI列表中
    def exists_side_effect(key):
        if "token_blacklist:" in key:
            return 0  # 不在黑名單
        else:
            return 1  # 在 JTI 列表
    
    mock_redis.exists.side_effect = exists_side_effect
    mock_redis.set.return_value = True
    mock_redis.incr.return_value = 1
    
    # 創建令牌
    token = create_access_token(TEST_USER_ID)
    
    # 解碼令牌
    payload = await decode_access_token(token)
    
    # 驗證結果
    assert payload["sub"] == TEST_USER_ID
    assert payload["type"] == "access"
    assert "jti" in payload
    assert "exp" in payload
    
    # 驗證 Redis 調用
    assert mock_redis.exists.call_count >= 1
    mock_redis.incr.assert_called_once_with("stats:token_usages")


@pytest.mark.asyncio
async def test_decode_access_token_failures(setup_redis_mock):
    """測試解碼訪問令牌失敗情況"""
    import jwt
    from fastapi import HTTPException
    
    # 測試黑名單令牌
    # 先創建一個有效令牌 (模擬 JTI 在有效列表中)
    mock_redis.exists.return_value = 1  # JTI 有效
    mock_redis.set.return_value = True
    token = create_access_token(TEST_USER_ID)
    
    # 然後模擬它在黑名單中
    def blacklist_check(key):
        if "token_blacklist:" in key:
            return 1  # 在黑名單中
        return 1  # JTI 有效
    
    mock_redis.exists.side_effect = blacklist_check
    
    # 測試應該拋出 HTTPException
    with pytest.raises(HTTPException) as exc:
        await decode_access_token(token)
    assert exc.value.status_code == 401
    assert "令牌已被撤銷" in exc.value.detail
    
    # 重置副作用
    mock_redis.exists.side_effect = None
    
    # 測試 JTI 無效
    mock_redis.exists.side_effect = lambda key: 0 if "token_jti:" in key else 0  # JTI 不存在
    
    with pytest.raises(HTTPException) as exc:
        await decode_access_token(token)
    assert exc.value.status_code == 401
    assert "無效的令牌" in exc.value.detail
    
    # 測試令牌類型錯誤
    mock_redis.exists.side_effect = None
    mock_redis.exists.return_value = 1  # JTI 存在
    
    # 創建一個類型錯誤的令牌
    wrong_type_payload = {
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "sub": TEST_USER_ID,
        "type": "wrong_type",
        "jti": "test-jti"
    }
    wrong_type_token = jwt.encode(
        wrong_type_payload,
        settings.JWT_SECRET_KEY,
        settings.JWT_ALGORITHM
    )
    
    with pytest.raises(HTTPException) as exc:
        await decode_access_token(wrong_type_token)
    assert exc.value.status_code == 401
    assert "不是有效的訪問令牌" in exc.value.detail
    
    # 測試過期令牌
    expired_payload = {
        "exp": int(time.time()) - 3600,  # 1小時前過期
        "iat": int(time.time()) - 7200,
        "sub": TEST_USER_ID,
        "type": "access",
        "jti": "expired-jti"
    }
    expired_token = jwt.encode(
        expired_payload,
        settings.JWT_SECRET_KEY,
        settings.JWT_ALGORITHM
    )
    
    with pytest.raises(HTTPException) as exc:
        await decode_access_token(expired_token)
    assert exc.value.status_code == 401
    assert "令牌已過期" in exc.value.detail


@pytest.mark.asyncio
async def test_token_lifecycle(setup_redis_mock):
    """測試令牌完整生命週期"""
    # 設置模擬行為，初始 JTI 不在黑名單
    def initial_exists_check(key):
        if "token_blacklist:" in key:
            return 0  # 不在黑名單
        else:
            return 1  # JTI 有效
    
    mock_redis.exists.side_effect = initial_exists_check
    mock_redis.set.return_value = True
    mock_redis.incr.return_value = 1
    mock_redis.sadd.return_value = 1
    mock_redis.expire.return_value = True
    
    # 1. 創建訪問令牌
    token = create_access_token(TEST_USER_ID)
    assert isinstance(token, str)
    
    # 2. 解碼令牌
    payload = await decode_access_token(token)
    assert payload["sub"] == TEST_USER_ID
    
    # 3. 將令牌添加到黑名單
    jti = payload["jti"]
    exp = payload["exp"]
    
    # 重置模擬對象
    mock_redis.reset_mock()
    mock_redis.set.return_value = True
    mock_redis.incr.return_value = 1
    mock_redis.sadd.return_value = 1
    mock_redis.expire.return_value = True
    
    assert add_token_to_blacklist(jti, exp) is True
    
    # 4. 改變模擬行為，現在令牌在黑名單中
    def blacklisted_check(key):
        if "token_blacklist:" in key:
            return 1  # 現在在黑名單中
        else:
            return 1  # JTI 有效
    
    mock_redis.exists.side_effect = blacklisted_check
    
    # 5. 嘗試再次使用被撤銷的令牌
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await decode_access_token(token)
    assert exc.value.status_code == 401
    assert "令牌已被撤銷" in exc.value.detail


if __name__ == "__main__":
    pytest.main(["-xvs", __file__]) 