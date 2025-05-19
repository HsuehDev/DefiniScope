"""
全局配置設定
"""
import os
import datetime
from typing import List, Union, Optional
from pydantic import BaseSettings, validator, PostgresDsn, AnyHttpUrl


class Settings(BaseSettings):
    """
    應用全局設定，從環境變數加載
    """
    # 應用基本設定
    APP_NAME: str = "AI文件分析與互動平台"
    API_PREFIX: str = "/api"
    SERVER_START_TIME: str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # 跨域設定
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://localhost:3000"]
    
    # 數據庫設定
    DATABASE_URL: PostgresDsn = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/app")
    
    # MinIO 設定
    MINIO_URL: str = os.getenv("MINIO_URL", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioaccess")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "miniosecret")
    MINIO_SECURE: bool = False  # 是否使用HTTPS連接MinIO
    
    # Redis 設定
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # 外部API設定
    PDF_SPLITTER_URL: str = os.getenv("PDF_SPLITTER_URL", "http://localhost:8000")
    N8N_API_URL: str = os.getenv("N8N_API_URL", "http://n8n-api:5678")
    
    # 文件上傳設定
    UPLOAD_TIMEOUT_MINUTES: int = int(os.getenv("UPLOAD_TIMEOUT_MINUTES", "10"))
    MAX_FILE_SIZE_MB: int = 10  # 最大檔案大小
    
    # 並發控制
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "8"))
    CONCURRENCY_LIMIT: int = int(os.getenv("CONCURRENCY_LIMIT", "60"))
    
    # JWT認證
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "secret_key_for_jwt_please_change_in_production")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Celery設定
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_BACKEND_URL: str = os.getenv("CELERY_BACKEND_URL", REDIS_URL)
    CELERY_CONCURRENCY: int = int(os.getenv("CELERY_CONCURRENCY", "8"))
    
    class Config:
        case_sensitive = True
        env_file = ".env"


# 建立全局settings實例
settings = Settings() 