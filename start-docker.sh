#!/bin/bash

# 使用 Docker Compose 啟動整個系統的腳本

echo "使用 Docker Compose 啟動系統..."

# 停止所有容器
echo "停止現有容器..."
docker-compose down

# 構建所有服務
echo "構建服務..."
docker-compose build

# 啟動所有服務
echo "啟動所有服務..."
docker-compose up -d

echo "系統已啟動，可通過 http://localhost 訪問"
echo "使用 docker-compose logs -f 查看日誌" 