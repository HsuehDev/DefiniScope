"""
創建使用者資料表

Revision ID: 001_create_users_table
Revises: 
Create Date: 2023-05-10 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '001_create_users_table'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建使用者資料表和相關索引"""
    # 創建使用者資料表
    op.create_table(
        'users',
        sa.Column('user_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.TIMESTAMP(timezone=True), nullable=True),
        
        # 唯一約束
        sa.UniqueConstraint('email', name='uq_users_email'),
        
        # 資料表註釋
        sa.Comment('使用者資料表：儲存系統使用者的帳戶資訊和認證資料')
    )
    
    # 建立索引
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_last_login_at', 'users', ['last_login_at'])


def downgrade():
    """降級：移除使用者資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('users') 