"""
創建消息資料表

Revision ID: 005_create_messages_table
Revises: 004_create_conversations_table
Create Date: 2023-05-10 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '005_create_messages_table'
down_revision = '004_create_conversations_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建消息資料表和相關索引"""
    # 創建消息資料表
    op.create_table(
        'messages',
        sa.Column('message_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('conversation_uuid', UUID(as_uuid=True), sa.ForeignKey('conversations.conversation_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), sa.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        
        # 約束
        sa.CheckConstraint("role IN ('user', 'assistant')", name='check_valid_role'),
        
        # 資料表註釋
        sa.Comment('消息資料表：儲存對話中的使用者查詢和系統回應')
    )
    
    # 建立索引
    op.create_index('idx_messages_conversation_uuid', 'messages', ['conversation_uuid'])
    op.create_index('idx_messages_user_uuid', 'messages', ['user_uuid'])
    op.create_index('idx_messages_created_at', 'messages', ['created_at'])
    op.create_index('idx_messages_conversation_created', 'messages', ['conversation_uuid', 'created_at'])
    op.create_index('idx_messages_role', 'messages', ['role'])


def downgrade():
    """降級：移除消息資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('messages') 