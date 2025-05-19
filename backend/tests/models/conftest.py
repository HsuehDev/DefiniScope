import os
import sys
import pytest
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

# 確保能正確導入應用模組
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, backend_path)

# 導入所有模型
from app.models import User, File, Sentence, Conversation, Message, MessageReference, UploadChunk

# 使用內存數據庫進行測試
@pytest.fixture(name="engine")
def engine_fixture():
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

@pytest.fixture(name="db_session")
def session_fixture(engine):
    """創建測試數據庫會話"""
    with Session(engine) as session:
        yield session 