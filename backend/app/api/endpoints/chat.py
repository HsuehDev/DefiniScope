"""
聊天與問答相關端點
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from uuid import UUID
from typing import List, Optional
import logging

from app.core.config import settings
from app.db.session import get_db
from app.models.query import QueryCreate, QueryResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# 這裡只是一個空檔案架構，實際的完整實現會更複雜
# 但這個檔案的存在可以讓我們的 WebSocket 相關程式碼能夠匯入 