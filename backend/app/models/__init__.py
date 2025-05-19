"""
資料模型初始化檔案
此模組包含所有資料庫的 SQLModel 模型定義
"""
from app.models.user import User
from app.models.file import File, UploadStatus, ProcessingStatus
from app.models.sentence import Sentence, DefiningType
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.message_reference import MessageReference
from app.models.upload_chunk import UploadChunk

# 啟用所有模型的關聯定義
# 注意：update_forward_refs 在 Pydantic V2 中已棄用，但 SQLModel 依舊使用
# 當 SQLModel 更新兼容 Pydantic V2 後，應使用 model_rebuild 代替
User.update_forward_refs()
File.update_forward_refs()
Sentence.update_forward_refs()
Conversation.update_forward_refs()
Message.update_forward_refs()
MessageReference.update_forward_refs()
UploadChunk.update_forward_refs() 