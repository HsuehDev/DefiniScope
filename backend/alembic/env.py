from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys

# 添加項目根目錄到路徑
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# 這是 Alembic 配置，它提供了訪問值的方法
# config.ini 文件中的值。
config = context.config

# 解釋配置文件。
# 這個行設置了日誌記錄器配置的格式
fileConfig(config.config_file_name)

# 添加 SQL 模型的 MetaData 對象 
# 用於 'autogenerate' 支持
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
from app.models import User, File, Sentence, Conversation, Message, MessageReference, UploadChunk, Query
from sqlmodel import SQLModel
target_metadata = SQLModel.metadata

# 其他的值來自配置，定義為python模塊
# 可以在這裡獲取，例如：
# my_important_option = config.get_main_option("my_important_option")
# ... 等等。


def run_migrations_offline():
    """離線運行遷移（不連接到數據庫）

    這個配置需要URL。
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """在線運行遷移。

    在這個場景中我們需要一個連接引擎，並將連接存入
    遷移上下文。
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online() 