"""
共享的pytest測試夾具配置
"""
import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
from celery import Celery
import pytest_asyncio
from typing import Dict, Any, Generator

# 確保能正確導入應用模組
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_path)

# 模擬 MinIO 的 select.options 模組
class MockMinioSelectOptions:
    """模擬 MinIO 的 select.options 模組"""
    CSVInput = MagicMock()
    CSVOutput = MagicMock()
    JSONInput = MagicMock()
    JSONOutput = MagicMock()
    RequestProgress = MagicMock()

# 註冊模擬模組
sys.modules['minio.select.options'] = MockMinioSelectOptions()

# 標記正在測試環境
os.environ["TESTING"] = "1"

# 避免初始化真實的 FastAPI 應用，僅保留測試需要的部分
mock_app = MagicMock()
sys.modules['app.main'] = mock_app

# 模擬 SQLAlchemy 異步相關模組
mock_async_session = MagicMock()
sys.modules['app.db.session'] = mock_async_session

# 手動導入需要的模組
from app.models.user import User
from app.core.security import hash_password, create_access_token
from app.worker import celery as app_celery

# 從自定義測試配置模組導入工具函數和類
from .test_config import TestSettings, MockDependencies

# 測試工具函數：匹配任意字符串
def any_string():
    """返回一個匹配任意字符串的匹配器"""
    class AnyStringMatcher:
        def __eq__(self, other):
            return isinstance(other, str)
    return AnyStringMatcher()

# 測試工具函數：匹配任意字典
def any_dict():
    """返回一個匹配任意字典的匹配器"""
    class AnyDictMatcher:
        def __eq__(self, other):
            return isinstance(other, dict)
    return AnyDictMatcher()

# 測試工具函數：自定義匹配函數
def that_matches(match_fn):
    """
    返回一個使用自定義函數進行匹配的匹配器
    
    Args:
        match_fn: 用於進行匹配的函數，接收一個參數並返回布爾值
    """
    class CustomMatcher:
        def __eq__(self, other):
            return match_fn(other)
    return CustomMatcher()

# 將測試工具函數添加到 pytest 模組
pytest.any_string = any_string
pytest.any_dict = any_dict
pytest.that_matches = that_matches

# 使用同步的 SQLite 內存數據庫進行測試
@pytest.fixture
def engine():
    """創建內存數據庫引擎供測試使用"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # 創建所有表
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)

@pytest.fixture
def db_session(engine):
    """創建測試數據庫會話"""
    with Session(engine) as session:
        yield session

# 模擬 get_db 依賴
@pytest.fixture
def mock_get_db(db_session):
    """模擬 get_db 依賴，返回測試數據庫會話"""
    with patch("app.db.session.get_db") as mock_get_db:
        mock_get_db.return_value = db_session
        yield mock_get_db

# 提供測試專用設置
@pytest.fixture
def test_settings():
    """提供測試專用設置"""
    return TestSettings()

# 測試用的依賴模擬
@pytest.fixture
def mock_dependencies():
    """提供測試用的依賴模擬集合"""
    return MockDependencies()

# 創建測試用戶
@pytest.fixture
def test_user(db_session):
    """創建測試用戶"""
    user = User(
        email="test@example.com",
        password_hash=hash_password("Password123"),
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

# 模擬 JWT 令牌
@pytest.fixture
def test_token(test_user):
    """創建測試用戶的訪問令牌"""
    return create_access_token(subject=str(test_user.user_uuid))

# 模擬的 MinIO 客戶端
@pytest.fixture
def mock_minio_client():
    """模擬 MinIO 客戶端及其方法"""
    with patch("app.core.minio_client.get_minio_client") as mock_get_client:
        # 創建模擬的客戶端
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # 模擬客戶端常用方法
        mock_client.bucket_exists.return_value = True
        mock_client.fput_object.return_value = None
        mock_client.get_object.return_value = MagicMock()
        mock_client.select_object_content = MagicMock()
        
        yield mock_client

# 模擬 download_file 函數
@pytest.fixture
def mock_download_file():
    """模擬 download_file 函數，返回模擬的文件數據"""
    with patch("app.core.minio_client.download_file") as mock_download:
        mock_download.return_value = b"Mock PDF content"
        yield mock_download

# 設置測試用 Celery
@pytest.fixture
def celery_app():
    """創建測試用 Celery 應用"""
    # 配置 Celery 使用內存任務
    app_celery.conf.update(
        CELERY_ALWAYS_EAGER=True,  # 任務同步執行
        CELERY_TASK_EAGER_PROPAGATES=True,  # 立即傳播異常
        CELERY_BROKER_URL="memory://",
        CELERY_BACKEND_URL="cache",
        CELERY_CACHE_BACKEND="memory"
    )
    return app_celery

# 模擬 WebSocket 管理器
@pytest.fixture
def mock_ws_manager():
    """模擬 WebSocket 管理器，用於捕獲發送的消息"""
    with patch("app.tasks.file_processing.ws_manager") as mock_ws:
        # 設置模擬的發送消息方法
        mock_ws.send_message_to_user = MagicMock()
        yield mock_ws
    
    with patch("app.tasks.chat_processing.ws_manager") as mock_ws:
        # 設置模擬的發送消息方法
        mock_ws.send_message_to_user = MagicMock()
        yield mock_ws

# 模擬 httpx 客戶端
@pytest.fixture
def mock_httpx_client():
    """模擬 httpx 客戶端，用於模擬外部 API 調用"""
    with patch("httpx.Client") as mock_client:
        # 創建響應模擬
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}  # 預設回傳空字典
        
        # 設置模擬客戶端的返回值
        mock_client_instance = MagicMock()
        mock_client.return_value.__enter__.return_value = mock_client_instance
        mock_client_instance.post.return_value = mock_response
        
        yield mock_client_instance, mock_response

# 模擬資料庫會話
@pytest.fixture
def mock_db_session():
    """模擬資料庫會話，用於測試 Celery 任務"""
    # 統一模擬對象
    mock_session = MagicMock()
    
    # 文件處理任務
    with patch("app.tasks.file_processing.SessionLocal") as mock_session_factory:
        mock_session_factory.return_value.__enter__.return_value = mock_session
        yield mock_session
    
    # 聊天處理任務
    with patch("app.tasks.chat_processing.SessionLocal") as mock_session_factory:
        mock_session_factory.return_value.__enter__.return_value = mock_session
        yield mock_session

# pytest-httpx的配置
@pytest.fixture(scope="function", autouse=True)
def _httpx_mock_setup():
    """自動配置pytest-httpx，允許更多響應和未預期的請求"""
    import pytest_httpx
    
    # 使用猴子補丁來修改PyTest-HTTPX的默認行為
    # 這樣就不需要在每個測試中手動設置
    original_init = pytest_httpx._httpx_mock._HTTPXMockOptions.__init__
    
    def patched_init(self, *args, **kwargs):
        # 調用原始的初始化
        original_init(self, *args, **kwargs)
        # 修改默認設置
        self.assert_all_responses_were_requested = False
        self.assert_all_requests_were_expected = False
    
    # 應用猴子補丁
    pytest_httpx._httpx_mock._HTTPXMockOptions.__init__ = patched_init

# pytest標記配置
def pytest_configure(config):
    """配置pytest標記"""
    config.addinivalue_line("markers", "asyncio: mark test as asyncio")
    config.addinivalue_line("markers", "integration: mark test as integration test (requires real API)")
    # 添加httpx_mock標記
    config.addinivalue_line(
        "markers", 
        "httpx_mock(assert_all_requests_were_expected=False, assert_all_responses_were_requested=False): Configure pytest-httpx"
    ) 