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