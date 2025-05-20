"""
Redis Pub/Sub 監聽器完整實現示例
"""
import asyncio
import threading
import redis
import json
from loguru import logger

from app.core.config import settings
from app.core.websocket_redis_adapter import adapter


def redis_listener_thread(stop_event):
    """
    Redis 監聽線程
    
    Args:
        stop_event: 用於停止線程的事件
    """
    try:
        logger.info("啟動 Redis Pub/Sub 監聽線程")
        
        # 連接到 Redis
        r = redis.from_url(settings.REDIS_URL)
        pubsub = r.pubsub()
        
        # 訂閱相關頻道
        pubsub.psubscribe("file_updates:*")
        pubsub.psubscribe("query_updates:*")
        
        # 持續監聽訊息
        for message in pubsub.listen():
            # 檢查是否需要停止
            if stop_event.is_set():
                break
                
            try:
                # 只處理實際消息，跳過訂閱確認消息
                if message['type'] != 'message' and message['type'] != 'pmessage':
                    continue
                    
                # 解析資料
                data = json.loads(message['data'])
                channel = message['channel'].decode('utf-8')
                
                # 分發到事件循環處理
                if channel.startswith('file_updates:'):
                    file_uuid = channel.split(':', 1)[1]
                    event = data.get('event', '')
                    
                    # 使用事件循環執行處理邏輯
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(
                        adapter.handle_file_update(file_uuid, event, data)
                    )
                    loop.close()
                    
                elif channel.startswith('query_updates:'):
                    query_uuid = channel.split(':', 1)[1]
                    event = data.get('event', '')
                    
                    # 使用事件循環執行處理邏輯
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(
                        adapter.handle_query_update(query_uuid, event, data)
                    )
                    loop.close()
                    
            except json.JSONDecodeError:
                logger.error(f"JSON 解析錯誤: {message}")
            except Exception as e:
                logger.error(f"處理 Redis 消息時出錯: {str(e)}")
                
    except Exception as e:
        logger.error(f"Redis 監聽線程發生錯誤: {str(e)}")
    finally:
        logger.info("Redis Pub/Sub 監聽線程已停止")
        pubsub.punsubscribe()
        

def init_listeners(app: FastAPI):
    """
    初始化Redis Pub/Sub監聽器
    
    Args:
        app: FastAPI實例
    """
    logger.info("初始化Redis Pub/Sub監聽器...")
    
    # 創建停止事件
    stop_event = threading.Event()
    
    # 創建並啟動監聽線程
    listener_thread = threading.Thread(
        target=redis_listener_thread,
        args=(stop_event,),
        daemon=True
    )
    listener_thread.start()
    
    # 儲存到應用狀態中，以便在應用關閉時停止線程
    app.state.redis_listener = {
        'thread': listener_thread,
        'stop_event': stop_event
    }
    
    # 註冊關閉事件
    @app.on_event("shutdown")
    def shutdown_redis_listener():
        logger.info("正在關閉 Redis Pub/Sub 監聽器...")
        app.state.redis_listener['stop_event'].set()
        app.state.redis_listener['thread'].join(timeout=5)
        logger.info("Redis Pub/Sub 監聽器已關閉")
    
    logger.info("Redis Pub/Sub監聽器初始化完成") 