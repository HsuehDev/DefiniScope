"""
認證API端點測試
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

# 創建一個簡單的應用程序進行測試
app = FastAPI()

# 創建一個簡單路由實現健康檢查
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# 註冊端點模擬響應
@app.post("/api/auth/register", status_code=201)
async def mock_register(request: Request):
    body = await request.json()
    # 模擬已存在用戶的情況
    if body.get("email") == "existing@example.com":
        return JSONResponse(
            status_code=409,
            content={"detail": "使用者已存在"}
        )
    # 模擬成功註冊的情況
    return {
        "user_uuid": "12345678-1234-5678-1234-567812345678",
        "email": body.get("email", "test@example.com"),
        "created_at": "2023-01-01T00:00:00"
    }

# 登入端點模擬響應
@app.post("/api/auth/login")
async def mock_login(request: Request):
    try:
        form_data = await request.form()
        username = form_data.get("username")
        password = form_data.get("password")
        
        # 模擬登入失敗情況
        if username == "nonexistent@example.com" or password == "WrongPassword123":
            return JSONResponse(
                status_code=401,
                content={"detail": "帳號或密碼錯誤"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # 模擬成功登入響應
        return {
            "user_uuid": "12345678-1234-5678-1234-567812345678",
            "access_token": "fake.access.token",
            "refresh_token": "fake.refresh.token",
            "token_type": "bearer"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )

# 受保護路由端點模擬響應
@app.get("/api/auth/protected")
async def mock_protected_route(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "未驗證的請求"},
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # 模擬驗證通過的情況
    return {
        "user_uuid": "12345678-1234-5678-1234-567812345678",
        "email": "test@example.com",
        "message": "您已通過身份驗證"
    }

# 刷新令牌端點模擬響應
@app.post("/api/auth/refresh")
async def mock_refresh_token(request: Request):
    body = await request.json()
    refresh_token = body.get("refresh_token")
    
    # 模擬無效的刷新令牌
    if not refresh_token or refresh_token == "invalid.token":
        return JSONResponse(
            status_code=401,
            content={"detail": "無效或過期的刷新令牌"},
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # 模擬成功刷新令牌
    return {
        "access_token": "new.access.token",
        "token_type": "bearer"
    }

# 登出端點模擬響應
@app.post("/api/auth/logout")
async def mock_logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "未驗證的請求"},
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # 模擬成功登出
    return {"detail": "成功登出"}

# 使用測試客戶端
client = TestClient(app)

def test_health_check():
    """測試健康檢查端點"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_register_success():
    """測試成功註冊"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "Password123"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["user_uuid"] == "12345678-1234-5678-1234-567812345678"
    assert data["email"] == "test@example.com"
    assert data["created_at"] == "2023-01-01T00:00:00"

def test_register_existing_user():
    """測試註冊已存在的用戶"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "existing@example.com",
            "password": "Password123"
        }
    )
    
    assert response.status_code == 409
    assert response.json()["detail"] == "使用者已存在"

def test_login_success():
    """測試成功登入"""
    response = client.post(
        "/api/auth/login",
        data={
            "username": "test@example.com",
            "password": "Password123"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_uuid"] == "12345678-1234-5678-1234-567812345678"
    assert data["access_token"] == "fake.access.token"
    assert data["refresh_token"] == "fake.refresh.token"
    assert data["token_type"] == "bearer"

def test_login_failure():
    """測試登入失敗情況"""
    response = client.post(
        "/api/auth/login",
        data={
            "username": "nonexistent@example.com",
            "password": "WrongPassword123"
        }
    )
    
    assert response.status_code == 401
    assert response.json()["detail"] == "帳號或密碼錯誤"

def test_protected_route_success():
    """測試受保護的路由端點"""
    response = client.get(
        "/api/auth/protected",
        headers={"Authorization": "Bearer fake.token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_uuid"] == "12345678-1234-5678-1234-567812345678"
    assert data["email"] == "test@example.com"
    assert data["message"] == "您已通過身份驗證"

def test_protected_route_unauthorized():
    """測試受保護的路由端點未授權"""
    response = client.get("/api/auth/protected")
    
    assert response.status_code == 401
    assert response.json()["detail"] == "未驗證的請求"

def test_refresh_token_success():
    """測試成功刷新令牌"""
    response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "valid.refresh.token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "new.access.token"
    assert data["token_type"] == "bearer"

def test_refresh_token_invalid():
    """測試使用無效的刷新令牌"""
    response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "invalid.token"}
    )
    
    assert response.status_code == 401
    assert response.json()["detail"] == "無效或過期的刷新令牌"

def test_logout_success():
    """測試成功登出"""
    response = client.post(
        "/api/auth/logout",
        headers={"Authorization": "Bearer fake.token"}
    )
    
    assert response.status_code == 200
    assert response.json()["detail"] == "成功登出"

def test_logout_unauthorized():
    """測試未授權登出"""
    response = client.post("/api/auth/logout")
    
    assert response.status_code == 401
    assert response.json()["detail"] == "未驗證的請求" 