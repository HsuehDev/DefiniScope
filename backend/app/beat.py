"""
Celery Beat 配置
"""
from celery.schedules import crontab

from app.worker import celery
from app.core.config import settings

# 定義週期性任務
celery.conf.beat_schedule = {
    # 每日清理過期的上傳記錄
    'cleanup-expired-uploads': {
        'task': 'app.tasks.scheduled.cleanup_expired_uploads',
        'schedule': crontab(hour=3, minute=0),  # 每天凌晨3點執行
    },
    # 每小時同步檔案狀態
    'sync-file-status': {
        'task': 'app.tasks.scheduled.sync_file_status',
        'schedule': crontab(minute=15),  # 每小時的第15分鐘執行
    },
    # 每週生成系統報告
    'generate-weekly-report': {
        'task': 'app.tasks.scheduled.generate_weekly_report',
        'schedule': crontab(day_of_week=0, hour=1, minute=0),  # 每週日凌晨1點執行
    }
}

# 配置Beat
celery.conf.update(
    # Redis調度器配置
    redbeat_redis_url=settings.REDIS_URL,
    # 使用RedBeat的鎖防止多個排程器同時運行
    redbeat_lock_key='redbeat:lock:',
    redbeat_lock_timeout=60,
) 