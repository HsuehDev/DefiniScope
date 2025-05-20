# AI 文件分析與互動平台

本專案是一個智能文件分析系統，可用於處理和分析文件，並提供基於文件內容的智能問答功能。

## 系統架構

- **前端**：React 應用 (TypeScript + Vite)
- **後端**：FastAPI 服務
- **資料庫**：PostgreSQL (主從架構)
- **緩存**：Redis
- **物件存儲**：MinIO
- **反向代理**：Nginx

## 開發環境設置

### 本地開發模式

本地開發模式使用 Docker 運行後端服務，本地運行前端開發服務器，適合前端開發調試。

1. 運行本地開發環境：

```bash
./start-local-dev.sh
```

這個腳本會：
- 使用 Docker Compose 啟動後端相關服務
- 在本地啟動前端開發服務器

前端開發服務器將在 `http://localhost:3000` 啟動。

### Docker 全環境模式

使用 Docker Compose 運行整個系統，包括前端、後端、數據庫等所有服務。

1. 啟動所有服務：

```bash
./start-docker.sh
```

系統將在 `http://localhost` 啟動。

## WebSocket 連接測試

系統使用 WebSocket 進行實時通信，可以通過以下步驟測試 WebSocket 連接：

1. 設置測試認證：

```bash
./setup-test-auth.sh
```

2. 訪問 WebSocket 測試頁面：`http://localhost:3000/websocket-test`（本地開發模式）或 `http://localhost/websocket-test`（Docker 模式）

## 開發建議

### 前端開發

- 使用本地開發模式，可以獲得熱重載的開發體驗
- WebSocket URL 使用相對路徑（例如 `/ws/test`），讓代理處理轉發
- 確保認證 token 正確傳遞到 WebSocket 連接中

### 後端開發

- 使用 Docker 環境或本地 Python 環境進行開發
- 使用 FastAPI 的文檔工具查看 API 端點：`http://localhost:8000/docs`

## 故障排除

### WebSocket 連接問題

如果 WebSocket 連接失敗，請檢查：

1. 認證 token 是否有效
2. Nginx 配置是否正確
3. 後端 WebSocket 服務是否正常運行

使用 `/websocket-test` 頁面可以幫助診斷連接問題。

### Docker 環境問題

如果 Docker 環境出現問題：

1. 檢查日誌：`docker-compose logs -f [服務名]`
2. 重啟特定服務：`docker-compose restart [服務名]`
3. 重建服務：`docker-compose build [服務名]` 