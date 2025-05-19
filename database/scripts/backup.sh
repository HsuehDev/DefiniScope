#!/bin/bash
# 數據庫備份腳本
# 用於定期備份 PostgreSQL 資料庫和 MinIO 物件存儲

set -e

# 設定日期格式
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR="/backup"
PG_BACKUP_DIR="${BACKUP_DIR}/postgres/${DATE}"
MINIO_BACKUP_DIR="${BACKUP_DIR}/minio/${DATE}"
LOG_FILE="${BACKUP_DIR}/backup_${DATE}.log"

# 確保備份目錄存在
mkdir -p ${PG_BACKUP_DIR}
mkdir -p ${MINIO_BACKUP_DIR}

echo "開始備份過程 - ${DATE}" | tee -a ${LOG_FILE}

# PostgreSQL 備份
echo "正在備份 PostgreSQL 資料庫..." | tee -a ${LOG_FILE}
PGPASSWORD=${POSTGRES_PASSWORD} pg_dump -h postgres_master -U ${POSTGRES_USER} -d app -F c -f ${PG_BACKUP_DIR}/app_full.backup

# 檢查備份是否成功
if [ $? -eq 0 ]; then
    echo "PostgreSQL 備份成功" | tee -a ${LOG_FILE}
else
    echo "PostgreSQL 備份失敗！" | tee -a ${LOG_FILE}
    exit 1
fi

# MinIO 備份 (使用 mc mirror 命令)
echo "正在備份 MinIO 物件存儲..." | tee -a ${LOG_FILE}

# 確保 MinIO 客戶端已配置
mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# 備份系統 bucket
echo "備份系統 bucket..." | tee -a ${LOG_FILE}
mc mirror local/system-bucket ${MINIO_BACKUP_DIR}/system-bucket

# 備份用戶 buckets (使用正則表達式匹配所有 user-* buckets)
echo "備份用戶 buckets..." | tee -a ${LOG_FILE}
for bucket in $(mc ls local | grep user- | awk '{print $5}'); do
    echo "正在備份 bucket: ${bucket}" | tee -a ${LOG_FILE}
    mc mirror local/${bucket} ${MINIO_BACKUP_DIR}/${bucket}
done

# 壓縮備份目錄
echo "壓縮備份文件..." | tee -a ${LOG_FILE}
tar -czf ${BACKUP_DIR}/backup_${DATE}.tar.gz -C ${BACKUP_DIR} postgres/${DATE} minio/${DATE}

# 刪除臨時目錄
rm -rf ${PG_BACKUP_DIR}
rm -rf ${MINIO_BACKUP_DIR}

# 保留最近 30 天的備份，刪除更早的備份
find ${BACKUP_DIR} -name "backup_*.tar.gz" -type f -mtime +30 -delete
find ${BACKUP_DIR} -name "backup_*.log" -type f -mtime +30 -delete

echo "備份過程完成 - $(date +%Y-%m-%d_%H%M%S)" | tee -a ${LOG_FILE} 