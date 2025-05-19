# Docker 容器化部署文檔

## 1. 容器組織結構

本系統採用 Docker 容器化部署，每個主要組件都有專屬的容器。整體結構如下：

```
├── backend
│   ├── Dockerfile               # 主後端服務
│   ├── Dockerfile.worker        # Celery 工作節點
│   └── Dockerfile.beat          # Celery 定時任務
├── split_sentences
│   └── Dockerfile               # split_sentences 服務
├── frontend
│   └── Dockerfile               # 前端應用
├── nginx
│   ├── Dockerfile               # Web 伺服器
│   └── conf                     # Nginx 配置
├── postgres
│   └── init                     # 初始化腳本
└── minio
    └── config                   # MinIO 配置
```

## 2. Docker Compose 配置

系統使用 Docker Compose 進行整合部署，以下是主要服務的配置：

```yaml
version: '3.8'
services:
  # 後端API服務
  backend:
    build: .
    deploy:
      replicas: 4
      resources:
        limits:
          cpus: '1'
          memory: 1G
    depends_on:
      - postgres_master
      - redis_master
      - minio
      - pdf_sentence_splitter
    environment:
      - DATABASE_URL=postgresql://user:password@postgres_master:5432/app
      - MINIO_URL=minio:9000
      - MINIO_ACCESS_KEY=minioaccess
      - MINIO_SECRET_KEY=miniosecret
      - REDIS_URL=redis://redis_master:6379/0
      - PDF_SPLITTER_URL=http://pdf_sentence_splitter:8000
      - MAX_WORKERS=8
      - CONCURRENCY_LIMIT=60
      - UPLOAD_TIMEOUT_MINUTES=10
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  # Celery Worker服務
  celery_worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '1'
          memory: 1G
    depends_on:
      - redis_master
      - postgres_master
      - minio
      - pdf_sentence_splitter
    environment:
      - DATABASE_URL=postgresql://user:password@postgres_master:5432/app
      - MINIO_URL=minio:9000
      - MINIO_ACCESS_KEY=minioaccess
      - MINIO_SECRET_KEY=miniosecret
      - REDIS_URL=redis://redis_master:6379/0
      - PDF_SPLITTER_URL=http://pdf_sentence_splitter:8000
      - CELERY_CONCURRENCY=8
    restart: unless-stopped

  # Celery Beat定時任務服務
  celery_beat:
    build:
      context: .
      dockerfile: Dockerfile.beat
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '0.2'
          memory: 256M
    depends_on:
      - redis_master
    environment:
      - REDIS_URL=redis://redis_master:6379/0
      - DATABASE_URL=postgresql://user:password@postgres_master:5432/app
    restart: unless-stopped

  # PostgreSQL主資料庫
  postgres_master:
    image: postgres:14
    volumes:
      - postgres_master_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_USER=user
      - POSTGRES_DB=app
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
    command: postgres -c max_connections=200
    restart: unless-stopped

  # Redis主節點
  redis_master:
    image: redis:7.0-alpine
    volumes:
      - redis_master_data:/data
    command: redis-server --requirepass redis_password --maxclients 100
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
    restart: unless-stopped

  # MinIO物件儲存
  minio:
    image: minio/minio
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 2G
    restart: unless-stopped
```

## 3. 主要 Dockerfile 說明

### 3.1 後端服務 Dockerfile

```dockerfile
# 使用Python 3.10官方基礎鏡像
FROM python:3.10-slim

# 設置工作目錄
WORKDIR /app

# 設置Python虛擬環境
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# 安裝系統依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製並安裝Python依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式碼
COPY . .

# 設置環境變數
ENV PYTHONUNBUFFERED=1
# 資料庫連接
ENV DATABASE_URL=postgresql://user:password@postgres_master:5432/app
# MinIO物件儲存
ENV MINIO_URL=minio:9000
ENV MINIO_ACCESS_KEY=minioaccess
ENV MINIO_SECRET_KEY=miniosecret
# Redis連接
ENV REDIS_URL=redis://redis_master:6379/0
# 外部API服務
ENV PDF_SPLITTER_URL=http://pdf_sentence_splitter:8000
# 併發控制
ENV MAX_WORKERS=8
ENV CONCURRENCY_LIMIT=60
# 上傳設定
ENV UPLOAD_TIMEOUT_MINUTES=10

# 暴露API服務端口
EXPOSE 8000

# 啟動命令，使用Uvicorn運行FastAPI應用
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.2 Celery Worker Dockerfile

```dockerfile
# 使用相同的Python 3.10基礎鏡像
FROM python:3.10-slim

# 設置工作目錄
WORKDIR /app

# 設置Python虛擬環境
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# 安裝系統依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製並安裝Python依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式碼
COPY . .

# 設置環境變數
ENV PYTHONUNBUFFERED=1
# 資料庫連接
ENV DATABASE_URL=postgresql://user:password@postgres_master:5432/app
# MinIO物件儲存
ENV MINIO_URL=minio:9000
ENV MINIO_ACCESS_KEY=minioaccess
ENV MINIO_SECRET_KEY=miniosecret
# Redis連接
ENV REDIS_URL=redis://redis_master:6379/0
# 外部API服務
ENV PDF_SPLITTER_URL=http://pdf_sentence_splitter:8000
# Celery設定
ENV CELERY_CONCURRENCY=8

# 啟動Celery Worker
CMD ["celery", "-A", "app.worker.celery", "worker", "--loglevel=info", "--concurrency=8"]
```

### 3.3 Celery Beat Dockerfile

```dockerfile
# 使用相同的Python 3.10基礎鏡像
FROM python:3.10-slim

# 設置工作目錄
WORKDIR /app

# 設置Python虛擬環境
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# 安裝系統依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製並安裝Python依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式碼
COPY . .

# 設置環境變數
ENV PYTHONUNBUFFERED=1
# Redis連接
ENV REDIS_URL=redis://redis_master:6379/0
# 其他必要環境變數
ENV DATABASE_URL=postgresql://user:password@postgres_master:5432/app

# 啟動Celery Beat排程器
CMD ["celery", "-A", "app.beat.celery", "beat", "--loglevel=info", "--scheduler=redbeat.RedBeatScheduler"]
```

## 4. 容器間通信

所有服務容器都在同一個 Docker 網絡中，使用服務名稱作為主機名進行通信：

- **backend** 服務與 **postgres_master**、**redis_master**、**minio** 和 **pdf_sentence_splitter** 通信
- **celery_worker** 服務與 **redis_master**、**postgres_master**、**minio** 和 **pdf_sentence_splitter** 通信
- **celery_beat** 服務僅與 **redis_master** 通信

## 5. 資料持久化

系統使用命名卷保存重要數據：

- **postgres_master_data**: 保存PostgreSQL資料庫數據
- **redis_master_data**: 保存Redis快取和隊列數據
- **minio_data**: 保存存儲的文件和對象

## 6. 部署與啟動

### 6.1 開發環境部署

```bash
# 構建並啟動所有服務
docker-compose up -d

# 查看服務狀態
docker-compose ps

# 查看服務日誌
docker-compose logs -f [service_name]

# 停止所有服務
docker-compose down
```

### 6.2 生產環境部署注意事項

1. **環境變數**: 生產環境應使用安全的方式提供環境變數，不要直接寫在docker-compose.yml中
2. **資源限制**: 根據實際硬件資源調整各服務的CPUs和內存限制
3. **持久化數據**: 確保持久化卷使用高可靠性存儲
4. **安全加固**: 為Redis和PostgreSQL設置強密碼，並限制網絡訪問
5. **備份策略**: 定期備份PostgreSQL和MinIO的數據
6. **監控**: 配置監控工具，如Prometheus和Grafana，以監控容器健康狀態 