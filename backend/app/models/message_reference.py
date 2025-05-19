"""
消息引用資料庫模型
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship, UniqueConstraint


# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.sentence import Sentence


class MessageReference(SQLModel, table=True):
    """
    消息引用資料表模型：儲存系統回應中引用的原文句子關聯
    """
    __tablename__ = "message_references"
    
    # 主鍵
    reference_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    message_uuid: uuid.UUID = Field(foreign_key="messages.message_uuid", index=True, nullable=False)
    sentence_uuid: uuid.UUID = Field(foreign_key="sentences.sentence_uuid", index=True, nullable=False)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    
    # 關聯
    message: "Message" = Relationship(back_populates="references")
    sentence: "Sentence" = Relationship(back_populates="message_references")
    
    # 資料表註釋與索引設定
    __table_args__ = (
        UniqueConstraint("message_uuid", "sentence_uuid", name="uq_message_sentence"),
        {"comment": "消息引用資料表：儲存系統回應中引用的原文句子關聯"}
    ) 