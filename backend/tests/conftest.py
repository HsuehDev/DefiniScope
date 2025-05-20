"""
共享的pytest測試夾具配置
"""
import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

# 確保能正確導入應用模組
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_path)

from app.main import app
from app.models.user import User
from app.core.security import hash_password, create_access_token
from app.db.session import get_db

# 使用測試客戶端
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

# 使用內存數據庫進行測試
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

# 覆蓋依賴項，使用測試數據庫
@pytest.fixture
def override_get_db(db_session):
    def _override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()

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

@pytest.fixture
def test_token(test_user):
    """創建測試用戶的訪問令牌"""
    return create_access_token(subject=str(test_user.user_uuid))

@pytest.fixture
def authenticated_client(client, test_token):
    """創建已認證的測試客戶端"""
    client.headers = {
        **client.headers,
        "Authorization": f"Bearer {test_token}"
    }
    return client 