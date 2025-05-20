"""
測試環境專用配置
此模組提供測試環境中使用的配置和模擬對象
"""
import os
from unittest.mock import MagicMock
from typing import Dict, Any, Optional

# 測試專用的設置值
TEST_SETTINGS = {
    "API_V1_STR": "/api",
    "SECRET_KEY": "test-secret-key",
    "PROJECT_NAME": "測試環境",
    "DATABASE_URI": "sqlite:///:memory:",
    "JWT_SECRET_KEY": "test-jwt-key",
    "JWT_ALGORITHM": "HS256",
    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    "REDIS_URL": "memory://",
    "CELERY_BROKER_URL": "memory://",
    "CELERY_BACKEND_URL": "memory://",
    "PDF_SPLITTER_URL": "http://test-splitter:8000",
    "N8N_BASE_URL": "http://test-workflow:5678/webhook/",
    "MINIO_ENDPOINT": "test-minio:9000",
    "MINIO_ACCESS_KEY": "test-access-key",
    "MINIO_SECRET_KEY": "test-secret-key",
    "DEFAULT_BUCKET_DOCUMENTS": "test-documents",
    "DEFAULT_BUCKET_TEMP": "test-temp"
}

# 測試用設置類
class TestSettings:
    """測試用設置類，模擬 app.core.config.settings"""
    
    def __init__(self, **overrides):
        # 設置默認值
        for key, value in TEST_SETTINGS.items():
            setattr(self, key, value)
        
        # 應用覆蓋值
        for key, value in overrides.items():
            setattr(self, key, value)

# 常見依賴的模擬對象
class MockDependencies:
    """提供常見依賴的模擬對象"""
    
    @staticmethod
    def get_mock_ws_manager():
        """獲取模擬的 WebSocket 管理器"""
        mock_ws_manager = MagicMock()
        mock_ws_manager.send_message_to_user = MagicMock()
        return mock_ws_manager
    
    @staticmethod
    def get_mock_minio_client():
        """獲取模擬的 MinIO 客戶端"""
        mock_client = MagicMock()
        mock_client.bucket_exists.return_value = True
        mock_client.put_object.return_value = None
        mock_client.get_object.return_value = MagicMock()
        return mock_client
    
    @staticmethod
    def get_mock_db_session():
        """獲取模擬的數據庫會話"""
        mock_session = MagicMock()
        
        # 模擬常見的數據庫操作
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        
        return mock_session
    
    @staticmethod
    def get_mock_redis_client():
        """獲取模擬的 Redis 客戶端"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        mock_redis.set.return_value = True
        return mock_redis

# 測試環境標記函數
def in_test_environment() -> bool:
    """檢查是否在測試環境中運行"""
    return os.getenv("TESTING") == "1" 