"""
Celery Worker 配置
"""
import os
from celery import Celery

from app.core.config import settings

# 創建Celery實例
celery = Celery(
    "app",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_BACKEND_URL,
    include=[
        "app.tasks.file_processing",
        "app.tasks.chat_processing",
        "app.tasks.scheduled"
    ]
)

# 配置Celery
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Taipei",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=settings.CELERY_CONCURRENCY,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=1800,  # 30分鐘任務超時
    task_soft_time_limit=1500,  # 25分鐘軟超時
    worker_max_tasks_per_child=200,  # 每個worker處理200個任務後重啟
    broker_connection_retry_on_startup=True,
)


if __name__ == "__main__":
    # 啟動Worker
    celery.start() 