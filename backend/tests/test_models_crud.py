"""
測試數據模型的CRUD操作
"""
import os
import sys
import pytest
from datetime import datetime, timedelta
import uuid
from sqlmodel import Session, SQLModel, create_engine, select

# 添加項目根目錄到路徑
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(backend_dir))

from app.models import User, File, Sentence, Conversation, Message, MessageReference, UploadChunk, Query
from app.models.file import UploadStatus, ProcessingStatus
from app.models.sentence import DefiningType
from app.models.message import MessageRole


@pytest.fixture(name="engine")
def engine_fixture():
    """創建測試數據庫引擎"""
    engine = create_engine("sqlite:///:memory:", echo=True)
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="session")
def session_fixture(engine):
    """創建測試數據庫會話"""
    with Session(engine) as session:
        yield session


def test_user_crud(session):
    """測試用戶的CRUD操作"""
    # 創建
    user = User(email="test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # 讀取
    db_user = session.get(User, user.user_uuid)
    assert db_user is not None
    assert db_user.email == "test@example.com"
    assert db_user.password_hash == "hashed_password"
    
    # 更新
    db_user.last_login_at = datetime.utcnow()
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    assert db_user.last_login_at is not None
    
    # 刪除
    session.delete(db_user)
    session.commit()
    assert session.get(User, user.user_uuid) is None


def test_file_crud(session):
    """測試檔案的CRUD操作"""
    # 準備用戶
    user = User(email="file_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    # 創建檔案
    file = File(
        user_uuid=user.user_uuid,
        original_name="test.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key",
        upload_status=UploadStatus.PENDING.value,
        processing_status=ProcessingStatus.PENDING.value
    )
    session.add(file)
    session.commit()
    session.refresh(file)
    
    # 讀取
    db_file = session.get(File, file.file_uuid)
    assert db_file is not None
    assert db_file.original_name == "test.pdf"
    assert db_file.size_bytes == 1024
    assert db_file.upload_status == UploadStatus.PENDING.value
    
    # 更新
    db_file.upload_status = UploadStatus.COMPLETED.value
    db_file.upload_completed_at = datetime.utcnow()
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    assert db_file.upload_status == UploadStatus.COMPLETED.value
    assert db_file.upload_completed_at is not None
    
    # 刪除
    session.delete(db_file)
    session.commit()
    assert session.get(File, file.file_uuid) is None


def test_sentence_crud(session):
    """測試句子的CRUD操作"""
    # 準備用戶和檔案
    user = User(email="sentence_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    file = File(
        user_uuid=user.user_uuid,
        original_name="test.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key"
    )
    session.add(file)
    session.commit()
    
    # 創建句子
    sentence = Sentence(
        file_uuid=file.file_uuid,
        user_uuid=user.user_uuid,
        sentence="This is a test sentence.",
        page=1,
        defining_type=DefiningType.NONE.value
    )
    session.add(sentence)
    session.commit()
    session.refresh(sentence)
    
    # 讀取
    db_sentence = session.get(Sentence, sentence.sentence_uuid)
    assert db_sentence is not None
    assert db_sentence.sentence == "This is a test sentence."
    assert db_sentence.page == 1
    assert db_sentence.defining_type == DefiningType.NONE.value
    
    # 更新
    db_sentence.defining_type = DefiningType.CD.value
    db_sentence.reason = "This is a conceptual definition."
    session.add(db_sentence)
    session.commit()
    session.refresh(db_sentence)
    assert db_sentence.defining_type == DefiningType.CD.value
    assert db_sentence.reason == "This is a conceptual definition."
    
    # 刪除
    session.delete(db_sentence)
    session.commit()
    assert session.get(Sentence, sentence.sentence_uuid) is None


def test_conversation_message_crud(session):
    """測試對話和消息的CRUD操作"""
    # 準備用戶
    user = User(email="conversation_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    # 創建對話
    conversation = Conversation(
        user_uuid=user.user_uuid,
        title="Test Conversation"
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    
    # 讀取對話
    db_conversation = session.get(Conversation, conversation.conversation_uuid)
    assert db_conversation is not None
    assert db_conversation.title == "Test Conversation"
    
    # 創建消息
    message = Message(
        conversation_uuid=conversation.conversation_uuid,
        user_uuid=user.user_uuid,
        role=MessageRole.USER.value,
        content="Hello, world!"
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    
    # 讀取消息
    db_message = session.get(Message, message.message_uuid)
    assert db_message is not None
    assert db_message.content == "Hello, world!"
    assert db_message.role == MessageRole.USER.value
    
    # 更新對話
    db_conversation.title = "Updated Conversation"
    db_conversation.last_message_at = datetime.utcnow()
    session.add(db_conversation)
    session.commit()
    session.refresh(db_conversation)
    assert db_conversation.title == "Updated Conversation"
    assert db_conversation.last_message_at is not None
    
    # 刪除測試
    session.delete(db_message)
    session.delete(db_conversation)
    session.commit()
    assert session.get(Message, message.message_uuid) is None
    assert session.get(Conversation, conversation.conversation_uuid) is None


def test_message_reference_crud(session):
    """測試消息引用的CRUD操作"""
    # 準備用戶、檔案和句子
    user = User(email="reference_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    file = File(
        user_uuid=user.user_uuid,
        original_name="test.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key"
    )
    session.add(file)
    session.commit()
    
    sentence = Sentence(
        file_uuid=file.file_uuid,
        user_uuid=user.user_uuid,
        sentence="This is a reference sentence.",
        page=1
    )
    session.add(sentence)
    session.commit()
    
    # 創建對話和消息
    conversation = Conversation(
        user_uuid=user.user_uuid,
        title="Reference Test"
    )
    session.add(conversation)
    session.commit()
    
    message = Message(
        conversation_uuid=conversation.conversation_uuid,
        user_uuid=user.user_uuid,
        role=MessageRole.ASSISTANT.value,
        content="I'm referencing something."
    )
    session.add(message)
    session.commit()
    
    # 創建消息引用
    reference = MessageReference(
        message_uuid=message.message_uuid,
        sentence_uuid=sentence.sentence_uuid
    )
    session.add(reference)
    session.commit()
    session.refresh(reference)
    
    # 讀取引用
    db_reference = session.get(MessageReference, reference.reference_uuid)
    assert db_reference is not None
    assert db_reference.message_uuid == message.message_uuid
    assert db_reference.sentence_uuid == sentence.sentence_uuid
    
    # 刪除引用
    session.delete(db_reference)
    session.commit()
    assert session.get(MessageReference, reference.reference_uuid) is None


def test_upload_chunk_crud(session):
    """測試上傳分片的CRUD操作"""
    # 準備用戶
    user = User(email="chunk_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    # 創建上傳分片
    chunk = UploadChunk(
        user_uuid=user.user_uuid,
        upload_id="test-upload-id",
        file_id="test-file-id",
        chunk_number=1,
        chunk_total=10,
        chunk_size=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key",
        expires_at=datetime.utcnow() + timedelta(days=1)
    )
    session.add(chunk)
    session.commit()
    session.refresh(chunk)
    
    # 讀取分片
    db_chunk = session.get(UploadChunk, chunk.chunk_uuid)
    assert db_chunk is not None
    assert db_chunk.upload_id == "test-upload-id"
    assert db_chunk.chunk_number == 1
    assert db_chunk.chunk_total == 10
    
    # 刪除分片
    session.delete(db_chunk)
    session.commit()
    assert session.get(UploadChunk, chunk.chunk_uuid) is None


def test_query_crud(session):
    """測試查詢的CRUD操作"""
    # 準備用戶和對話
    user = User(email="query_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    conversation = Conversation(
        user_uuid=user.user_uuid,
        title="Query Test"
    )
    session.add(conversation)
    session.commit()
    
    # 創建查詢
    query = Query(
        user_uuid=user.user_uuid,
        conversation_uuid=conversation.conversation_uuid,
        content="What is the definition of X?"
    )
    session.add(query)
    session.commit()
    session.refresh(query)
    
    # 讀取查詢
    db_query = session.get(Query, query.query_uuid)
    assert db_query is not None
    assert db_query.content == "What is the definition of X?"
    assert db_query.status == "pending"  # 默認值
    
    # 更新查詢
    db_query.status = "completed"
    db_query.completed_at = datetime.utcnow()
    db_query.keywords = '["X", "definition"]'
    session.add(db_query)
    session.commit()
    session.refresh(db_query)
    assert db_query.status == "completed"
    assert db_query.completed_at is not None
    assert db_query.keywords == '["X", "definition"]'
    
    # 刪除查詢
    session.delete(db_query)
    session.commit()
    assert session.get(Query, query.query_uuid) is None


def test_cascade_delete(session):
    """測試級聯刪除功能"""
    # 準備用戶
    user = User(email="cascade_test@example.com", password_hash="hashed_password")
    session.add(user)
    session.commit()
    
    # 創建檔案
    file = File(
        user_uuid=user.user_uuid,
        original_name="test.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key"
    )
    session.add(file)
    session.commit()
    
    # 創建句子
    sentence = Sentence(
        file_uuid=file.file_uuid,
        user_uuid=user.user_uuid,
        sentence="This is a test sentence.",
        page=1
    )
    session.add(sentence)
    session.commit()
    
    # 創建對話
    conversation = Conversation(
        user_uuid=user.user_uuid,
        title="Cascade Test"
    )
    session.add(conversation)
    session.commit()
    
    # 創建消息
    message = Message(
        conversation_uuid=conversation.conversation_uuid,
        user_uuid=user.user_uuid,
        role=MessageRole.ASSISTANT.value,
        content="Test message"
    )
    session.add(message)
    session.commit()
    
    # 創建引用
    reference = MessageReference(
        message_uuid=message.message_uuid,
        sentence_uuid=sentence.sentence_uuid
    )
    session.add(reference)
    session.commit()
    
    # 檢查所有數據是否存在
    assert session.get(User, user.user_uuid) is not None
    assert session.get(File, file.file_uuid) is not None
    assert session.get(Sentence, sentence.sentence_uuid) is not None
    assert session.get(Conversation, conversation.conversation_uuid) is not None
    assert session.get(Message, message.message_uuid) is not None
    assert session.get(MessageReference, reference.reference_uuid) is not None
    
    # 刪除用戶，測試級聯刪除
    session.delete(user)
    session.commit()
    
    # 檢查所有關聯數據是否被刪除
    assert session.get(User, user.user_uuid) is None
    assert session.get(File, file.file_uuid) is None
    assert session.get(Sentence, sentence.sentence_uuid) is None
    assert session.get(Conversation, conversation.conversation_uuid) is None
    assert session.get(Message, message.message_uuid) is None
    assert session.get(MessageReference, reference.reference_uuid) is None


if __name__ == "__main__":
    # 可以直接運行此腳本進行測試
    pytest.main(["-xvs", __file__]) 