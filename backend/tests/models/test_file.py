import os
import sys
import pytest
from sqlmodel import Session, select
from app.models import User, File, UploadStatus, ProcessingStatus
from datetime import datetime

# 確保能正確導入應用模組
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, backend_path)

from app.models import User, File, UploadStatus, ProcessingStatus

def test_file_create(db_session: Session):
    """測試創建檔案記錄"""
    # 先創建一個用戶
    user = User(email="file_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    file = File(
        user_uuid=user.user_uuid,
        original_name="test.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key.pdf"
    )
    db_session.add(file)
    db_session.commit()
    
    assert file.file_uuid is not None
    assert file.upload_status == UploadStatus.PENDING.value
    assert file.processing_status == ProcessingStatus.PENDING.value

def test_file_user_relationship(db_session: Session):
    """測試檔案與用戶的關聯關係"""
    # 先創建一個用戶
    user = User(email="file_rel_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    # 創建兩個檔案
    file1 = File(
        user_uuid=user.user_uuid,
        original_name="test1.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key1.pdf"
    )
    file2 = File(
        user_uuid=user.user_uuid,
        original_name="test2.pdf",
        size_bytes=2048,
        minio_bucket_name="test-bucket",
        minio_object_key="test-key2.pdf"
    )
    db_session.add(file1)
    db_session.add(file2)
    db_session.commit()
    
    # 重新獲取用戶及其檔案
    user_with_files = db_session.exec(
        select(User).where(User.user_uuid == user.user_uuid)
    ).first()
    
    assert len(user_with_files.files) == 2
    assert user_with_files.files[0].original_name in ["test1.pdf", "test2.pdf"]
    assert user_with_files.files[1].original_name in ["test1.pdf", "test2.pdf"]

def test_file_cascade_delete(db_session: Session):
    """測試刪除用戶時級聯刪除檔案"""
    # 先創建一個用戶
    user = User(email="cascade_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    # 創建一個檔案
    file = File(
        user_uuid=user.user_uuid,
        original_name="cascade.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="cascade-key.pdf"
    )
    db_session.add(file)
    db_session.commit()
    
    file_uuid = file.file_uuid
    
    # 刪除用戶
    db_session.delete(user)
    db_session.commit()
    
    # 檢查檔案是否也被刪除
    deleted_file = db_session.get(File, file_uuid)
    assert deleted_file is None 