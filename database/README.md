# 數據庫設置

本目錄包含系統使用的PostgreSQL關聯式數據庫和MinIO物件儲存的配置文件和設置腳本。

## 目錄結構

```
database/
├── docker-compose.yml        # 數據庫服務Docker配置
├── postgres/                 # PostgreSQL配置
│   ├── init-scripts/         # 初始化腳本
│   │   ├── 00-create-tables.sql    # 創建資料表
│   │   ├── 01-create-indexes.sql   # 創建索引
│   │   ├── 02-create-constraints.sql # 創建約束
│   │   └── 03-create-functions.sql   # 創建函數
│   ├── postgresql.conf       # 主節點配置
│   ├── slave-postgresql.conf # 從節點配置
│   └── pg_hba.conf           # 訪問控制配置
├── minio/                    # MinIO配置
│   ├── config/               # MinIO配置目錄
│   │   └── minio-config.env  # 環境變數配置
│   ├── policies/             # 存取策略定義
│   │   └── bucket-policy-template.json # Bucket策略模板
│   └── scripts/              # 管理腳本
│       └── setup-minio.sh    # MinIO初始化腳本
└── scripts/                  # 管理腳本
    ├── backup.sh             # 備份腳本
    ├── restore.sh            # 恢復腳本
    └── healthcheck.sh        # 健康檢查腳本
```

## 快速入門

使用以下命令啟動數據庫服務：

```bash
cd /path/to/database
docker-compose up -d
```

## 主要服務

系統包含以下主要數據庫服務：

1. **PostgreSQL主節點** (port 5432)
   - 負責寫入操作
   - 對主要應用程序提供服務

2. **PostgreSQL從節點** (port 5433)
   - 負責讀取操作
   - 提供高可用性和負載均衡

3. **MinIO物件儲存** (port 9000, 管理界面port 9001)
   - 存儲PDF文件和處理中間結果
   - 支援S3兼容API

4. **資料庫備份服務**
   - 自動執行每日備份
   - 保留30天的歷史備份

5. **健康檢查服務**
   - 定期監控所有數據庫服務
   - 記錄健康狀態

## 配置與自定義

### PostgreSQL配置

主要配置文件:
- `postgres/postgresql.conf`: 主節點配置
- `postgres/slave-postgresql.conf`: 從節點配置
- `postgres/pg_hba.conf`: 訪問控制

自定義密碼:
1. 修改`docker-compose.yml`中的環境變數
2. 或創建`.env`文件設置`POSTGRES_PASSWORD`

### MinIO配置

主要配置文件:
- `minio/config/minio-config.env`: MinIO環境配置

自定義密碼:
1. 修改`docker-compose.yml`中的環境變數
2. 或創建`.env`文件設置`MINIO_ROOT_USER`和`MINIO_ROOT_PASSWORD`

## 數據庫管理

### 備份與恢復

執行手動備份:
```bash
docker-compose exec db_backup /scripts/backup.sh
```

從備份恢復:
```bash
docker-compose exec db_backup /scripts/restore.sh /backup/backup_2023-01-01_120000.tar.gz
```

### 健康檢查

執行健康檢查:
```bash
docker-compose exec db_healthcheck /scripts/healthcheck.sh
```

## 文檔

詳細的文檔可在`docs/database/`目錄找到:

- `database_schema.md`: 資料庫結構設計
- `setup_guide.md`: 設置指南
- `replication_guide.md`: PostgreSQL複製配置指南
- `minio_guide.md`: MinIO物件儲存配置指南

## 注意事項

1. 預設配置適用於開發環境，生產環境請修改密碼並加強安全性
2. 數據庫容器使用命名卷保存數據，刪除容器不會丟失數據
3. 備份文件存儲在`backup_data`卷中，建議設置外部掛載點以確保數據安全
4. 系統會自動清理過期的備份和臨時文件 