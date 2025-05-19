import os
import sys
import pytest
from sqlmodel import Session, select
from datetime import datetime

# 確保能正確導入應用模組
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, backend_path)

from app.models import User

def test_user_create(db_session: Session):
    """測試創建用戶"""
    user = User(email="test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    assert user.user_uuid is not None
    assert user.email == "test@example.com"
    assert user.created_at is not None

def test_user_read(db_session: Session):
    """測試讀取用戶"""
    user = User(email="read_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    stored_user = db_session.exec(select(User).where(User.email == "read_test@example.com")).first()
    
    assert stored_user is not None
    assert stored_user.email == "read_test@example.com"

def test_user_update(db_session: Session):
    """測試更新用戶"""
    user = User(email="update_test@example.com", password_hash="old_password")
    db_session.add(user)
    db_session.commit()
    
    user_uuid = user.user_uuid
    
    stored_user = db_session.get(User, user_uuid)
    stored_user.password_hash = "new_password"
    stored_user.updated_at = datetime.utcnow()
    db_session.add(stored_user)
    db_session.commit()
    
    updated_user = db_session.get(User, user_uuid)
    assert updated_user.password_hash == "new_password"

def test_user_delete(db_session: Session):
    """測試刪除用戶"""
    user = User(email="delete_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    user_uuid = user.user_uuid
    
    db_session.delete(user)
    db_session.commit()
    
    deleted_user = db_session.get(User, user_uuid)
    assert deleted_user is None 