# 資料庫設置指南

本文檔說明如何設置和配置系統使用的 PostgreSQL 資料庫和 MinIO 物件儲存。

## 1. 系統需求

### 1.1 硬體建議
- **CPU**: 至少 4 核心 (建議 8 核心以上)
- **記憶體**: 至少 8GB (建議 16GB 以上)
- **硬碟空間**: 
  - PostgreSQL: 至少 50GB (建議 SSD)
  - MinIO: 至少 100GB (可根據預期的文件儲存量增加)

### 1.2 軟體需求
- Docker 20.10 或更高版本
- Docker Compose 2.0 或更高版本
- 支援 Linux, macOS 或 Windows 作業系統

## 2. 快速啟動

使用提供的 Docker Compose 文件可以快速啟動整個資料庫環境：

```bash
cd /path/to/database
docker-compose up -d
```

啟動後可以通過以下方式檢查服務狀態：

```bash
docker-compose ps
```

## 3. PostgreSQL 設置詳情

### 3.1 初始連接信息
- **主節點端口**: 5432
- **從節點端口**: 5433
- **用戶名**: user
- **密碼**: password
- **資料庫名**: app

### 3.2 主從複製配置
系統已自動配置 PostgreSQL 主從複製，只要啟動 docker-compose 即可。若需手動設置主從複製，請參照以下步驟：

1. 確保主節點配置正確
2. 在從節點上執行以下命令：

```bash
pg_basebackup -h postgres_master -U replication -D /var/lib/postgresql/data -P -v
```

3. 創建從節點的 `standby.signal` 文件：

```bash
touch /var/lib/postgresql/data/standby.signal
```

4. 配置從節點的 `postgresql.conf`：

```
primary_conninfo = 'host=postgres_master port=5432 user=replication password=password'
```

### 3.3 資料庫備份
系統自動執行每日備份，但您也可以手動執行：

```bash
docker-compose exec db_backup /scripts/backup.sh
```

備份文件存放在 `/backup` 目錄下。

## 4. MinIO 設置詳情

### 4.1 初始連接信息
- **S3 API 端口**: 9000
- **管理控制台端口**: 9001
- **用戶名**: minioadmin
- **密碼**: minioadmin

### 4.2 訪問管理控制台
啟動服務後，可以通過瀏覽器訪問 MinIO 控制台：
http://localhost:9001

### 4.3 自動初始化
系統啟動時會自動執行 `setup-minio.sh` 腳本進行初始化，創建必要的 bucket 和策略。

## 5. 驗證與故障排除

### 5.1 驗證 PostgreSQL
使用以下命令測試 PostgreSQL 連接：

```bash
docker-compose exec postgres_master psql -U user -d app -c "SELECT version();"
```

### 5.2 驗證 MinIO
使用以下命令測試 MinIO 連接：

```bash
docker-compose exec minio mc ls local
```

### 5.3 故障排查

**PostgreSQL 無法連接**:
```bash
# 檢查日誌
docker-compose logs postgres_master
```

**MinIO 無法連接**:
```bash
# 檢查日誌
docker-compose logs minio
```

**執行健康檢查**:
```bash
docker-compose exec db_healthcheck /scripts/healthcheck.sh
```

## 6. 安全性考量

### 6.1 生產環境建議
- 修改所有預設密碼
- 使用環境變數而非寫入 docker-compose.yml
- 配置 SSL/TLS 加密
- 限制網絡訪問範圍

### 6.2 密碼修改指南

**PostgreSQL 密碼**:
1. 修改 docker-compose.yml 中的環境變數
2. 或使用 .env 文件

**MinIO 密碼**:
1. 修改 docker-compose.yml 中的環境變數
2. 更新後需要重新設置 mc 配置：
```bash
docker-compose exec minio_setup mc alias set local http://minio:9000 新用戶名 新密碼
```

## 7. 系統監控

### 7.1 系統自帶監控
- 每 5 分鐘執行一次健康檢查
- 健康檢查日誌保存在 `/var/log/db_healthcheck_*.log`

### 7.2 整合外部監控工具
系統可以與以下監控工具整合：
- Prometheus + Grafana
- Datadog
- Zabbix

具體配置請參考相應監控工具的文檔。

## 8. 維護任務

### 8.1 定期維護
以下任務將自動執行：
- 每日資料庫備份
- 定期清理過期的上傳分片
- 定期檢測超時的上傳

### 8.2 手動維護
建議定期執行以下手動維護：
- 資料庫 VACUUM FULL (每月一次)
- 資料庫索引重建 (視需要)
- MinIO 資料完整性檢查

資料庫 VACUUM FULL 範例：
```bash
docker-compose exec postgres_master psql -U user -d app -c "VACUUM FULL ANALYZE;"
``` 