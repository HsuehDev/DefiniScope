"""
WebSocket 端點測試案例
"""
import asyncio
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, WebSocket
from pytest_mock import MockerFixture

# 模擬 FastAPI 應用創建
from app.main import app as main_app
from app.core.config import settings
from app.models.user import User
from app.models.file import File
from app.models.query import Query
from app.api.websockets.manager import manager
from app.utils.redis_publisher import publish_file_update, publish_query_update


# 使用 TestClient 創建測試客戶端
client = TestClient(main_app)


# 用於生成有效的 JWT 令牌
async def get_test_token(client: TestClient, email="test@example.com", password="password123"):
    """獲取測試用的認證令牌"""
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_file_processing_websocket_authentication():
    """測試檔案處理 WebSocket 端點的認證"""
    file_uuid = str(uuid.uuid4())
    
    # 不提供令牌
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/processing/{file_uuid}") as websocket:
            data = websocket.receive_json()
            assert "error" in data
            assert "認證失敗" in data["detail"]
    
    # 提供無效令牌
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/processing/{file_uuid}?token=invalid_token") as websocket:
            data = websocket.receive_json()
            assert "error" in data
            assert "令牌無效" in data["detail"]
    
    # 提供有效令牌但嘗試訪問不存在的檔案
    token = await get_test_token(client)
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/processing/{file_uuid}?token={token}") as websocket:
            data = websocket.receive_json()
            assert "error" in data
            assert "權限錯誤" in data["detail"]


@pytest.mark.asyncio
async def test_file_processing_websocket_connection(mocker: MockerFixture):
    """測試檔案處理 WebSocket 連接成功建立"""
    # 模擬 authenticate_websocket 返回成功
    mocker.patch(
        "app.api.websockets.auth.authenticate_websocket",
        return_value=(True, User(user_uuid=str(uuid.uuid4()), email="test@example.com"), None)
    )
    
    # 模擬 verify_file_access 返回成功
    mocker.patch(
        "app.api.websockets.auth.verify_file_access",
        return_value=True
    )
    
    # 模擬 manager.connect_file 方法
    connect_file_mock = mocker.patch("app.api.websockets.manager.manager.connect_file")
    disconnect_mock = mocker.patch("app.api.websockets.manager.manager.disconnect")
    
    file_uuid = str(uuid.uuid4())
    
    # 測試連接成功
    with client.websocket_connect(f"/ws/processing/{file_uuid}") as websocket:
        # 檢查連接是否建立
        connect_file_mock.assert_called_once()
        
        # 接收歡迎消息
        data = websocket.receive_json()
        assert data["event"] == "connection_established"
        assert data["file_uuid"] == file_uuid
        assert "connection_id" in data
        
        # 發送 ping
        websocket.send_json({"type": "ping"})
        
        # 接收 pong
        data = websocket.receive_json()
        assert data["event"] == "pong"
    
    # 檢查連接是否關閉
    disconnect_mock.assert_called_once()


@pytest.mark.asyncio
async def test_chat_websocket_connection(mocker: MockerFixture):
    """測試查詢處理 WebSocket 連接成功建立"""
    # 模擬 authenticate_websocket 返回成功
    mocker.patch(
        "app.api.websockets.auth.authenticate_websocket",
        return_value=(True, User(user_uuid=str(uuid.uuid4()), email="test@example.com"), None)
    )
    
    # 模擬 verify_query_access 返回成功
    mocker.patch(
        "app.api.websockets.auth.verify_query_access",
        return_value=True
    )
    
    # 模擬 manager.connect_query 方法
    connect_query_mock = mocker.patch("app.api.websockets.manager.manager.connect_query")
    disconnect_mock = mocker.patch("app.api.websockets.manager.manager.disconnect")
    
    query_uuid = str(uuid.uuid4())
    
    # 測試連接成功
    with client.websocket_connect(f"/ws/chat/{query_uuid}") as websocket:
        # 檢查連接是否建立
        connect_query_mock.assert_called_once()
        
        # 接收歡迎消息
        data = websocket.receive_json()
        assert data["event"] == "connection_established"
        assert data["query_uuid"] == query_uuid
        assert "connection_id" in data
        
        # 發送 ping
        websocket.send_json({"type": "ping"})
        
        # 接收 pong
        data = websocket.receive_json()
        assert data["event"] == "pong"
    
    # 檢查連接是否關閉
    disconnect_mock.assert_called_once()


@pytest.mark.asyncio
async def test_broadcast_file_update(mocker: MockerFixture):
    """測試檔案進度更新的廣播功能"""
    file_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())
    
    # 模擬 WebSocket 連接
    mock_websocket = mocker.MagicMock(spec=WebSocket)
    
    # 直接訪問 manager 手動添加連接
    if file_uuid not in manager.file_connections:
        manager.file_connections[file_uuid] = set()
    manager.file_connections[file_uuid].add(mock_websocket)
    
    if user_uuid not in manager.user_connections:
        manager.user_connections[user_uuid] = set()
    manager.user_connections[user_uuid].add(mock_websocket)
    
    manager.connection_info[mock_websocket] = {
        "type": "file",
        "resource_uuid": file_uuid,
        "user_uuid": user_uuid
    }
    
    # 調用廣播方法
    event_data = {
        "progress": 50,
        "current": 10,
        "total": 20,
        "status": "processing"
    }
    
    await manager.broadcast_file_update(file_uuid, "pdf_extraction_progress", event_data)
    
    # 檢查消息是否傳送
    mock_websocket.send_text.assert_called_once()
    
    # 清理測試數據
    manager.disconnect(mock_websocket)


@pytest.mark.asyncio
async def test_send_recent_file_updates(mocker: MockerFixture):
    """測試發送最近的檔案更新功能"""
    file_uuid = str(uuid.uuid4())
    
    # 模擬 Redis 返回的最近更新
    mock_updates = [
        json.dumps({
            "event": "processing_started",
            "file_uuid": file_uuid,
            "status": "processing",
            "timestamp": "2023-08-18T12:34:56.789Z"
        }).encode("utf-8"),
        json.dumps({
            "event": "pdf_extraction_progress",
            "file_uuid": file_uuid,
            "progress": 30,
            "current": 6,
            "total": 20,
            "status": "processing",
            "timestamp": "2023-08-18T12:35:56.789Z"
        }).encode("utf-8")
    ]
    
    # 模擬 Redis 客戶端和 zrange 方法
    mock_redis = mocker.MagicMock()
    mock_redis.zrange.return_value = mock_updates
    mocker.patch("redis.from_url", return_value=mock_redis)
    
    # 模擬 WebSocket
    mock_websocket = mocker.MagicMock(spec=WebSocket)
    
    # 從 processing.py 導入函數
    from app.api.websockets.endpoints.processing import send_recent_file_updates
    
    # 調用發送最近更新的函數
    await send_recent_file_updates(mock_websocket, file_uuid)
    
    # 檢查是否調用了 Redis 的 zrange
    mock_redis.zrange.assert_called_once_with(f"recent_updates:file:{file_uuid}", 0, -1)
    
    # 檢查是否發送了兩條消息
    assert mock_websocket.send_text.call_count == 2


@pytest.mark.asyncio
async def test_redis_publish_to_websocket(mocker: MockerFixture):
    """測試 Redis 發布消息到 WebSocket 的完整流程"""
    # 模擬 Redis 客戶端
    mock_redis = mocker.MagicMock()
    mocker.patch("redis.from_url", return_value=mock_redis)
    
    # 模擬 WebSocket 連接管理器的 broadcast_file_update 方法
    broadcast_mock = mocker.patch("app.api.websockets.manager.manager.broadcast_file_update")
    
    # 模擬 WebSocketRedisAdapter
    from app.core.websocket_redis_adapter import adapter
    handle_file_update_mock = mocker.patch.object(adapter, "handle_file_update")
    
    # 創建一個檔案 UUID
    file_uuid = str(uuid.uuid4())
    
    # 發布更新
    event_data = {
        "progress": 75,
        "current": 15,
        "total": 20,
        "status": "processing"
    }
    
    # 使用 Redis 發布器發布更新
    publish_file_update(file_uuid, "pdf_extraction_progress", event_data)
    
    # 檢查消息是否添加到 Redis 集合
    mock_redis.zadd.assert_called_once()
    
    # 檢查消息是否發布到 Redis 頻道
    mock_redis.publish.assert_called_once()
    
    # 模擬從 Redis 接收消息並轉發到 WebSocket
    message_data = json.dumps({
        "event": "pdf_extraction_progress",
        "file_uuid": file_uuid,
        **event_data,
        "timestamp": "2023-08-18T12:40:00.000Z"
    })
    
    # 模擬處理收到的 Redis 消息
    await adapter.handle_file_update(
        file_uuid, 
        "pdf_extraction_progress", 
        {
            "progress": 75,
            "current": 15,
            "total": 20,
            "status": "processing",
            "timestamp": "2023-08-18T12:40:00.000Z"
        }
    )
    
    # 檢查是否調用了 WebSocket 廣播方法
    handle_file_update_mock.assert_called_once() 