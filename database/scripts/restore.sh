#!/bin/bash
# 數據庫恢復腳本
# 用於從備份中恢復 PostgreSQL 資料庫和 MinIO 物件存儲

set -e

# 檢查備份文件參數
if [ "$1" == "" ]; then
    echo "用法: $0 <備份文件路徑>"
    echo "例如: $0 /backup/backup_2023-01-01_120000.tar.gz"
    exit 1
fi

BACKUP_FILE=$1
RESTORE_DIR="/tmp/restore"
LOG_FILE="/backup/restore_$(date +%Y-%m-%d_%H%M%S).log"

# 確保恢復目錄存在
mkdir -p ${RESTORE_DIR}

echo "開始恢復過程 - $(date +%Y-%m-%d_%H%M%S)" | tee -a ${LOG_FILE}

# 解壓備份文件
echo "正在解壓備份文件..." | tee -a ${LOG_FILE}
tar -xzf ${BACKUP_FILE} -C ${RESTORE_DIR}

# 檢查解壓是否成功
if [ $? -ne 0 ]; then
    echo "備份文件解壓失敗！" | tee -a ${LOG_FILE}
    exit 1
fi

# 找到 PostgreSQL 備份文件目錄
PG_BACKUP_DIR=$(find ${RESTORE_DIR}/postgres -type d -maxdepth 1 | sort | tail -1)
if [ ! -d "${PG_BACKUP_DIR}" ]; then
    echo "找不到 PostgreSQL 備份目錄！" | tee -a ${LOG_FILE}
    exit 1
fi

# 找到 MinIO 備份文件目錄
MINIO_BACKUP_DIR=$(find ${RESTORE_DIR}/minio -type d -maxdepth 1 | sort | tail -1)
if [ ! -d "${MINIO_BACKUP_DIR}" ]; then
    echo "找不到 MinIO 備份目錄！" | tee -a ${LOG_FILE}
    exit 1
fi

echo "找到 PostgreSQL 備份目錄: ${PG_BACKUP_DIR}" | tee -a ${LOG_FILE}
echo "找到 MinIO 備份目錄: ${MINIO_BACKUP_DIR}" | tee -a ${LOG_FILE}

# 恢復 PostgreSQL 資料庫
echo "正在恢復 PostgreSQL 資料庫..." | tee -a ${LOG_FILE}

# 先檢查是否可以連接到 PostgreSQL
if ! PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d postgres -c '\q'; then
    echo "無法連接到 PostgreSQL 服務器！" | tee -a ${LOG_FILE}
    exit 1
fi

# 關閉已有連接
PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'app' AND pid <> pg_backend_pid();"

# 嘗試刪除然後重建資料庫
PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d postgres -c "DROP DATABASE IF EXISTS app;"
PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d postgres -c "CREATE DATABASE app;"

# 恢復數據
PG_BACKUP_FILE=$(find ${PG_BACKUP_DIR} -name "*.backup" | head -1)
PGPASSWORD=${POSTGRES_PASSWORD} pg_restore -h postgres_master -U ${POSTGRES_USER} -d app -v ${PG_BACKUP_FILE}

# 檢查恢復是否成功
if [ $? -eq 0 ]; then
    echo "PostgreSQL 資料庫恢復成功" | tee -a ${LOG_FILE}
else
    echo "警告: PostgreSQL 資料庫恢復可能有一些錯誤，但將繼續恢復過程" | tee -a ${LOG_FILE}
fi

# 恢復 MinIO 物件存儲
echo "正在恢復 MinIO 物件存儲..." | tee -a ${LOG_FILE}

# 確保 MinIO 客戶端已配置
mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# 恢復系統 bucket (如果存在)
if [ -d "${MINIO_BACKUP_DIR}/system-bucket" ]; then
    echo "恢復系統 bucket..." | tee -a ${LOG_FILE}
    mc mb -p local/system-bucket
    mc mirror ${MINIO_BACKUP_DIR}/system-bucket local/system-bucket
fi

# 恢復所有用戶 buckets
for bucket_dir in $(find ${MINIO_BACKUP_DIR} -maxdepth 1 -name "user-*" -type d); do
    bucket_name=$(basename ${bucket_dir})
    echo "正在恢復 bucket: ${bucket_name}" | tee -a ${LOG_FILE}
    mc mb -p local/${bucket_name}
    mc mirror ${bucket_dir} local/${bucket_name}
done

# 清理臨時文件
echo "清理臨時文件..." | tee -a ${LOG_FILE}
rm -rf ${RESTORE_DIR}

echo "恢復過程完成 - $(date +%Y-%m-%d_%H%M%S)" | tee -a ${LOG_FILE}
echo "注意: 可能需要重啟應用程序服務以使用新恢復的數據" | tee -a ${LOG_FILE} 