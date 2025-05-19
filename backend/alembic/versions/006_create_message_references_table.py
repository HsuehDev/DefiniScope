"""
創建消息引用資料表

Revision ID: 006_create_message_references_table
Revises: 005_create_messages_table
Create Date: 2023-05-10 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic
revision = '006_create_message_references_table'
down_revision = '005_create_messages_table'
branch_labels = None
depends_on = None


def upgrade():
    """升級：創建消息引用資料表和相關索引"""
    # 創建消息引用資料表
    op.create_table(
        'message_references',
        sa.Column('reference_uuid', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('message_uuid', UUID(as_uuid=True), sa.ForeignKey('messages.message_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('sentence_uuid', UUID(as_uuid=True), sa.ForeignKey('sentences.sentence_uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        
        # 唯一約束
        sa.UniqueConstraint('message_uuid', 'sentence_uuid', name='uq_message_sentence'),
        
        # 資料表註釋
        sa.Comment('消息引用資料表：儲存系統回應中引用的原文句子關聯')
    )
    
    # 建立索引
    op.create_index('idx_message_references_message_uuid', 'message_references', ['message_uuid'])
    op.create_index('idx_message_references_sentence_uuid', 'message_references', ['sentence_uuid'])


def downgrade():
    """降級：移除消息引用資料表"""
    # 移除資料表 (會自動移除相關的索引和約束)
    op.drop_table('message_references')