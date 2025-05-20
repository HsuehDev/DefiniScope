"""
WebSocket 認證機制改進示例
"""

# 原始代碼
def original_auth_method():
    """
    原始認證方法有安全隱患
    """
    code = '''
    # 驗證使用者身份，不要先accept
    authenticated, user, error_message = await authenticate_websocket(websocket)
    if not authenticated:
        # 為了發送錯誤訊息，需要先建立連接
        await websocket.accept()
        logger.warning(f"WebSocket 連接認證失敗: {error_message}")
        await close_with_error(websocket, error_message)
        return
    '''
    return code

# 改進後的代碼
def improved_auth_method():
    """
    改進後的認證方法，不接受未認證的連接
    """
    code = '''
    # 驗證使用者身份
    authenticated, user, error_message = await authenticate_websocket(websocket)
    if not authenticated:
        # 直接關閉連接，不先接受
        logger.warning(f"WebSocket 連接認證失敗: {error_message}")
        # 使用 4401 自定義關閉碼表示認證失敗
        await websocket.close(code=4401, reason=error_message)
        return
        
    # 認證成功後才接受連接
    await websocket.accept()
    '''
    return code

# 前端處理認證錯誤的方式
def frontend_auth_error_handling():
    """
    前端處理認證錯誤的方式
    """
    code = '''
    // JavaScript 前端代碼
    const connectWebSocket = (url, token) => {
        const ws = new WebSocket(`${url}?token=${token}`);
        
        ws.onopen = () => {
            console.log('WebSocket 連接已建立');
        };
        
        ws.onclose = (event) => {
            if (event.code === 4401) {
                // 認證失敗
                console.error(`認證失敗: ${event.reason}`);
                // 顯示錯誤訊息給用戶
                showError(`連接失敗: ${event.reason}`);
            } else {
                // 其他原因的關閉
                console.log(`WebSocket 連接已關閉: ${event.code}`);
                // 可能嘗試重連
                setTimeout(() => connectWebSocket(url, token), 3000);
            }
        };
        
        return ws;
    };
    '''
    return code 