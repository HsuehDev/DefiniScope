"""
創建檔案資料表

Revision ID: 002_create_files_table
Revises: 001_create_users_table
Create Date: 2023-05-10 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '002_create_files_table'
down_revision = '001_create_users_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建檔案資料表和相關索引"""
    # 創建檔案資料表
    op.create_table(
        'files',
        sa.Column('file_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), sa.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('original_name', sa.String(255), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('minio_bucket_name', sa.String(100), nullable=False),
        sa.Column('minio_object_key', sa.String(255), nullable=False),
        sa.Column('upload_status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('processing_status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sentence_count', sa.Integer(), server_default='0'),
        sa.Column('cd_count', sa.Integer(), server_default='0'),
        sa.Column('od_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('upload_started_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('upload_completed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        
        # 約束
        sa.CheckConstraint(
            "upload_status IN ('pending', 'in_progress', 'completed', 'failed', 'timeout')",
            name='check_valid_upload_status'
        ),
        sa.CheckConstraint(
            "processing_status IN ('pending', 'in_progress', 'completed', 'failed')",
            name='check_valid_processing_status'
        ),
        sa.CheckConstraint("size_bytes > 0", name='check_positive_size'),
        
        # 資料表註釋
        sa.Comment('檔案資料表：儲存使用者上傳的檔案元數據和處理狀態')
    )
    
    # 建立索引
    op.create_index('idx_files_user_uuid', 'files', ['user_uuid'])
    op.create_index('idx_files_upload_status', 'files', ['upload_status'])
    op.create_index('idx_files_processing_status', 'files', ['processing_status'])
    op.create_index('idx_files_created_at', 'files', ['created_at'])
    op.create_index('idx_files_user_processing_status', 'files', ['user_uuid', 'processing_status'])
    op.create_index('idx_files_upload_started_at', 'files', ['upload_started_at'], postgresql_where=sa.text('upload_started_at IS NOT NULL'))


def downgrade():
    """降級：移除檔案資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('files') 