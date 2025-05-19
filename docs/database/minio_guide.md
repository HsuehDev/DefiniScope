# MinIO 物件儲存配置指南

本文檔詳細說明如何配置和使用系統的 MinIO 物件儲存，包括存取控制、生命週期管理和備份策略。

## 1. MinIO 概述

MinIO 是一個高性能的分佈式物件儲存系統，與 Amazon S3 API 相容。在本系統中，MinIO 主要用於存儲：

- 使用者上傳的原始 PDF 檔案
- 系統產生的大型臨時檔案 (如處理中間結果)
- 分片上傳的檔案片段 (用於斷點續傳)

## 2. 常規操作指南

### 2.1 訪問管理控制台

啟動系統後，可以通過以下地址訪問 MinIO 控制台：
```
http://localhost:9001
```

初始憑據：
- 用戶名: `minioadmin`
- 密碼: `minioadmin`

### 2.2 基本操作命令

使用 MinIO 命令行工具 (mc) 進行基本操作：

```bash
# 列出 bucket
docker-compose exec minio mc ls local

# 列出特定 bucket 中的對象
docker-compose exec minio mc ls local/system-bucket

# 複製文件到 MinIO
docker-compose exec minio mc cp /path/to/local/file local/bucket-name/path/in/bucket

# 從 MinIO 下載文件
docker-compose exec minio mc cp local/bucket-name/path/in/bucket /path/to/local/destination
```

## 3. Bucket 命名與組織策略

### 3.1 系統預設 Bucket

系統初始化時自動創建以下 bucket：

- **system-bucket**: 用於存儲系統級別的檔案和配置
- **temp-uploads**: 用於暫時存儲上傳中的檔案
- **processing-temp**: 用於存儲處理中間結果

### 3.2 用戶專屬 Bucket

系統為每個用戶創建專屬的 bucket，命名規則為：
```
user-{user_uuid}
```

例如：`user-550e8400-e29b-41d4-a716-446655440000`

## 4. 物件命名策略

### 4.1 PDF 檔案

上傳的 PDF 檔案存儲路徑：
```
user-{user_uuid}/{file_uuid}.pdf
```

### 4.2 分片上傳

分片上傳暫存文件的命名格式：
```
temp-uploads/{upload_id}/{chunk_number}
```

### 4.3 處理中間結果

處理過程中產生的中間結果：
```
processing-temp/{file_uuid}/{step_name}.data
```

## 5. 存取控制配置

### 5.1 IAM 政策

系統使用基於 IAM (Identity and Access Management) 的政策控制對 MinIO 資源的存取。

主要政策：

1. **系統服務策略 (app-backend-policy)**:
   - 允許後端服務完全控制所有 bucket
   - 允許創建和管理用戶
   - 允許設置存取政策

2. **用戶特定策略**:
   - 每個用戶只能存取自己的 bucket
   - 用戶無法存取系統 bucket
   - 用戶無法列出其他用戶的 bucket

### 5.2 預簽名 URL

系統使用預簽名 URL 提供臨時存取權限：

```bash
# 生成有時間限制的預簽名 URL (15分鐘)
docker-compose exec minio mc share download --expire 15m local/bucket-name/object-path
```

生產系統中，應通過後端 API 代理生成預簽名 URL，確保安全性。

## 6. 生命週期管理

### 6.1 過期規則

系統為不同類型的數據配置不同的生命週期規則：

1. **temp-uploads bucket**:
   - 檔案在 7 天後自動過期刪除
   - 分片上傳在 1 天後過期刪除

2. **processing-temp bucket**:
   - 處理中間結果在 3 天後過期刪除

### 6.2 查看生命週期規則

```bash
docker-compose exec minio mc ilm ls local/temp-uploads
```

### 6.3 手動設置生命週期規則

如需修改默認生命週期規則，可以使用以下命令：

```bash
# 為 processing-temp bucket 設置生命週期規則
cat > /tmp/lifecycle.json << EOF
{
    "Rules": [
        {
            "ID": "expire-processing-files",
            "Status": "Enabled",
            "Expiration": {
                "Days": 3
            }
        }
    ]
}
EOF

docker-compose exec -T minio mc ilm import local/processing-temp < /tmp/lifecycle.json
```

## 7. 備份與恢復

### 7.1 備份策略

系統自動執行每日備份，包括：

- 所有用戶 bucket
- 系統 bucket
- 備份每日執行一次，保留 30 天

### 7.2 手動執行備份

```bash
docker-compose exec db_backup /scripts/backup.sh
```

### 7.3 恢復備份

```bash
docker-compose exec db_backup /scripts/restore.sh /backup/backup_2023-01-01_120000.tar.gz
```

## 8. 監控與維護

### 8.1 健康檢查

系統自動進行 MinIO 健康檢查：

```bash
# 手動執行健康檢查
docker-compose exec db_healthcheck /scripts/healthcheck.sh
```

### 8.2 容量監控

查看 MinIO 使用情況：

```bash
docker-compose exec minio mc admin info local
```

### 8.3 清理過期物件

手動清理已經過期的物件：

```bash
docker-compose exec minio mc rm --force --recursive --older-than 7d local/temp-uploads/
```

## 9. 安全性建議

### 9.1 生產環境最佳實踐

1. **替換默認憑據**:
   - 更改 root 用戶名和密碼
   - 使用環境變數設置密碼，避免寫入配置文件

2. **啟用加密**:
   - 設置 MinIO 服務端加密 (SSE)
   - 考慮啟用 HTTPS

3. **限制網絡訪問**:
   - 配置防火牆僅允許必要的訪問
   - 避免將 MinIO 控制台直接暴露到公網

4. **定期審計**:
   - 啟用 MinIO 審計日誌
   - 定期檢查操作日誌

## 10. 問題排查

### 10.1 常見問題與解決方案

1. **連接失敗**
   - 檢查 MinIO 服務是否運行: `docker-compose ps minio`
   - 檢查防火牆設置: `telnet localhost 9000`
   - 檢查 MinIO 日誌: `docker-compose logs minio`

2. **上傳失敗**
   - 檢查 bucket 是否存在: `mc ls local`
   - 檢查權限: `mc admin policy list local`
   - 檢查磁盤空間: `docker-compose exec minio df -h`

3. **下載緩慢**
   - 檢查網絡連接
   - 考慮啟用 MinIO 快取: 配置 `MINIO_CACHE` 環境變數
   - 檢查資源使用情況: `docker stats minio` 