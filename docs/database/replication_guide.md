# PostgreSQL 主從複製配置指南

PostgreSQL 主從複製架構是確保系統高可用性和讀取效能的重要組成部分。本文檔詳細說明配置和維護 PostgreSQL 主從複製的步驟。

## 1. 複製架構概述

在本系統中，PostgreSQL 採用異步流複製 (Asynchronous Streaming Replication) 設計：

```
┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │
│  主節點 (Master) │ ──────> │ 從節點 (Slave)   │
│    讀寫操作      │ WAL     │    唯讀操作      │
│                 │ 傳輸     │                 │
└─────────────────┘         └─────────────────┘
```

- **主節點 (Master)**: 接受所有讀取和寫入操作
- **從節點 (Slave)**: 僅接受讀取操作，通過應用 WAL (Write-Ahead Log) 日誌保持與主節點數據同步

## 2. 自動設置方式

### 2.1 使用 Docker Compose

使用提供的 Docker Compose 配置文件可以自動設置主從複製：

```bash
docker-compose up -d
```

系統將自動配置主節點和從節點，無需額外手動操作。

## 3. 手動設置步驟

如果需要手動設置或修改複製配置，請按照以下步驟進行。

### 3.1 配置主節點

1. 確保主節點 `postgresql.conf` 中包含以下設置：

```
listen_addresses = '*'
wal_level = replica
max_wal_senders = 10
wal_keep_segments = 64
max_replication_slots = 10
```

2. 在主節點的 `pg_hba.conf` 中添加複製用戶訪問權限：

```
host    replication     replication     172.16.0.0/12           scram-sha-256
host    replication     replication     10.0.0.0/8              scram-sha-256
```

3. 創建複製用戶：

```sql
CREATE ROLE replication WITH REPLICATION PASSWORD 'password' LOGIN;
```

4. 重啟主節點以套用設置：

```bash
docker-compose restart postgres_master
```

### 3.2 設置從節點

1. 停止從節點：

```bash
docker-compose stop postgres_slave
```

2. 清空從節點數據目錄：

```bash
docker-compose exec postgres_slave rm -rf /var/lib/postgresql/data/*
```

3. 使用 `pg_basebackup` 從主節點複製數據：

```bash
docker-compose exec postgres_slave pg_basebackup -h postgres_master -U replication -p 5432 -D /var/lib/postgresql/data -P -v -R
```

4. 創建 `standby.signal` 文件標記為從節點：

```bash
docker-compose exec postgres_slave touch /var/lib/postgresql/data/standby.signal
```

5. 確保從節點的 `postgresql.conf` 包含以下設置：

```
hot_standby = on
hot_standby_feedback = on
```

6. 啟動從節點：

```bash
docker-compose start postgres_slave
```

## 4. 複製狀態監控

### 4.1 檢查複製狀態

在**主節點**上執行：

```sql
SELECT * FROM pg_stat_replication;
```

輸出包含每個複製連接的詳細信息，包括複製延遲。

### 4.2 計算延遲時間

在**從節點**上執行：

```sql
SELECT 
    now() AS current_time,
    pg_last_xact_replay_timestamp() AS last_replay,
    now() - pg_last_xact_replay_timestamp() AS replication_delay;
```

這將顯示從節點的複製延遲時間。

## 5. 故障轉移 (Failover)

### 5.1 手動故障轉移步驟

如果主節點故障，可以手動將從節點提升為新的主節點：

1. 在從節點上創建觸發文件以使其變為主節點：

```bash
docker-compose exec postgres_slave touch /var/lib/postgresql/data/recovery.signal
```

2. 修改從節點的 `postgresql.conf`，移除或註釋掉 `primary_conninfo` 設置。

3. 重啟從節點 (現在變為主節點)：

```bash
docker-compose restart postgres_slave
```

4. 更新應用配置，指向新的主節點。

### 5.2 設置原主節點為新從節點

當原主節點恢復後，可以設置其為新的從節點：

1. 停止原主節點：

```bash
docker-compose stop postgres_master
```

2. 清空原主節點數據目錄：

```bash
docker-compose exec postgres_master rm -rf /var/lib/postgresql/data/*
```

3. 從新主節點 (原從節點) 複製數據：

```bash
docker-compose exec postgres_master pg_basebackup -h postgres_slave -U replication -p 5432 -D /var/lib/postgresql/data -P -v -R
```

4. 創建 `standby.signal` 文件：

```bash
docker-compose exec postgres_master touch /var/lib/postgresql/data/standby.signal
```

5. 啟動新從節點 (原主節點)：

```bash
docker-compose start postgres_master
```

## 6. 複製故障排查

### 6.1 常見問題與解決方案

1. **複製延遲過高**

   原因: 主節點寫入過多，從節點跟不上；網絡延遲；從節點資源不足。
   
   解決方案:
   - 檢查從節點硬體資源
   - 增加 `wal_keep_segments` 值
   - 檢查網絡連通性

2. **複製中斷**

   原因: WAL 日誌清理過快；密碼認證失敗；網絡中斷。
   
   解決方案:
   - 檢查 `pg_stat_replication` 中的錯誤訊息
   - 增加 `wal_keep_segments` 值
   - 檢查網絡連接
   - 驗證複製用戶密碼

3. **從節點啟動失敗**

   原因: 配置文件錯誤；複製流中斷時間過長；數據不一致。
   
   解決方案:
   - 檢查日誌中的錯誤訊息
   - 檢查 `pg_hba.conf` 和 `postgresql.conf` 配置
   - 如果不可修復，重新執行基礎備份

### 6.2 檢查日誌

查看主節點日誌：

```bash
docker-compose logs postgres_master
```

查看從節點日誌：

```bash
docker-compose logs postgres_slave
```

## 7. 最佳實踐

1. **定期監控複製延遲**
   - 設置監控系統，當延遲超過閾值時發出警報
   - 建議閾值不超過 30 秒

2. **定期測試故障轉移流程**
   - 模擬主節點故障並執行故障轉移
   - 測試應用是否能正確連接到新主節點

3. **保持複製用戶密碼安全**
   - 定期更換複製用戶密碼
   - 使用強密碼並限制網絡訪問

4. **調整 WAL 設置以平衡性能和可靠性**
   - 根據系統負載調整 `wal_keep_segments`
   - 大流量系統可能需要更高的值 