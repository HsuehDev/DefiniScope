"""
創建句子資料表

Revision ID: 003_create_sentences_table
Revises: 002_create_files_table
Create Date: 2023-05-10 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '003_create_sentences_table'
down_revision = '002_create_files_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建句子資料表和相關索引"""
    # 創建句子資料表
    op.create_table(
        'sentences',
        sa.Column('sentence_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('file_uuid', UUID(as_uuid=True), sa.ForeignKey('files.file_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), sa.ForeignKey('users.user_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('sentence', sa.Text(), nullable=False),
        sa.Column('page', sa.Integer(), nullable=False),
        sa.Column('defining_type', sa.String(10), server_default='none'),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        
        # 約束
        sa.CheckConstraint("page > 0", name='check_positive_page'),
        sa.CheckConstraint(
            "defining_type IN ('cd', 'od', 'none')",
            name='check_valid_defining_type'
        ),
        
        # 資料表註釋
        sa.Comment('句子資料表：儲存從PDF檔案中提取的句子及其分類結果')
    )
    
    # 建立索引
    op.create_index('idx_sentences_file_uuid', 'sentences', ['file_uuid'])
    op.create_index('idx_sentences_user_uuid', 'sentences', ['user_uuid'])
    op.create_index('idx_sentences_defining_type', 'sentences', ['defining_type'])
    op.create_index('idx_sentences_page', 'sentences', ['page'])
    op.create_index('idx_sentences_user_file', 'sentences', ['user_uuid', 'file_uuid'])
    op.create_index('idx_sentences_user_defining_type', 'sentences', ['user_uuid', 'defining_type'])
    
    # 建立全文搜尋索引 (PostgreSQL特有)
    op.execute(
        'CREATE INDEX idx_sentences_sentence_tsv ON sentences USING GIN (to_tsvector(\'chinese\', sentence))'
    )


def downgrade():
    """降級：移除句子資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('sentences') 