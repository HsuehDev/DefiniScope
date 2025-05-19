# AI文件分析與互動平台 - 後端服務

本專案為AI文件分析與互動平台的後端服務，基於FastAPI開發，提供PDF文件管理、文字處理與分析、智能問答等功能。

## 技術架構

- **主框架**: FastAPI + SQLModel + PostgreSQL
- **非同步任務**: Celery + Redis
- **物件儲存**: MinIO
- **容器化**: Docker + Docker Compose

## 目錄結構

```
backend/
├── app/                            # 主應用目錄
│   ├── api/                        # API路由目錄
│   ├── core/                       # 核心配置
│   ├── db/                         # 資料庫相關
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

## 安裝與運行

### 使用Docker Compose (推薦)

1. 確保安裝了Docker和Docker Compose
2. 從專案根目錄運行：
   ```bash
   docker-compose up -d
   ```
3. 訪問API文檔：http://localhost:8000/api/docs

### 開發環境設置

1. 創建虛擬環境：
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. 安裝依賴：
   ```bash
   pip install -r requirements.txt
   ```

3. 啟動開發服務器：
   ```bash
   uvicorn app.main:app --reload
   ```

## 環境變數

主要環境變數說明：

- `DATABASE_URL`: PostgreSQL連接字串
- `MINIO_URL`: MinIO服務地址
- `MINIO_ACCESS_KEY`: MinIO存取金鑰
- `MINIO_SECRET_KEY`: MinIO存取密鑰
- `REDIS_URL`: Redis連接字串
- `PDF_SPLITTER_URL`: PDF切分服務地址
- `MAX_WORKERS`: 最大工作執行緒數
- `CONCURRENCY_LIMIT`: 最大併發數
- `UPLOAD_TIMEOUT_MINUTES`: 上傳超時時間(分鐘)

完整的環境變數列表請參考`app/core/config.py`文件。 