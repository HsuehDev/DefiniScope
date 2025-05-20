"""
定時任務模組，包含所有系統定時執行的任務
"""

# 導入所有定時任務
from app.tasks.scheduled.cleaning import *
from app.tasks.scheduled.monitoring import * 