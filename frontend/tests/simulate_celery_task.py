#!/usr/bin/env python
"""
模擬 Celery 任務向 WebSocket 發送消息

此腳本模擬檔案處理和查詢處理過程中 Celery 任務向 WebSocket 客戶端發送進度更新
"""
import asyncio
import argparse
import json
import uuid
import time
import sys
import random
import redis
from datetime import datetime
from typing import Dict, List, Optional, Any


# 模擬 Redis 發布器
def publish_file_update(redis_client, file_uuid: str, event: str, data: dict):
    """發布檔案處理更新到 Redis Pub/Sub
    
    Args:
        redis_client: Redis 客戶端
        file_uuid: 檔案 UUID
        event: 事件類型
        data: 事件相關的數據
    """
    message = {
        "event": event,
        "file_uuid": file_uuid,
        **data,
        "timestamp": datetime.now().isoformat()
    }
    
    # 存儲最近的消息，用於新連接時的初始狀態同步
    redis_client.zadd(
        f"recent_updates:file:{file_uuid}", 
        {json.dumps(message): time.time()}
    )
    # 只保留最近的10條消息
    redis_client.zremrangebyrank(f"recent_updates:file:{file_uuid}", 0, -11)
    
    channel = f"file_updates:{file_uuid}"
    redis_client.publish(channel, json.dumps(message))
    print(f"已發布 {event} 事件到 {channel}: {json.dumps(message, indent=2)}")


def publish_query_update(redis_client, query_uuid: str, event: str, data: dict):
    """發布查詢處理更新到 Redis Pub/Sub
    
    Args:
        redis_client: Redis 客戶端
        query_uuid: 查詢 UUID
        event: 事件類型
        data: 事件相關的數據
    """
    message = {
        "event": event,
        "query_uuid": query_uuid,
        **data,
        "timestamp": datetime.now().isoformat()
    }
    
    # 存儲最近的消息，用於新連接時的初始狀態同步
    redis_client.zadd(
        f"recent_updates:query:{query_uuid}", 
        {json.dumps(message): time.time()}
    )
    # 只保留最近的10條消息
    redis_client.zremrangebyrank(f"recent_updates:query:{query_uuid}", 0, -11)
    
    channel = f"query_updates:{query_uuid}"
    redis_client.publish(channel, json.dumps(message))
    print(f"已發布 {event} 事件到 {channel}: {json.dumps(message, indent=2)}")


# 模擬檔案處理任務
async def simulate_file_processing(redis_client, file_uuid: str, total_sentences: int = 100, delay: float = 1.0):
    """模擬檔案處理過程
    
    Args:
        redis_client: Redis 客戶端
        file_uuid: 檔案 UUID
        total_sentences: 句子總數
        delay: 每個階段的延遲時間（秒）
    """
    print(f"開始模擬檔案 {file_uuid} 的處理過程...")
    
    # 處理開始
    publish_file_update(redis_client, file_uuid, "processing_started", {
        "status": "processing"
    })
    await asyncio.sleep(delay)
    
    # PDF 文本提取進度
    max_progress = 100
    batch_size = max(1, max_progress // 10)  # 分10批更新
    for progress in range(0, max_progress + 1, batch_size):
        publish_file_update(redis_client, file_uuid, "pdf_extraction_progress", {
            "progress": progress,
            "current": int(total_sentences * progress / 100),
            "total": total_sentences,
            "status": "processing"
        })
        await asyncio.sleep(delay / 2)
    
    # 句子提取詳情
    for i in range(0, total_sentences, 20):
        batch_size = min(20, total_sentences - i)
        sentences = []
        for j in range(batch_size):
            sentences.append({
                "sentence_uuid": str(uuid.uuid4()),
                "sentence": f"這是第 {i + j + 1} 個測試句子。",
                "page": random.randint(1, 20)
            })
        
        publish_file_update(redis_client, file_uuid, "sentence_extraction_detail", {
            "sentences": sentences
        })
        await asyncio.sleep(delay / 2)
    
    # 句子分類進度
    for progress in range(0, max_progress + 1, batch_size):
        publish_file_update(redis_client, file_uuid, "sentence_classification_progress", {
            "progress": progress,
            "current": int(total_sentences * progress / 100),
            "total": total_sentences,
            "status": "processing"
        })
        await asyncio.sleep(delay / 2)
    
    # 句子分類詳情
    defining_types = ["cd", "od", "none"]
    for i in range(0, total_sentences, 10):
        batch_size = min(10, total_sentences - i)
        sentences = []
        for j in range(batch_size):
            defining_type = random.choice(defining_types)
            reason = ""
            if defining_type == "cd":
                reason = "此句包含明確的概念定義"
            elif defining_type == "od":
                reason = "此句包含操作型定義方法"
            
            sentences.append({
                "sentence_uuid": str(uuid.uuid4()),
                "sentence": f"這是第 {i + j + 1} 個測試句子。",
                "defining_type": defining_type,
                "reason": reason,
                "page": random.randint(1, 20)
            })
        
        publish_file_update(redis_client, file_uuid, "sentence_classification_detail", {
            "sentences": sentences
        })
        await asyncio.sleep(delay / 2)
    
    # 處理完成
    publish_file_update(redis_client, file_uuid, "processing_completed", {
        "status": "completed"
    })
    
    print(f"檔案 {file_uuid} 處理模擬完成")


# 模擬查詢處理任務
async def simulate_query_processing(redis_client, query_uuid: str, delay: float = 1.0):
    """模擬查詢處理過程
    
    Args:
        redis_client: Redis 客戶端
        query_uuid: 查詢 UUID
        delay: 每個階段的延遲時間（秒）
    """
    print(f"開始模擬查詢 {query_uuid} 的處理過程...")
    
    # 查詢處理開始
    publish_query_update(redis_client, query_uuid, "query_processing_started", {
        "status": "processing"
    })
    await asyncio.sleep(delay)
    
    # 關鍵詞提取完成
    keywords = ["自適應專業知識", "專業知識", "自適應", "知識"]
    publish_query_update(redis_client, query_uuid, "keyword_extraction_completed", {
        "keywords": keywords
    })
    await asyncio.sleep(delay)
    
    # 資料庫搜尋進度
    max_progress = 100
    batch_size = max(1, max_progress // 5)  # 分5批更新
    for progress in range(0, max_progress + 1, batch_size):
        publish_query_update(redis_client, query_uuid, "database_search_progress", {
            "progress": progress,
            "keywords": keywords,
            "current_step": "正在搜尋資料庫中符合關鍵詞的定義",
            "found_definitions": {
                "cd": int(3 * progress / 100),
                "od": int(2 * progress / 100)
            }
        })
        await asyncio.sleep(delay / 2)
    
    # 資料庫搜尋結果
    for keyword in keywords:
        found_sentences = []
        for i in range(random.randint(1, 3)):
            found_sentences.append({
                "sentence_uuid": str(uuid.uuid4()),
                "file_uuid": str(uuid.uuid4()),
                "original_name": "example.pdf",
                "sentence": f"關於{keyword}的定義句子 #{i+1}...",
                "page": random.randint(1, 20),
                "defining_type": random.choice(["cd", "od"]),
                "relevance_score": random.uniform(0.7, 0.99)
            })
            
        publish_query_update(redis_client, query_uuid, "database_search_result", {
            "keyword": keyword,
            "found_sentences": found_sentences
        })
        await asyncio.sleep(delay / 2)
    
    # 答案生成開始
    publish_query_update(redis_client, query_uuid, "answer_generation_started", {})
    await asyncio.sleep(delay)
    
    # 參考的句子
    referenced_sentences = []
    for i in range(3):
        referenced_sentences.append({
            "sentence_uuid": str(uuid.uuid4()),
            "file_uuid": str(uuid.uuid4()),
            "original_name": "example.pdf",
            "sentence": f"參考的第 {i+1} 個句子...",
            "page": random.randint(1, 20),
            "defining_type": random.choice(["cd", "od"])
        })
        
    publish_query_update(redis_client, query_uuid, "referenced_sentences", {
        "referenced_sentences": referenced_sentences
    })
    await asyncio.sleep(delay)
    
    # 查詢完成
    publish_query_update(redis_client, query_uuid, "query_completed", {
        "status": "completed"
    })
    
    print(f"查詢 {query_uuid} 處理模擬完成")


async def main():
    parser = argparse.ArgumentParser(description='模擬 Celery 任務向 WebSocket 發送消息')
    parser.add_argument('--redis-url', type=str, default='redis://localhost:6379/0', help='Redis URL')
    parser.add_argument('--type', type=str, choices=['file', 'query'], required=True, help='模擬類型：檔案處理或查詢處理')
    parser.add_argument('--uuid', type=str, help='資源 UUID，如不提供則自動生成')
    parser.add_argument('--sentences', type=int, default=100, help='檔案處理的句子總數')
    parser.add_argument('--delay', type=float, default=1.0, help='每個階段的延遲時間（秒）')
    
    args = parser.parse_args()
    
    # 連接 Redis
    try:
        redis_client = redis.from_url(args.redis_url)
        # 測試連接
        redis_client.ping()
        print(f"成功連接到 Redis: {args.redis_url}")
    except redis.ConnectionError:
        print(f"無法連接到 Redis: {args.redis_url}")
        return 1
    except Exception as e:
        print(f"Redis 錯誤: {str(e)}")
        return 1
    
    # 生成或使用提供的 UUID
    resource_uuid = args.uuid if args.uuid else str(uuid.uuid4())
    print(f"使用資源 UUID: {resource_uuid}")
    
    # 根據類型模擬相應的處理過程
    try:
        if args.type == "file":
            await simulate_file_processing(
                redis_client, 
                resource_uuid, 
                total_sentences=args.sentences, 
                delay=args.delay
            )
        else:  # query
            await simulate_query_processing(
                redis_client,
                resource_uuid,
                delay=args.delay
            )
        return 0
    except KeyboardInterrupt:
        print("\n模擬已中斷")
        return 0
    except Exception as e:
        print(f"模擬過程中出錯: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main())) 