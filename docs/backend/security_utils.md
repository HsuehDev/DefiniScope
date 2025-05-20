# JWT 安全模組和 Redis 整合文檔

本文檔詳細介紹了 AI 文件分析與互動平台中使用的 JWT 安全模組及其與 Redis 的整合方式。

## 目錄
1. [概述](#概述)
2. [JWT 令牌管理](#jwt-令牌管理)
3. [Redis 整合](#redis-整合)
4. [安全機制](#安全機制)
5. [使用示例](#使用示例)

## 概述

JWT (JSON Web Token) 是一種基於 JSON 的開放標準，用於在網絡應用間安全地傳輸訊息。在本系統中，JWT 主要用於用戶身份驗證和授權。我們使用 Redis 來增強 JWT 安全性，實現以下功能：

- 令牌黑名單（用於登出和重置）
- JTI (JWT ID) 驗證（防止重放攻擊）
- 登入嘗試限制（防止暴力破解）

## JWT 令牌管理

### 令牌類型

系統使用兩種類型的令牌：

1. **訪問令牌 (Access Token)**：
   - 短期有效（默認 30 分鐘）
   - 用於進行 API 請求的身份驗證

2. **刷新令牌 (Refresh Token)**：
   - 長期有效（默認 7 天）
   - 用於獲取新的訪問令牌，避免用戶頻繁登入

### 令牌載荷結構

JWT 令牌包含以下關鍵字段：

```json
{
  "sub": "用戶唯一標識符",
  "exp": 1609459200,  // 過期時間 (Unix 時間戳)
  "iat": 1609455600,  // 簽發時間 (Unix 時間戳)
  "jti": "唯一令牌標識符",  // 用於黑名單和重放防護
  "type": "access"    // 或 "refresh"
}
```

### 令牌創建和驗證流程

1. **創建令牌**：
   - 生成唯一的 JTI (JWT ID)
   - 將 JTI 存儲在 Redis 中，設置與令牌相同的過期時間
   - 將用戶 ID、令牌類型、過期時間等信息編碼到 JWT 中
   - 使用系統密鑰簽名 JWT

2. **驗證令牌**：
   - 解碼 JWT 並驗證簽名
   - 檢查令牌是否過期
   - 檢查 JTI 是否在黑名單中
   - 檢查 JTI 是否有效（存在於 Redis 中）
   - 獲取對應的用戶信息

## Redis 整合

### Redis 客戶端連接池

系統使用 Redis 連接池來優化性能：

```python
def get_redis_client():
    """
    獲取 Redis 客戶端，使用連接池優化性能
    
    Returns:
        redis.Redis: Redis 客戶端實例
    """
    # ... 連接池邏輯 ...
```

### Redis 鍵命名慣例

系統使用以下命名慣例來組織 Redis 鍵：

- **JTI 記錄**：`token_jti:{jti}` - 用於存儲有效的 JTI
- **黑名單**：`token_blacklist:{jti}` - 用於存儲撤銷的令牌 JTI
- **登入嘗試**：`login_attempts:{email}` - 用於記錄用戶登入嘗試次數

### 自動過期設置

所有 Redis 鍵都設置了適當的過期時間：

- JTI 記錄：與對應令牌相同的過期時間
- 黑名單記錄：與被撤銷令牌剩餘的有效期相同
- 登入嘗試：根據系統配置設定的窗口期或鎖定時間

## 安全機制

### 登入嘗試限制

系統實現了登入嘗試限制機制，防止密碼暴力破解：

1. **檢查**：每次登入前檢查嘗試次數
   ```python
   await check_login_attempts(email)
   ```

2. **增加**：登入失敗時增加嘗試次數
   ```python
   await increment_login_attempts(email)
   ```

3. **重置**：登入成功時重置嘗試次數
   ```python
   await reset_login_attempts(email)
   ```

4. **限制邏輯**：
   - 第一次失敗：設置計數，過期時間為嘗試窗口期（默認 5 分鐘）
   - 達到限制次數：延長過期時間為帳戶鎖定時間（默認 15 分鐘）
   - 持續失敗：維持鎖定狀態

### 令牌黑名單

當用戶登出或管理員強制登出用戶時，系統會將對應的令牌加入黑名單：

```python
def add_token_to_blacklist(jti: str, expires_at: int) -> bool:
    """
    將令牌添加到黑名單
    
    Args:
        jti: JWT ID
        expires_at: 過期時間戳 (Unix 時間戳)
    """
    # ... 黑名單邏輯 ...
```

黑名單機制確保即使令牌在過期之前被截獲，也無法被使用。

### 防止重放攻擊

通過 JTI (JWT ID) 機制，系統防止令牌被重複使用：

1. 創建令牌時，生成唯一的 JTI 並存儲在 Redis 中
2. 驗證令牌時，檢查 JTI 是否存在於 Redis 中
3. 如果 Redis 中沒有對應的 JTI 記錄，則拒絕請求

## 使用示例

### 用戶登入流程

```python
# 1. 驗證用戶憑證
user = await authenticate_user(db, form_data.username, form_data.password)
if not user:
    # 增加登入嘗試次數
    await increment_login_attempts(form_data.username)
    raise HTTPException(...)

# 2. 登入成功，重置嘗試次數
await reset_login_attempts(form_data.username)

# 3. 創建訪問令牌和刷新令牌
access_token = create_access_token(subject=user.id)
refresh_token = create_refresh_token(subject=user.id)

# 4. 返回令牌
return {
    "access_token": access_token,
    "refresh_token": refresh_token,
    "token_type": "bearer"
}
```

### 令牌刷新流程

```python
# 1. 驗證刷新令牌
payload = jwt.decode(
    refresh_token,
    settings.JWT_SECRET_KEY,
    algorithms=[settings.JWT_ALGORITHM]
)
token_data = TokenPayload(**payload)

# 2. 驗證令牌類型
if token_data.type != "refresh":
    raise HTTPException(...)

# 3. 檢查令牌是否在黑名單中
if is_token_blacklisted(token_data.jti):
    raise HTTPException(...)

# 4. 檢查 JTI 是否有效
if not verify_jti(token_data.jti):
    raise HTTPException(...)

# 5. 把舊令牌加入黑名單
add_token_to_blacklist(token_data.jti, token_data.exp)

# 6. 創建新的訪問令牌
new_access_token = create_access_token(subject=token_data.sub)

# 7. 返回新令牌
return {
    "access_token": new_access_token,
    "token_type": "bearer"
}
```

### 用戶登出流程

```python
# 1. 從當前請求中獲取訪問令牌
payload = jwt.decode(
    token,
    settings.JWT_SECRET_KEY,
    algorithms=[settings.JWT_ALGORITHM]
)
token_data = TokenPayload(**payload)

# 2. 把訪問令牌加入黑名單
add_token_to_blacklist(token_data.jti, token_data.exp)

# 3. 如果提供了刷新令牌，也把它加入黑名單
if refresh_token:
    refresh_payload = jwt.decode(
        refresh_token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM]
    )
    refresh_token_data = TokenPayload(**refresh_payload)
    add_token_to_blacklist(refresh_token_data.jti, refresh_token_data.exp)

return {"message": "登出成功"}
``` 