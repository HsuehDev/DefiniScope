"""
模擬的配置文件，用於測試
"""
from pydantic import BaseSettings

class Settings(BaseSettings):
    """測試用的設置類"""
    # JWT 設置
    JWT_SECRET_KEY: str = "test_secret_key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Redis 設置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = None
    
    # MinIO 設置
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_DEFAULT_BUCKET: str = "documents"
    DEFAULT_PRESIGNED_URL_EXPIRY: int = 3600
    
    # 文件設置
    MAX_UPLOAD_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_FILE_TYPES: list = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]

# 創建設置實例
settings = Settings() 