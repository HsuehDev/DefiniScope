#!/bin/bash
# 數據庫健康檢查腳本
# 用於檢查 PostgreSQL 和 MinIO 服務的健康狀態

set -e

LOG_FILE="/var/log/db_healthcheck_$(date +%Y-%m-%d).log"
ERRORS=0

echo "=== 數據庫健康檢查 $(date +%Y-%m-%d_%H%M%S) ===" | tee -a ${LOG_FILE}

# 檢查 PostgreSQL 主節點連接
echo "檢查 PostgreSQL 主節點連接..." | tee -a ${LOG_FILE}
if PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d app -c "SELECT 1;" > /dev/null 2>&1; then
    echo "√ PostgreSQL 主節點連接正常" | tee -a ${LOG_FILE}
else
    echo "× PostgreSQL 主節點連接失敗！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
fi

# 檢查 PostgreSQL 從節點連接
echo "檢查 PostgreSQL 從節點連接..." | tee -a ${LOG_FILE}
if PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_slave -U ${POSTGRES_USER} -d app -c "SELECT 1;" > /dev/null 2>&1; then
    echo "√ PostgreSQL 從節點連接正常" | tee -a ${LOG_FILE}
else
    echo "× PostgreSQL 從節點連接失敗！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
fi

# 檢查 PostgreSQL 複寫狀態
echo "檢查 PostgreSQL 複寫狀態..." | tee -a ${LOG_FILE}
REPLICATION_LAG=$(PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d app -t -c "SELECT extract(epoch from (now() - pg_last_xact_replay_timestamp()))::integer;" | tr -d ' ')

if [ -z "$REPLICATION_LAG" ]; then
    echo "× 無法獲取複寫延遲數據！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
elif [ "$REPLICATION_LAG" -lt 300 ]; then
    echo "√ 複寫延遲正常 (${REPLICATION_LAG} 秒)" | tee -a ${LOG_FILE}
else
    echo "× 複寫延遲過高 (${REPLICATION_LAG} 秒)！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
fi

# 檢查 MinIO 服務
echo "檢查 MinIO 服務..." | tee -a ${LOG_FILE}
if mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD} > /dev/null 2>&1; then
    echo "√ MinIO 服務連接正常" | tee -a ${LOG_FILE}
else
    echo "× MinIO 服務連接失敗！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
fi

# 檢查 MinIO 關鍵 bucket 是否存在
echo "檢查 MinIO 關鍵 bucket..." | tee -a ${LOG_FILE}
if mc ls local/system-bucket > /dev/null 2>&1; then
    echo "√ system-bucket 存在且可訪問" | tee -a ${LOG_FILE}
else
    echo "× system-bucket 不存在或無法訪問！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
fi

# 檢查 PostgreSQL 資料表
echo "檢查 PostgreSQL 關鍵資料表..." | tee -a ${LOG_FILE}
TABLES=("users" "files" "sentences" "conversations" "messages")
for table in "${TABLES[@]}"; do
    if PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d app -c "SELECT COUNT(*) FROM ${table};" > /dev/null 2>&1; then
        echo "√ 資料表 ${table} 存在且可查詢" | tee -a ${LOG_FILE}
    else
        echo "× 資料表 ${table} 不存在或無法查詢！" | tee -a ${LOG_FILE}
        ERRORS=$((ERRORS+1))
    fi
done

# 檢查 PostgreSQL 服務器負載
echo "檢查 PostgreSQL 主節點負載..." | tee -a ${LOG_FILE}
CONNECTIONS=$(PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d app -t -c "SELECT count(*) FROM pg_stat_activity;" | tr -d ' ')
MAX_CONNECTIONS=$(PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres_master -U ${POSTGRES_USER} -d app -t -c "SHOW max_connections;" | tr -d ' ')
CONNECTION_PERCENT=$((CONNECTIONS * 100 / MAX_CONNECTIONS))

if [ "$CONNECTION_PERCENT" -lt 80 ]; then
    echo "√ 連接負載正常 (${CONNECTIONS}/${MAX_CONNECTIONS}, ${CONNECTION_PERCENT}%)" | tee -a ${LOG_FILE}
else
    echo "× 連接負載過高 (${CONNECTIONS}/${MAX_CONNECTIONS}, ${CONNECTION_PERCENT}%)！" | tee -a ${LOG_FILE}
    ERRORS=$((ERRORS+1))
fi

# 健康檢查結果摘要
echo "" | tee -a ${LOG_FILE}
if [ "$ERRORS" -eq 0 ]; then
    echo "✓✓✓ 健康檢查通過！✓✓✓" | tee -a ${LOG_FILE}
    exit 0
else
    echo "××× 健康檢查失敗！發現 ${ERRORS} 個問題。×××" | tee -a ${LOG_FILE}
    exit 1
fi 