# 後端架構文檔

## 1. 整體架構

本系統後端採用現代化架構設計，主要基於FastAPI和Celery構建。整體結構如下：

```
backend/
├── app/                            # 主應用目錄
│   ├── api/                        # API路由目錄
│   │   ├── endpoints/              # API端點實現
│   │   │   ├── auth.py             # 身份驗證相關路由
│   │   │   ├── files.py            # 檔案管理相關路由
│   │   │   ├── chat.py             # 聊天與問答功能路由
│   │   │   └── ws.py               # WebSocket路由
│   │   ├── dependencies.py         # API依賴項（認證等）
│   │   └── router.py               # API路由註冊
│   │
│   ├── core/                       # 核心配置
│   │   ├── config.py               # 全局配置
│   │   ├── security.py             # 安全相關功能
│   │   ├── events.py               # 應用啟動/關閉事件
│   │   └── errors.py               # 異常處理
│   │
│   ├── db/                         # 資料庫相關
│   │   ├── session.py              # 資料庫連接管理
│   │   ├── init_db.py              # 資料庫初始化
│   │   └── repositories/           # 資料庫操作封裝
│   │
│   ├── models/                     # SQLModel資料庫模型
│   ├── schemas/                    # Pydantic模型/響應模式
│   ├── services/                   # 業務邏輯服務
│   ├── tasks/                      # Celery任務
│   ├── utils/                      # 工具函數
│   ├── worker.py                   # Celery Worker配置
│   ├── beat.py                     # Celery Beat配置
│   └── main.py                     # 主應用入口
├── tests/                          # 測試目錄
├── Dockerfile                      # 後端主服務Dockerfile
├── Dockerfile.worker               # Celery Worker Dockerfile
├── Dockerfile.beat                 # Celery Beat Dockerfile
└── requirements.txt                # 依賴項
```

## 2. 技術棧

### 2.1 核心框架與語言
- **語言**: Python 3.10+
- **Web 框架**: FastAPI 0.95+
- **開發伺服器**: Uvicorn
- **生產伺服器**: Gunicorn
- **負載均衡**: Nginx (使用 upstream 模塊實現後端負載平衡)

### 2.2 任務處理與非同步
- **任務隊列**: Celery 5.2+
- **消息代理**: Redis 7.0+ (主從複製 + 哨兵模式)
- **狀態儲存**: Redis (用於儲存任務執行狀態和斷點續傳資訊)
- **併發控制**: Semaphore 和 Rate Limiter (限制外部 API 調用頻率)

### 2.3 資料庫與儲存
- **ORM**: SQLAlchemy 2.0+ (非同步引擎)
- **資料模型**: SQLModel (結合 SQLAlchemy 與 Pydantic)
- **關聯資料庫**: PostgreSQL 14+ (主從架構，讀寫分離)
- **物件儲存**: MinIO (S3 相容介面，分佈式部署)
- **快取層**: Redis 用於高頻訪問數據快取

## 3. 關鍵組件

### 3.1 FastAPI 應用
FastAPI 應用是後端系統的核心，負責處理所有的HTTP請求和WebSocket連接。主要功能包括：
- 使用者認證與授權
- 檔案上傳、管理與處理
- 聊天與問答服務
- 實時進度通知 (WebSocket)

### 3.2 Celery Worker
Celery Worker 負責處理所有長時間運行的非同步任務，例如：
- PDF文件解析與處理
- 調用外部AI API服務
- 分析句子並分類定義類型
- 生成回答與引用

### 3.3 Celery Beat
Celery Beat 負責定期執行計劃任務，例如：
- 清理過期的上傳記錄
- 同步檔案狀態
- 生成系統報告

### 3.4 PostgreSQL 資料庫
PostgreSQL資料庫用於存儲所有結構化數據，包括：
- 使用者資訊
- 檔案元數據
- 文檔句子及其分類結果
- 對話歷史記錄

### 3.5 MinIO 物件儲存
MinIO作為物件儲存服務，用於存儲：
- 原始PDF檔案
- 處理過程的中間文件
- 大型處理結果

### 3.6 Redis 服務
Redis用於多個目的：
- 作為Celery的消息代理
- 存儲任務狀態與進度
- 實現分布式鎖
- 快取頻繁訪問的數據

## 4. 資料流程

### 4.1 檔案上傳與處理流程
1. 用戶透過API上傳PDF檔案
2. 後端FastAPI服務接收檔案並存儲於MinIO
3. 創建檔案元數據並保存至PostgreSQL
4. 提交Celery任務處理檔案
5. Celery Worker處理檔案：
   - 調用PDF處理服務提取文本
   - 切分句子
   - 分類句子(概念型定義/操作型定義)
   - 更新進度到Redis
6. 處理結果保存到PostgreSQL
7. 實時進度通過WebSocket推送給前端

### 4.2 聊天與問答流程
1. 用戶發送問題
2. 後端提交Celery任務處理問題
3. Celery Worker：
   - 分析問題
   - 在資料庫中查找相關句子與定義
   - 調用外部AI API生成回答
   - 添加原文引用
4. 處理過程的進度透過WebSocket推送給前端
5. 最終結果保存到資料庫並返回給前端 