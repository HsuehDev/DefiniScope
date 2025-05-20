"""
系統監控相關的定時任務
"""
import logging
import psutil
from datetime import datetime

from app.worker import celery
from app.core.config import settings

logger = logging.getLogger(__name__)


@celery.task
def monitor_system_health():
    """
    監控系統健康狀態
    
    定期檢查系統資源使用情況並記錄
    """
    try:
        logger.info("開始監控系統健康狀態...")
        
        # 收集CPU、內存、磁盤使用情況
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # 記錄監控數據
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_percent": disk.percent
        }
        
        # 檢查資源使用是否超過閾值
        warnings = []
        if cpu_percent > 90:
            warnings.append(f"CPU使用率過高: {cpu_percent}%")
        if memory.percent > 90:
            warnings.append(f"內存使用率過高: {memory.percent}%")
        if disk.percent > 90:
            warnings.append(f"磁盤使用率過高: {disk.percent}%")
            
        if warnings:
            logger.warning("系統資源使用警告: " + ", ".join(warnings))
        
        logger.info("系統健康監控完成")
        return {
            "status": "success", 
            "message": "系統健康監控完成",
            "metrics": metrics,
            "warnings": warnings
        }
    except Exception as e:
        logger.error(f"系統健康監控失敗: {str(e)}")
        return {"status": "error", "message": f"系統健康監控失敗: {str(e)}"} 