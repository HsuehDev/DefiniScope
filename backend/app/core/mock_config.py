"""
模擬配置文件，用於測試
"""

class Settings:
    # JWT配置
    JWT_SECRET_KEY = "test_secret_key_for_jwt_please_change_in_production"
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    # Redis配置
    REDIS_HOST = "localhost"
    REDIS_PORT = 6379
    REDIS_DB = 0
    REDIS_PASSWORD = None
    
    # 登入嘗試配置
    MAX_LOGIN_ATTEMPTS = 5
    LOGIN_ATTEMPTS_WINDOW = 300  # 5分鐘
    ACCOUNT_LOCKOUT_TIME = 1800  # 30分鐘
    
    # MinIO配置
    MINIO_ENDPOINT = "localhost:9000"
    MINIO_ACCESS_KEY = "minioadmin"
    MINIO_SECRET_KEY = "minioadmin"
    MINIO_SECURE = False
    MINIO_REGION = "us-east-1"
    MINIO_CONNECTION_POOL_SIZE = 5
    MINIO_LARGE_FILE_THRESHOLD = 5 * 1024 * 1024  # 5MB
    MINIO_DEFAULT_BUCKET = "default"
    DEFAULT_PRESIGNED_URL_EXPIRY = 3600  # 1小時
    
    # 文件限制
    MAX_UPLOAD_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    ALLOWED_FILE_TYPES = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']


settings = Settings() 