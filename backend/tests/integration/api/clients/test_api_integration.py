import os
import pytest
import asyncio
from backend.app.api.clients.split_sentences_client import SplitSentencesAPIClient
from backend.app.api.clients.n8n_api_client import N8nApiClient

# 跳過這些測試，除非明確設置 RUN_INTEGRATION_TESTS 環境變量
pytestmark = pytest.mark.skipif(
    not os.environ.get('RUN_INTEGRATION_TESTS'),
    reason="需要設置 RUN_INTEGRATION_TESTS=1 才運行整合測試"
)

@pytest.fixture
def test_pdf_path():
    """提供測試 PDF 文件路徑"""
    return os.path.join(os.path.dirname(__file__), '../../../test_files', 'test_document.pdf')

@pytest.mark.asyncio
async def test_split_sentences_integration(test_pdf_path):
    """測試與實際 split_sentences 服務的整合"""
    # 從環境變量獲取 API URL
    api_url = os.environ.get('SPLIT_SENTENCES_API_URL', 'http://localhost:8000')
    
    # 讀取測試 PDF
    with open(test_pdf_path, 'rb') as f:
        pdf_content = f.read()
    
    # 調用實際服務
    client = SplitSentencesAPIClient(base_url=api_url)
    sentences = await client.split_pdf_sentences(pdf_content, "test_document.pdf")
    
    # 基本驗證
    assert len(sentences) > 0
    assert all('sentence' in s and 'page' in s for s in sentences)
    
    # 打印一些結果以供檢視
    print(f"成功提取 {len(sentences)} 個句子")
    for i, s in enumerate(sentences[:3]):  # 只打印前 3 個
        print(f"句子 {i+1}: {s['sentence']} (頁 {s['page']})")

@pytest.mark.asyncio
async def test_n8n_sentence_classification_integration():
    """測試與實際 n8n 服務的整合"""
    # 從環境變量獲取 API URL
    api_url = os.environ.get('N8N_API_URL', 'http://localhost:5678')
    api_key = os.environ.get('N8N_API_KEY')
    
    # 準備測試句子
    test_sentences = [
        {"sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。", "page": 1},
        {"sentence": "研究者通過記錄參與者完成任務的時間來測量學習效果。", "page": 2},
        {"sentence": "這只是一個普通的描述性句子，不包含任何定義。", "page": 3}
    ]
    
    # 調用實際服務
    client = N8nApiClient(base_url=api_url, api_key=api_key)
    results = await client.classify_sentences(test_sentences)
    
    # 基本驗證
    assert len(results) == len(test_sentences)
    assert all('defining_type' in r and 'reason' in r for r in results)
    
    # 打印結果以供檢視
    for r in results:
        print(f"句子: {r['sentence']}")
        print(f"分類: {r['defining_type']}")
        print(f"原因: {r['reason']}")
        print("---")

@pytest.mark.asyncio
async def test_n8n_keyword_extraction_integration():
    """測試與實際 n8n 關鍵詞提取服務的整合"""
    # 從環境變量獲取 API URL
    api_url = os.environ.get('N8N_API_URL', 'http://localhost:5678')
    api_key = os.environ.get('N8N_API_KEY')
    
    # 準備測試查詢
    test_query = "什麼是自適應專業知識？"
    
    # 調用實際服務
    client = N8nApiClient(base_url=api_url, api_key=api_key)
    keywords = await client.extract_keywords(test_query)
    
    # 基本驗證
    assert len(keywords) > 0
    assert isinstance(keywords, list)
    assert all(isinstance(k, str) for k in keywords)
    
    # 打印結果以供檢視
    print(f"從查詢 '{test_query}' 中提取到 {len(keywords)} 個關鍵詞:")
    for k in keywords:
        print(f"- {k}")

@pytest.mark.asyncio
async def test_n8n_answer_generation_integration():
    """測試與實際 n8n 答案生成服務的整合"""
    # 從環境變量獲取 API URL
    api_url = os.environ.get('N8N_API_URL', 'http://localhost:5678')
    api_key = os.environ.get('N8N_API_KEY')
    
    # 準備測試數據
    test_query = "什麼是自適應專業知識？"
    relevant_sentences = [
        {
            "sentence_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "file_uuid": "550e8400-e29b-41d4-a716-446655440001",
            "sentence": "自適應專業知識是指個體在面對複雜和動態環境時，能夠靈活應用和調整自身知識結構的能力。",
            "page": 1,
            "defining_type": "cd",
            "original_name": "example.pdf"
        }
    ]
    
    # 調用實際服務
    client = N8nApiClient(base_url=api_url, api_key=api_key)
    result = await client.generate_answer(test_query, relevant_sentences)
    
    # 基本驗證
    assert "answer" in result
    assert "references" in result
    assert len(result["references"]) > 0
    
    # 打印結果以供檢視
    print(f"查詢: {test_query}")
    print(f"回答: {result['answer']}")
    print(f"引用數量: {len(result['references'])}")
    for i, ref in enumerate(result["references"]):
        print(f"引用 {i+1}: {ref['sentence']} (頁 {ref['page']})") 