"""
創建對話資料表

Revision ID: 004_create_conversations_table
Revises: 003_create_sentences_table
Create Date: 2023-05-10 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '004_create_conversations_table'
down_revision = '003_create_sentences_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建對話資料表和相關索引"""
    # 創建對話資料表
    op.create_table(
        'conversations',
        sa.Column('conversation_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), sa.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), server_default='新對話'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_message_at', sa.TIMESTAMP(timezone=True), nullable=True),
        
        # 資料表註釋
        sa.Comment('對話資料表：儲存使用者的對話上下文')
    )
    
    # 建立索引
    op.create_index('idx_conversations_user_uuid', 'conversations', ['user_uuid'])
    op.create_index('idx_conversations_last_message_at', 'conversations', ['last_message_at'])
    op.create_index('idx_conversations_user_last_message', 'conversations', ['user_uuid', 'last_message_at'])


def downgrade():
    """降級：移除對話資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('conversations') 