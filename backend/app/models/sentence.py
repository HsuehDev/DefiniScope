"""
句子資料庫模型
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship


# 條件導入，避免循環引用
if TYPE_CHECKING:
    from app.models.user import User
    from app.models.file import File
    from app.models.message_reference import MessageReference


class DefiningType(str, Enum):
    """定義類型枚舉"""
    CD = "cd"  # 概念型定義
    OD = "od"  # 操作型定義
    NONE = "none"  # 非定義型句子


class Sentence(SQLModel, table=True):
    """
    句子資料表模型：儲存從PDF檔案中提取的句子及其分類結果
    """
    __tablename__ = "sentences"
    
    # 主鍵
    sentence_uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 外鍵關聯
    file_uuid: uuid.UUID = Field(foreign_key="files.file_uuid", index=True, nullable=False)
    user_uuid: uuid.UUID = Field(foreign_key="users.user_uuid", index=True, nullable=False)
    
    # 句子內容與分類
    sentence: str = Field(nullable=False)
    page: int = Field(nullable=False)
    defining_type: str = Field(max_length=10, default=DefiningType.NONE.value)
    reason: Optional[str] = Field(default=None)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    
    # 關聯
    file: "File" = Relationship(back_populates="sentences")
    user: "User" = Relationship(back_populates="sentences")
    message_references: List["MessageReference"] = Relationship(back_populates="sentence", sa_relationship_kwargs={"cascade": "all, delete"})
    
    # 資料表註釋與索引設定
    __table_args__ = {
        'comment': '句子資料表：儲存從PDF檔案中提取的句子及其分類結果'
    } 