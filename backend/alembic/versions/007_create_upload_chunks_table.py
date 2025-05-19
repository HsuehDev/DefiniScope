"""
創建上傳分片資料表

Revision ID: 007_create_upload_chunks_table
Revises: 006_create_message_references_table
Create Date: 2023-05-10 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '007_create_upload_chunks_table'
down_revision = '006_create_message_references_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建上傳分片資料表和相關索引"""
    # 創建上傳分片資料表
    op.create_table(
        'upload_chunks',
        sa.Column('chunk_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), sa.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('upload_id', sa.String(100), nullable=False),
        sa.Column('file_id', sa.String(100), nullable=False),
        sa.Column('chunk_number', sa.Integer(), nullable=False),
        sa.Column('chunk_total', sa.Integer(), nullable=False),
        sa.Column('chunk_size', sa.BigInteger(), nullable=False),
        sa.Column('minio_bucket_name', sa.String(100), nullable=False),
        sa.Column('minio_object_key', sa.String(255), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        
        # 約束
        sa.CheckConstraint("chunk_number > 0", name='check_positive_chunk_number'),
        sa.CheckConstraint("chunk_total > 0", name='check_positive_chunk_total'),
        sa.CheckConstraint("chunk_size > 0", name='check_positive_chunk_size'),
        
        # 資料表註釋
        sa.Comment('上傳分片資料表：追踪檔案分片上傳狀態，支援斷點續傳')
    )
    
    # 建立索引
    op.create_index('idx_upload_chunks_user_uuid', 'upload_chunks', ['user_uuid'])
    op.create_index('idx_upload_chunks_upload_id_chunk_number', 'upload_chunks', ['upload_id', 'chunk_number'])
    op.create_index('idx_upload_chunks_expires_at', 'upload_chunks', ['expires_at'])


def downgrade():
    """降級：移除上傳分片資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('upload_chunks') 