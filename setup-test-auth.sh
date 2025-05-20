#!/bin/bash

# 用於設置測試認證的腳本

echo "設置測試認證環境..."

# 測試認證令牌 - 這應該是一個有效的JWT令牌
TEST_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXJfaWQiLCJleHAiOjE3MzE2MTUyNDMsImlhdCI6MTYzMTYxNTI0MywianRpIjoiNGY3ZjRkM2EtZjEzOC00YmQyLThlOTMtNzZkMDljMjU2MWZlIiwidHlwZSI6ImFjY2VzcyJ9.nAE8olQOFx8PXCuWZ6qpEdqpkKzKgP1k2d8M25s2U3s"
TEST_REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXJfaWQiLCJleHAiOjE3MzE2MTg4NDMsImlhdCI6MTYzMTYxNTI0MywianRpIjoiOTc0MzAwYjctNTliYi00M2FiLWFiYWMtYmI1MDMzNDMwYTE0IiwidHlwZSI6InJlZnJlc2gifQ.DGdTm_jnHLDHMWUPcMCY6VVCBgW8jMxvvUQKl0uSvSk"

# 檢查是否在Docker環境中
if [ -f /.dockerenv ]; then
  echo "在Docker環境中運行..."
  
  # 在Docker環境中測試後端API可用性
  echo "測試後端API連接..."
  curl -s http://backend:8000/health > /dev/null
  if [ $? -eq 0 ]; then
    echo "後端API可用"
  else
    echo "警告: 後端API不可用，無法創建真實令牌"
  fi
else
  echo "在本地環境中運行..."
  
  # 在本地環境中測試後端API可用性
  echo "測試後端API連接..."
  curl -s http://localhost:8000/health > /dev/null
  if [ $? -eq 0 ]; then
    echo "後端API可用"
  else 
    echo "警告: 後端API不可用，無法創建真實令牌"
  fi
fi

# 使用臨時認證令牌
echo "設置認證令牌..."
if [ -d "frontend" ]; then
  # 如果在專案根目錄
  cd frontend
fi

# 在localStorage中保存令牌 (使用臨時HTML文件)
cat > setup-auth.html << EOF
<!DOCTYPE html>
<html>
<head>
  <title>設置測試認證</title>
</head>
<body>
  <h2>設置測試認證</h2>
  <div id="result"></div>
  
  <script>
    // 設置令牌
    localStorage.setItem('accessToken', '$TEST_TOKEN');
    localStorage.setItem('refreshToken', '$TEST_REFRESH_TOKEN');
    
    // 顯示結果
    document.getElementById('result').innerHTML = '認證令牌已設置';
    
    // 傳送完成消息
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.close();
      }, 2000);
    });
  </script>
</body>
</html>
EOF

echo "認證設置完成"
echo "請打開以下網址以安裝認證令牌:"
echo "file://$(pwd)/setup-auth.html"
echo "(請使用與應用相同的瀏覽器打開)"
echo ""
echo "然後關閉該頁面並重新整理應用以應用認證"
echo ""
echo "或在控制台中手動設置認證令牌:"
echo "localStorage.setItem('accessToken', '$TEST_TOKEN');"
echo "localStorage.setItem('refreshToken', '$TEST_REFRESH_TOKEN');" 