# 認證模組開發者指南

本文件提供關於認證模組的詳細說明，包括模組架構、關鍵組件、使用方法和擴展指南。

## 1. 模組概述

認證模組提供使用者註冊、登入、登出和令牌刷新功能，採用JWT (JSON Web Token) 作為認證機制。

### 1.1 主要功能

- 使用者註冊
- 使用者登入與令牌發放
- 令牌刷新
- 使用者登出
- 受保護資源的訪問控制

### 1.2 檔案結構

```
backend/app/
├── api/
│   └── endpoints/
│       └── auth.py         # 認證API端點
├── models/
│   └── user.py             # 使用者資料模型
├── schemas/
│   └── auth.py             # 認證相關Pydantic模式
└── utils/
    └── security.py         # 安全相關工具函數
```

## 2. 關鍵組件說明

### 2.1 使用者模型 (User Model)

使用者資料模型定義於 `app/models/user.py`，包含以下主要欄位：
- `user_uuid`: UUID，主鍵
- `email`: 使用者電子郵件，唯一
- `password_hash`: 經過BCrypt雜湊的密碼
- `created_at`: 創建時間
- `updated_at`: 最後更新時間
- `last_login_at`: 最後登入時間

### 2.2 Pydantic 驗證模式

認證相關的請求和回應模式定義於 `app/schemas/auth.py`：

- `UserRegisterRequest`: 註冊請求，包含email和password
- `UserRegisterResponse`: 註冊回應，包含user_uuid、email和created_at
- `UserLoginRequest`: 登入請求，包含email和password
- `UserLoginResponse`: 登入回應，包含user_uuid、access_token、refresh_token和token_type
- `RefreshTokenRequest`: 令牌刷新請求，包含refresh_token
- `RefreshTokenResponse`: 令牌刷新回應，包含新的access_token和token_type
- `TokenPayload`: JWT載荷結構，包含sub、exp、iat和type等欄位

### 2.3 安全工具函數

安全相關的工具函數定義於 `app/utils/security.py`：

- `hash_password()`: 使用BCrypt對密碼進行雜湊
- `verify_password()`: 驗證密碼是否匹配
- `create_access_token()`: 創建JWT access token
- `create_refresh_token()`: 創建JWT refresh token
- `get_current_user()`: 從JWT獲取當前用戶，用於依賴注入

### 2.4 API端點

認證API端點定義於 `app/api/endpoints/auth.py`：

- `POST /api/auth/register`: 用戶註冊
- `POST /api/auth/login`: 用戶登入
- `POST /api/auth/refresh`: 刷新訪問令牌
- `POST /api/auth/logout`: 用戶登出

## 3. 使用方法

### 3.1 保護API端點

使用 `get_current_user` 依賴注入來保護API端點：

```python
from app.utils.security import get_current_user
from app.models.user import User

@router.get("/protected-resource")
async def get_protected_resource(current_user: User = Depends(get_current_user)):
    # 只有通過身份驗證的用戶才能訪問
    return {"message": "這是受保護的資源", "user_email": current_user.email}
```

### 3.2 取得當前用戶信息

可以使用 `get_current_user` 獲取當前通過身份驗證的用戶：

```python
@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "user_uuid": current_user.user_uuid,
        "email": current_user.email,
        "created_at": current_user.created_at
    }
```

### 3.3 使用令牌進行API調用

客戶端應在請求標頭中包含 Bearer 令牌：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

## 4. 擴展指南

### 4.1 添加社交媒體登入

若要添加社交媒體登入 (如Google、Facebook)，可擴展模組如下：

1. 在 `app/schemas/auth.py` 添加社交登入請求模式：

```python
class SocialLoginRequest(BaseModel):
    """社交登入請求"""
    provider: str  # "google", "facebook" 等
    access_token: str  # 社交平台提供的令牌
```

2. 在 `app/api/endpoints/auth.py` 添加社交登入端點：

```python
@router.post("/social-login", response_model=UserLoginResponse)
async def social_login(login_data: SocialLoginRequest, db: AsyncSession = Depends(get_db)):
    # 實現社交登入邏輯
    pass
```

### 4.2 實現令牌黑名單

使用Redis實現令牌黑名單：

1. 添加Redis連接：

```python
import redis
from app.core.config import settings

redis_client = redis.Redis.from_url(settings.REDIS_URL)
```

2. 在登出時將refresh_token加入黑名單：

```python
def add_token_to_blacklist(token: str, expires_delta: int):
    """將令牌加入黑名單，並設置過期時間"""
    redis_client.setex(f"blacklist:{token}", expires_delta, "1")

def is_token_blacklisted(token: str) -> bool:
    """檢查令牌是否在黑名單中"""
    return redis_client.exists(f"blacklist:{token}") == 1
```

3. 在令牌驗證流程中檢查黑名單。

### 4.3 添加電子郵件驗證

為新用戶實現電子郵件驗證流程：

1. 在用戶模型中添加 `is_verified` 欄位
2. 在註冊流程中生成驗證令牌並發送驗證郵件
3. 添加電子郵件驗證端點

## 5. 安全注意事項

- 所有密碼都應使用BCrypt進行雜湊，永遠不要存儲明文密碼
- JWT 密鑰應安全存儲並定期輪換
- 對敏感端點 (如登入) 實施速率限制，防止暴力攻擊
- 使用HTTPS加密所有API通信
- 實施CSRF和XSS防護
- 令牌有效期應適當設置，平衡安全性和使用者體驗
- 定期審計授權邏輯，確保沒有越權訪問

## 6. 未來改進

- 實現雙因素認證 (2FA)
- 改進密碼重置流程
- 添加登入嘗試監控和自動鎖定
- 實現更細粒度的權限控制 (基於角色或權限)
- 支持設備管理和多設備登入控制 