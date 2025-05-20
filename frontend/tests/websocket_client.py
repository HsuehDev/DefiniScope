#!/usr/bin/env python
"""
WebSocket 測試客戶端

用於測試 WebSocket 連接、認證和訊息處理
"""
import asyncio
import json
import argparse
import sys
import uuid
import signal
import datetime
import time
from typing import Optional, Dict, Any
import websockets
from websockets.exceptions import ConnectionClosed


class WebSocketClient:
    """WebSocket 測試客戶端"""
    
    def __init__(self, url: str, token: Optional[str] = None, timeout: int = 10):
        """
        初始化 WebSocket 客戶端
        
        Args:
            url: WebSocket 服務 URL
            token: 認證令牌
            timeout: 連接超時時間（秒）
        """
        self.base_url = url
        self.token = token
        self.timeout = timeout
        self.websocket = None
        self.connected = False
        self.connection_id = None
        self.received_messages = []
        self.running = False
        self.event = asyncio.Event()
    
    def get_connection_url(self) -> str:
        """獲取帶有認證令牌的連接 URL"""
        url = self.base_url
        if self.token:
            sep = "?" if "?" not in url else "&"
            url = f"{url}{sep}token={self.token}"
        return url
    
    async def connect(self) -> bool:
        """建立 WebSocket 連接"""
        try:
            url = self.get_connection_url()
            print(f"正在連接到 {url}...")
            
            self.websocket = await websockets.connect(
                url,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=5
            )
            
            self.connected = True
            print("連接成功")
            
            # 等待歡迎消息
            welcome_msg = await asyncio.wait_for(
                self.websocket.recv(),
                timeout=self.timeout
            )
            welcome_data = json.loads(welcome_msg)
            print(f"收到歡迎消息：{json.dumps(welcome_data, indent=2, ensure_ascii=False)}")
            
            if welcome_data.get('event') == 'connection_established':
                self.connection_id = welcome_data.get('connection_id')
                print(f"連接 ID: {self.connection_id}")
            
            return True
            
        except ConnectionRefusedError:
            print("連接被拒絕，服務可能未啟動")
        except ConnectionClosed as e:
            print(f"連接關閉：{e.code} - {e.reason}")
        except asyncio.TimeoutError:
            print(f"連接超時，超過 {self.timeout} 秒沒有響應")
        except Exception as e:
            print(f"連接出錯：{str(e)}")
        
        self.connected = False
        return False
    
    async def send_ping(self) -> None:
        """發送 ping 消息"""
        if not self.connected or not self.websocket:
            print("未連接，無法發送消息")
            return
            
        try:
            message = {
                "type": "ping",
                "time": time.time()
            }
            await self.websocket.send(json.dumps(message))
            print(f"已發送 ping 消息：{json.dumps(message)}")
        except Exception as e:
            print(f"發送 ping 消息失敗：{str(e)}")
    
    async def receive_messages(self) -> None:
        """接收訊息的協程"""
        if not self.connected or not self.websocket:
            print("未連接，無法接收消息")
            return
            
        try:
            while self.running:
                try:
                    message = await asyncio.wait_for(
                        self.websocket.recv(),
                        timeout=1.0
                    )
                    
                    try:
                        data = json.loads(message)
                        print(f"\n收到消息: {json.dumps(data, indent=2, ensure_ascii=False)}")
                        
                        # 保存接收到的消息
                        self.received_messages.append(data)
                        
                        # 如果是 pong 消息，計算延遲
                        if data.get('event') == 'pong':
                            server_time = data.get('server_time')
                            client_time = data.get('client_time')
                            if client_time and server_time:
                                latency = server_time - client_time
                                print(f"延遲: {latency:.6f} 秒")
                            
                    except json.JSONDecodeError:
                        print(f"收到非 JSON 消息: {message}")
                        
                except asyncio.TimeoutError:
                    # 檢查連接是否存活
                    if self.websocket.closed:
                        print("連接已關閉")
                        self.connected = False
                        break
                    # 如果沒有消息，等待下一個循環
                    continue
                    
        except ConnectionClosed:
            print("連接已關閉")
            self.connected = False
        except Exception as e:
            print(f"接收消息出錯：{str(e)}")
            self.connected = False
    
    async def close(self) -> None:
        """關閉 WebSocket 連接"""
        if self.websocket:
            try:
                await self.websocket.close()
                print("已關閉連接")
            except Exception as e:
                print(f"關閉連接時出錯：{str(e)}")
            finally:
                self.connected = False
                self.websocket = None
    
    async def run_interactive(self) -> None:
        """運行交互式客戶端"""
        self.running = True
        
        # 連接
        if not await self.connect():
            return
        
        # 啟動接收消息的協程
        receive_task = asyncio.create_task(self.receive_messages())
        
        try:
            while self.running:
                # 提示使用者輸入命令
                print("\n命令：")
                print("  p - 發送 ping")
                print("  q - 退出")
                
                command = await self.get_user_input()
                
                if command == 'p':
                    await self.send_ping()
                elif command == 'q':
                    self.running = False
                    print("正在退出...")
                    break
                else:
                    print(f"未知命令: {command}")
                
                # 檢查連接狀態
                if not self.connected:
                    print("連接已斷開，正在退出...")
                    break
            
        finally:
            # 停止接收消息的協程
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass
            
            # 關閉連接
            await self.close()
    
    async def get_user_input(self) -> str:
        """非阻塞式獲取用戶輸入"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: input("> ").strip())


async def main():
    parser = argparse.ArgumentParser(description='WebSocket 測試客戶端')
    parser.add_argument('--url', type=str, required=True, help='WebSocket 服務 URL')
    parser.add_argument('--token', type=str, help='認證令牌')
    parser.add_argument('--timeout', type=int, default=10, help='連接超時時間（秒）')
    
    args = parser.parse_args()
    
    # 創建客戶端
    client = WebSocketClient(args.url, args.token, args.timeout)
    
    # 處理信號，優雅關閉
    loop = asyncio.get_event_loop()
    for signame in ('SIGINT', 'SIGTERM'):
        if sys.platform != 'win32':  # SIGTERM 在 Windows 上不可用
            loop.add_signal_handler(
                getattr(signal, signame),
                lambda: asyncio.create_task(client.close())
            )
    
    # 運行客戶端
    await client.run_interactive()


if __name__ == "__main__":
    asyncio.run(main()) 