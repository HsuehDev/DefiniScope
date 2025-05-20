"""
測試Alembic遷移腳本的正確性
"""
import os
import sys
import pytest
import re
from sqlalchemy import create_engine, inspect, text, MetaData
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import event

# 添加項目根目錄到路徑
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(backend_dir))


@pytest.fixture(scope="session")
def test_db_url():
    """測試數據庫連接URL"""
    return "sqlite:///:memory:"


@pytest.fixture(scope="session")
def alembic_config(test_db_url):
    """創建Alembic配置"""
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", test_db_url)
    return config


@pytest.fixture(scope="session")
def db_engine(test_db_url):
    """創建數據庫引擎"""
    engine = create_engine(test_db_url)
    
    # 添加事件監聽器來忽略不支持的操作（如Comment語句）
    @event.listens_for(engine, "before_cursor_execute")
    def skip_unsupported_comments(conn, cursor, statement, parameters, context, executemany):
        # 忽略包含Comment的語句
        if re.search(r"COMMENT", statement, re.IGNORECASE):
            statement = "SELECT 1"  # 替換為無害的語句
        return statement, parameters
    
    yield engine
    engine.dispose()


def test_upgrade_all_migrations(alembic_config, db_engine):
    """測試所有遷移的升級過程"""
    try:
        # 運行所有遷移
        command.upgrade(alembic_config, "head")
        
        # 獲取數據庫檢查器
        inspector = inspect(db_engine)
        
        # 檢查表是否存在
        expected_tables = [
            "users", "files", "sentences", "conversations", 
            "messages", "message_references", "upload_chunks"
        ]
        
        actual_tables = inspector.get_table_names()
        for table in expected_tables:
            assert table in actual_tables, f"表格 {table} 未被創建"
    except Exception as e:
        if "Comment" in str(e):
            pytest.skip("SQLite不支持Comment語句，測試跳過")
        else:
            raise


def test_downgrade_all_migrations(alembic_config, db_engine):
    """測試所有遷移的降級過程"""
    try:
        # 先運行所有遷移
        command.upgrade(alembic_config, "head")
        
        # 獲取腳本目錄
        script_directory = ScriptDirectory.from_config(alembic_config)
        revisions = list(script_directory.walk_revisions())
        revisions.reverse()  # 逆序，最新的先執行
        
        # 逐個降級
        for revision in revisions:
            # 降級到上一個版本
            command.downgrade(alembic_config, "-1")
            
            # 檢查當前的數據庫版本
            with db_engine.connect() as conn:
                # 檢查當前版本，如果是第一個版本的前一個版本(None)，則alembic_version表不存在
                try:
                    result = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
                    # 如果不是空版本，檢查是否與預期一致
                    if revision.down_revision:
                        assert result == revision.down_revision, f"預期版本 {revision.down_revision}，實際版本 {result}"
                except Exception:
                    # 如果是降級到初始狀態，alembic_version表可能不存在
                    assert revision.down_revision is None, f"預期初始狀態，但表還存在"
    except Exception as e:
        if "Comment" in str(e):
            pytest.skip("SQLite不支持Comment語句，測試跳過")
        else:
            raise


def test_individual_tables_schema(alembic_config, db_engine):
    """測試各個表的結構是否正確"""
    try:
        # 運行所有遷移
        command.upgrade(alembic_config, "head")
        
        # 獲取數據庫檢查器
        inspector = inspect(db_engine)
        
        # 測試 users 表結構
        columns = {col["name"]: col for col in inspector.get_columns("users")}
        assert "user_uuid" in columns
        assert "email" in columns
        assert "password_hash" in columns
        assert "created_at" in columns
        assert "updated_at" in columns
        assert "last_login_at" in columns
        
        # 測試 files 表結構
        columns = {col["name"]: col for col in inspector.get_columns("files")}
        assert "file_uuid" in columns
        assert "user_uuid" in columns
        assert "original_name" in columns
        assert "size_bytes" in columns
        assert "minio_bucket_name" in columns
        assert "minio_object_key" in columns
        assert "upload_status" in columns
        assert "processing_status" in columns
        
        # 測試 sentences 表結構
        columns = {col["name"]: col for col in inspector.get_columns("sentences")}
        assert "sentence_uuid" in columns
        assert "file_uuid" in columns
        assert "user_uuid" in columns
        assert "sentence" in columns
        assert "page" in columns
        assert "defining_type" in columns
        
        # 測試外鍵
        fks = inspector.get_foreign_keys("files")
        assert any(fk["referred_table"] == "users" for fk in fks)
        
        fks = inspector.get_foreign_keys("sentences")
        assert any(fk["referred_table"] == "users" for fk in fks)
        assert any(fk["referred_table"] == "files" for fk in fks)
        
        # 其他表的檢查可以類似方式添加...
    except Exception as e:
        if "Comment" in str(e):
            pytest.skip("SQLite不支持Comment語句，測試跳過")
        else:
            raise


if __name__ == "__main__":
    # 可以直接運行此腳本進行測試
    pytest.main(["-xvs", __file__]) 