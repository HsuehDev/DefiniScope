import os
import sys
import pytest
from sqlmodel import Session, select
from datetime import datetime

# 確保能正確導入應用模組
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, backend_path)

from app.models import User, File, Sentence, DefiningType

def test_sentence_create(db_session: Session):
    """測試創建句子記錄"""
    # 先創建一個用戶和檔案
    user = User(email="sentence_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    file = File(
        user_uuid=user.user_uuid,
        original_name="sentence.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="sentence-key.pdf"
    )
    db_session.add(file)
    db_session.commit()
    
    # 創建句子
    sentence = Sentence(
        file_uuid=file.file_uuid,
        user_uuid=user.user_uuid,
        sentence="這是一個測試句子",
        page=1,
        defining_type=DefiningType.CD.value,
        reason="測試概念型定義"
    )
    db_session.add(sentence)
    db_session.commit()
    
    assert sentence.sentence_uuid is not None
    assert sentence.defining_type == DefiningType.CD.value

def test_sentence_relationships(db_session: Session):
    """測試句子與檔案和用戶的關聯關係"""
    # 先創建一個用戶和檔案
    user = User(email="sentence_rel_test@example.com", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()
    
    file = File(
        user_uuid=user.user_uuid,
        original_name="sentence_rel.pdf",
        size_bytes=1024,
        minio_bucket_name="test-bucket",
        minio_object_key="sentence-rel-key.pdf"
    )
    db_session.add(file)
    db_session.commit()
    
    # 創建多個句子
    sentences = [
        Sentence(
            file_uuid=file.file_uuid,
            user_uuid=user.user_uuid,
            sentence=f"這是測試句子 {i}",
            page=i,
            defining_type=DefiningType.CD.value if i % 2 == 0 else DefiningType.OD.value
        )
        for i in range(1, 6)
    ]
    db_session.add_all(sentences)
    db_session.commit()
    
    # 測試檔案-句子關係
    file_with_sentences = db_session.exec(
        select(File).where(File.file_uuid == file.file_uuid)
    ).first()
    
    assert len(file_with_sentences.sentences) == 5
    
    # 測試用戶-句子關係
    user_with_sentences = db_session.exec(
        select(User).where(User.user_uuid == user.user_uuid)
    ).first()
    
    assert len(user_with_sentences.sentences) == 5
    
    # 測試級聯刪除
    db_session.delete(file)
    db_session.commit()
    
    # 檢查句子是否已級聯刪除
    remaining_sentences = db_session.exec(
        select(Sentence).where(Sentence.file_uuid == file.file_uuid)
    ).all()
    
    assert len(remaining_sentences) == 0 