# 資料庫設計文檔

## 1. 資料庫概述

本系統使用PostgreSQL作為主要關聯式資料庫，用於儲存所有結構化數據。資料模型設計使用SQLModel (基於SQLAlchemy和Pydantic)，支援非同步操作。

## 2. 主要資料表

### 2.1 使用者資料表 (users)

儲存使用者帳號資訊。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，使用者唯一標識 |
| email | VARCHAR | 電子郵件地址，唯一 |
| hashed_password | VARCHAR | 經過哈希的密碼 |
| full_name | VARCHAR | 使用者全名 (選填) |
| is_active | BOOLEAN | 帳號是否啟用 |
| is_verified | BOOLEAN | 電子郵件是否已驗證 |
| created_at | TIMESTAMP | 創建時間 |
| updated_at | TIMESTAMP | 最後更新時間 |
| last_login | TIMESTAMP | 最後登入時間 |

**索引**:
- `email` (唯一索引)
- `created_at` (普通索引)

### 2.2 檔案資料表 (files)

儲存上傳的PDF檔案元數據。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，檔案唯一標識 |
| user_uuid | UUID | 外鍵，關聯使用者 |
| original_name | VARCHAR | 原始檔案名 |
| size_bytes | BIGINT | 檔案大小 (位元組) |
| mime_type | VARCHAR | 檔案MIME類型 |
| minio_bucket_name | VARCHAR | MinIO儲存桶名稱 |
| minio_object_key | VARCHAR | MinIO物件鍵值 |
| upload_status | ENUM | 上傳狀態: pending, uploading, completed, failed, expired |
| processing_status | ENUM | 處理狀態: pending, extracting, splitting, classifying, completed, failed |
| error_message | TEXT | 錯誤訊息 (如有) |
| sentence_count | INTEGER | 句子總數 |
| cd_count | INTEGER | 概念型定義數量 |
| od_count | INTEGER | 操作型定義數量 |
| upload_id | VARCHAR | 分片上傳ID |
| chunk_total | INTEGER | 分片總數 |
| chunks_received | INTEGER | 已接收分片數 |
| created_at | TIMESTAMP | 創建時間 |
| updated_at | TIMESTAMP | 最後更新時間 |

**索引**:
- `user_uuid` (普通索引)
- `created_at` (普通索引)
- `upload_status, processing_status` (聯合索引)

### 2.3 句子資料表 (sentences)

儲存從PDF中提取的句子與它們的分類結果。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，句子唯一標識 |
| file_uuid | UUID | 外鍵，關聯檔案 |
| user_uuid | UUID | 外鍵，關聯使用者 |
| content | TEXT | 句子內容 |
| page_number | INTEGER | 頁碼 |
| position | INTEGER | 在文件中的位置順序 |
| sentence_type | ENUM | 句子類型: regular, cd, od |
| confidence_score | FLOAT | 分類信心分數 (0-1) |
| keywords | JSONB | 關鍵詞列表 |
| created_at | TIMESTAMP | 創建時間 |
| updated_at | TIMESTAMP | 最後更新時間 |

**索引**:
- `file_uuid` (普通索引)
- `user_uuid` (普通索引)
- `sentence_type` (普通索引)
- `content` (文本索引, GIN)
- `keywords` (JSONB索引, GIN)

### 2.4 聊天資料表 (chats)

儲存使用者的聊天會話資訊。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，聊天唯一標識 |
| user_uuid | UUID | 外鍵，關聯使用者 |
| title | VARCHAR | 聊天標題 |
| created_at | TIMESTAMP | 創建時間 |
| updated_at | TIMESTAMP | 最後更新時間 |

**索引**:
- `user_uuid` (普通索引)
- `created_at` (普通索引)

### 2.5 消息資料表 (messages)

儲存聊天中的每條消息。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，消息唯一標識 |
| chat_uuid | UUID | 外鍵，關聯聊天 |
| user_uuid | UUID | 外鍵，關聯使用者 |
| content | TEXT | 消息內容 |
| role | ENUM | 角色: user, assistant |
| created_at | TIMESTAMP | 創建時間 |

**索引**:
- `chat_uuid` (普通索引)
- `user_uuid` (普通索引)
- `created_at` (普通索引)

### 2.6 引用資料表 (references)

儲存AI回答中引用的原文句子。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，引用唯一標識 |
| message_uuid | UUID | 外鍵，關聯消息 |
| sentence_uuid | UUID | 外鍵，關聯句子 |
| relevance_score | FLOAT | 相關性分數 (0-1) |
| created_at | TIMESTAMP | 創建時間 |

**索引**:
- `message_uuid` (普通索引)
- `sentence_uuid` (普通索引)

### 2.7 檔案-聊天關聯表 (file_chat_associations)

建立檔案與聊天之間的多對多關係。

| 欄位 | 類型 | 說明 |
|------|------|------|
| uuid | UUID | 主鍵，關聯唯一標識 |
| file_uuid | UUID | 外鍵，關聯檔案 |
| chat_uuid | UUID | 外鍵，關聯聊天 |
| created_at | TIMESTAMP | 創建時間 |

**索引**:
- `file_uuid, chat_uuid` (唯一聯合索引)

## 3. 資料庫關係圖

```
                  ┌─────────────┐
                  │    users    │
                  └──────┬──────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼───┐      ┌────▼───┐      ┌────▼───┐
    │  files  │      │  chats  │      │sentences│
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                │
         │          ┌─────▼────┐           │
         │          │ messages │           │
         │          └─────┬────┘           │
         │                │                │
         │          ┌─────▼────┐           │
         │          │references│◄──────────┘
         │          └──────────┘
         │
    ┌────▼────────────┐
    │file_chat_assocs │
    └─────────────────┘
```

## 4. 資料庫遷移

系統使用Alembic進行資料庫遷移管理，並遵循以下原則：

1. 所有資料表變更都通過遷移腳本執行
2. 遷移腳本需提供向前和向後遷移的功能
3. 每個遷移腳本都有明確的註釋說明變更內容
4. 使用UUID作為所有資料表的主鍵
5. 為頻繁查詢的欄位建立適當的索引

## 5. 資料庫ORM模型

以下是一個典型的SQLModel模型示例：

```python
class User(SQLModel, table=True):
    """
    使用者資料表模型
    """
    __tablename__ = "users"
    
    # 主鍵，使用UUID代替自增ID
    uuid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    
    # 用戶認證資訊
    email: EmailStr = Field(index=True, unique=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    
    # 用戶個人資訊
    full_name: Optional[str] = Field(default=None)
    
    # 狀態資訊
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_login: Optional[datetime] = Field(default=None)
    
    # 關聯
    files: List["File"] = Relationship(back_populates="user")
    chats: List["Chat"] = Relationship(back_populates="user")
```

## 6. 資料庫存取層

系統使用Repository模式封裝資料庫操作，主要優點包括：

1. 將資料庫操作邏輯從業務邏輯中分離
2. 便於單元測試和模擬
3. 提供一致的資料庫訪問介面
4. 減少重複代碼

示例Repository實現：

```python
class UserRepository:
    """用戶資料庫操作封裝"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_uuid(self, uuid: uuid.UUID) -> Optional[User]:
        """通過UUID獲取用戶"""
        stmt = select(User).where(User.uuid == uuid)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """通過電子郵件獲取用戶"""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def create(self, user_create: UserCreate) -> User:
        """創建新用戶"""
        user = User(
            email=user_create.email,
            hashed_password=user_create.hashed_password,
            full_name=user_create.full_name
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
        
    # 其他CRUD操作
```

## 7. 資料庫效能優化

1. **索引策略**:
   - 為所有外鍵和頻繁查詢的欄位建立索引
   - 使用GIN索引支援全文搜索和JSONB查詢
   - 為複合查詢條件建立聯合索引

2. **讀寫分離**:
   - 使用PostgreSQL主從架構
   - 讀取操作路由到從庫
   - 寫入操作只在主庫執行

3. **分頁和分批處理**:
   - 所有列表查詢都實現分頁
   - 大批量操作使用分批處理

4. **連接池管理**:
   - 根據負載動態調整連接池大小
   - 設置連接超時和最大連接數
   - 監控連接使用情況 