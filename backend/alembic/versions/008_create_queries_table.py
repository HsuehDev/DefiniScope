"""
創建查詢資料表

Revision ID: 008_create_queries_table
Revises: 007_create_upload_chunks_table
Create Date: 2023-05-10 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '008_create_queries_table'
down_revision = '007_create_upload_chunks_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建查詢資料表和相關索引"""
    # 創建查詢資料表
    op.create_table(
        'queries',
        sa.Column('query_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), sa.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('conversation_uuid', UUID(as_uuid=True), sa.ForeignKey('conversations.conversation_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('keywords', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        
        # 約束
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name='check_valid_query_status'
        ),
        
        # 資料表註釋
        sa.Comment('查詢資料表：儲存使用者的查詢及其處理狀態')
    )
    
    # 建立索引
    op.create_index('idx_queries_user_uuid', 'queries', ['user_uuid'])
    op.create_index('idx_queries_conversation_uuid', 'queries', ['conversation_uuid'])
    op.create_index('idx_queries_status', 'queries', ['status'])
    op.create_index('idx_queries_created_at', 'queries', ['created_at'])


def downgrade():
    """降級：移除查詢資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('queries') 