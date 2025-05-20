"""
全局配置模塊，用於設置和管理系統配置參數
"""
import os
import secrets
from typing import Optional, Dict, Any, List
from pydantic import AnyHttpUrl, validator, AnyUrl, field_validator, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """全局配置類"""
    
    # API設定
    API_V1_STR: str = "/api"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    
    # 跨域設定
    # 允許所有域名的跨域請求
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        """組裝CORS來源"""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # 項目設定
    PROJECT_NAME: str = "AI文件分析與互動平台"
    API_NAME: str = "AI文件分析API"
    API_DESCRIPTION: str = "API文檔 - AI文件分析與互動平台後端"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    VERSION: str = "0.1.0"
    
    # 數據庫設定
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "app_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    DATABASE_URI: Optional[str] = "postgresql://postgres:password@localhost:5432/mydatabase"
    
    @validator("DATABASE_URI", pre=True)
    def validate_database_uri(cls, v: Optional[str]) -> str:
        """
        驗證並調整數據庫URI
        
        在測試環境中(當環境變數TESTING=1時)使用SQLite內存數據庫
        """
        if os.getenv("TESTING") == "1":
            return "sqlite:///:memory:"
        
        # 非測試環境保持原URI
        return v
    
    # JWT設定
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))  # 30分鐘
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7天
    
    # Redis設定
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")
    REDIS_URL: str = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
    
    # MinIO設定
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "False").lower() == "true"
    MINIO_LARGE_FILE_THRESHOLD: int = int(os.getenv("MINIO_LARGE_FILE_THRESHOLD", str(100 * 1024 * 1024)))  # 默認100MB
    
    # 默認存儲桶設定
    DEFAULT_BUCKET_DOCUMENTS: str = os.getenv("DEFAULT_BUCKET_DOCUMENTS", "documents")
    DEFAULT_BUCKET_IMAGES: str = os.getenv("DEFAULT_BUCKET_IMAGES", "images")
    DEFAULT_BUCKET_TEMP: str = os.getenv("DEFAULT_BUCKET_TEMP", "temp")
    
    # 文件上傳設定
    MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", str(50 * 1024 * 1024)))  # 默認50MB
    ALLOWED_DOCUMENT_EXTENSIONS: List[str] = [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", 
        ".ppt", ".pptx", ".txt", ".md", ".json", ".csv"
    ]
    ALLOWED_IMAGE_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]
    
    # 登入安全設定
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    LOGIN_ATTEMPTS_WINDOW: int = int(os.getenv("LOGIN_ATTEMPTS_WINDOW", "300"))  # 5分鐘
    ACCOUNT_LOCKOUT_TIME: int = int(os.getenv("ACCOUNT_LOCKOUT_TIME", "900"))  # 15分鐘
    
    # n8n工作流設定
    N8N_BASE_URL: str = os.getenv("N8N_BASE_URL", "http://localhost:5678/webhook/")
    N8N_PROCESS_DOCUMENT_WORKFLOW_ID: str = os.getenv("N8N_PROCESS_DOCUMENT_WORKFLOW_ID", "")
    N8N_API_KEY: Optional[str] = os.getenv("N8N_API_KEY")
    
    # 其他設定
    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
    
    class Config:
        """配置元數據"""
        case_sensitive = True
        env_file = ".env"


# 創建全局設定實例
settings = Settings()

# 環境變量模式檢查
is_production = settings.ENVIRONMENT.lower() == "production"
is_development = settings.ENVIRONMENT.lower() == "development"
is_testing = settings.ENVIRONMENT.lower() == "testing" 