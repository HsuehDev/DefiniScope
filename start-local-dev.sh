#!/bin/bash

# 啟動本地開發環境的腳本

echo "啟動本地開發環境..."

# 啟動後端和其他服務（使用 Docker Compose）
echo "啟動後端服務..."
docker-compose up -d backend db_master db_slave redis minio split_sentences celery

# 等待後端服務啟動
echo "等待後端服務準備就緒..."
sleep 10

# 啟動前端開發服務器
echo "啟動前端開發服務器..."
cd frontend && npm run dev 