#!/bin/bash

# 顯示彩色輸出的函數
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function echo_color() {
  echo -e "${2}${1}${NC}"
}

function echo_step() {
  echo_color "=======================================" $YELLOW
  echo_color ">> $1" $YELLOW
  echo_color "=======================================" $YELLOW
}

# 檢查 Docker 是否正在運行
if ! docker info > /dev/null 2>&1; then
  echo_color "錯誤: Docker 未運行，請先啟動 Docker." $RED
  exit 1
fi

# 清理舊資源
echo_step "清理舊資源"
docker-compose down -v 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# 確保目錄結構存在
echo_step "檢查目錄結構"
mkdir -p nginx/conf data/minio database/init database/replica

# 啟動所有服務
echo_step "啟動系統"
docker-compose up -d

# 顯示啟動詳情
echo_step "服務狀態"
docker-compose ps

echo_step "服務日誌"
docker-compose logs -f 