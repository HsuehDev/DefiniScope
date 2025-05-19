# 數據庫文檔

本目錄包含系統數據庫的相關文檔，提供了詳細的設計、配置和使用指南。

## 文檔索引

- [**資料庫結構設計**](database_schema.md): 詳細的資料表結構、關聯和索引設計
- [**設置指南**](setup_guide.md): 部署和設置數據庫環境的步驟和最佳實踐
- [**PostgreSQL複製配置指南**](replication_guide.md): 主從複製設置和故障轉移策略
- [**MinIO物件儲存配置指南**](minio_guide.md): 物件儲存的配置、使用和維護

## 系統架構概述

系統採用雙數據庫架構設計：

### PostgreSQL 關聯式數據庫
- 採用主從架構，提高可用性和讀取效能
- 主節點負責寫入操作，從節點負責讀取操作
- 儲存結構化資料，如用戶信息、檔案元數據、句子內容和對話記錄

### MinIO 物件儲存
- 與 S3 相容的分佈式物件儲存系統
- 儲存非結構化資料，如原始 PDF 檔案和處理中間結果
- 支援分片上傳和斷點續傳

## 數據流程

系統的主要數據流程：

1. **用戶上傳 PDF 文件**
   - 前端通過分片上傳 PDF 文件到 MinIO
   - 上傳記錄存儲在 PostgreSQL 中
   - 上傳完成後觸發文件處理

2. **文件處理和分析**
   - 後端從 MinIO 獲取 PDF 文件
   - 處理結果 (句子和分類) 存儲在 PostgreSQL 中
   - 處理過程和進度更新到 PostgreSQL

3. **智能問答**
   - 用戶查詢記錄存儲在 PostgreSQL 中
   - 系統回覆引用的句子關聯存儲在 PostgreSQL 中
   - 可通過 PostgreSQL 查詢追溯引用來源

## 資料庫安全

系統實施多層次的資料安全策略：

1. **認證和授權**
   - PostgreSQL 使用強密碼和角色
   - MinIO 使用 IAM 策略控制存取

2. **數據加密**
   - 通訊加密 (TLS)
   - 敏感數據存儲加密 (如密碼)

3. **備份和恢復**
   - 每日自動備份
   - 數據保留策略
   - 災難恢復計劃

## 進階主題

- [**效能調優指南**](performance_tuning.md) (TODO): PostgreSQL 和 MinIO 效能優化
- [**擴展性指南**](scalability_guide.md) (TODO): 資料庫水平擴展和分片策略
- [**監控解決方案**](monitoring_guide.md) (TODO): 數據庫監控和告警配置

## 資源和參考

- [PostgreSQL 官方文檔](https://www.postgresql.org/docs/)
- [MinIO 官方文檔](https://docs.min.io/)
- [Docker 官方文檔](https://docs.docker.com/) 