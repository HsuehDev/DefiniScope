import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessingProgress } from '../ProcessingProgress';
import { FileProcessingProgress } from '../../../types/progress';

// 模擬WebSocket
vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    error: null,
    isFallbackMode: false,
    sendMessage: vi.fn()
  }))
}));

describe('WebSocket整合測試 - 進度顯示', () => {
  const mockHandleSentenceClick = vi.fn();
  
  // 基本檔案處理進度
  const baseProgress: FileProcessingProgress = {
    file_uuid: 'test-file-123',
    progress: 0,
    status: 'pending',
    currentStep: '等待處理',
    extractedSentences: [],
    classifiedSentences: []
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('應該根據WebSocket事件更新進度顯示 (開始處理)', async () => {
    // 渲染組件，傳入初始進度
    const { rerender } = render(
      <ProcessingProgress 
        type="file"
        progress={baseProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查初始狀態
    expect(screen.getByText('等待處理')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    // 模擬接收WebSocket消息 - 處理開始
    const progressStarted: FileProcessingProgress = {
      ...baseProgress,
      status: 'processing',
      progress: 5,
      currentStep: '開始處理文件'
    };
    
    // 重新渲染組件，傳入更新後的進度
    rerender(
      <ProcessingProgress 
        type="file"
        progress={progressStarted}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查UI是否更新
    await waitFor(() => {
      expect(screen.getByText('開始處理文件')).toBeInTheDocument();
      expect(screen.getByText('5%')).toBeInTheDocument();
    });
  });
  
  it('應該根據WebSocket事件更新進度顯示 (PDF提取進度)', async () => {
    // 渲染組件，傳入初始進度
    const { rerender } = render(
      <ProcessingProgress 
        type="file"
        progress={baseProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 模擬接收WebSocket消息 - PDF提取進度
    const pdfExtractionProgress: FileProcessingProgress = {
      ...baseProgress,
      status: 'processing',
      progress: 30,
      current: 3,
      total: 10,
      currentStep: '正在提取PDF文本'
    };
    
    // 重新渲染組件，傳入更新後的進度
    rerender(
      <ProcessingProgress 
        type="file"
        progress={pdfExtractionProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查UI是否更新
    await waitFor(() => {
      expect(screen.getByText('正在提取PDF文本')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('3/10')).toBeInTheDocument();
    });
  });
  
  it('應該根據WebSocket事件更新進度顯示 (句子分類進度及句子內容)', async () => {
    // 渲染組件，傳入初始進度
    const { rerender } = render(
      <ProcessingProgress 
        type="file"
        progress={baseProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 模擬接收WebSocket消息 - 句子分類進度和句子
    const sentenceClassificationProgress: FileProcessingProgress = {
      ...baseProgress,
      status: 'processing',
      progress: 65,
      current: 13,
      total: 20,
      currentStep: '正在進行句子分類',
      classifiedSentences: [
        {
          sentence_uuid: 'sent-123',
          file_uuid: 'file-123',
          sentence: '這是一個概念型定義的句子',
          page: 5,
          defining_type: 'cd',
          reason: '包含明確的概念定義'
        }
      ]
    };
    
    // 重新渲染組件，傳入更新後的進度
    rerender(
      <ProcessingProgress 
        type="file"
        progress={sentenceClassificationProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查UI是否更新 - 進度和階段
    await waitFor(() => {
      expect(screen.getByText('正在進行句子分類')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('13/20')).toBeInTheDocument();
    });
    
    // 檢查詳細面板中的句子
    expect(screen.getByText('已分類句子')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // 一個已分類句子
    expect(screen.getByText('這是一個概念型定義的句子')).toBeInTheDocument();
    expect(screen.getByText('概念型定義')).toBeInTheDocument();
  });
  
  it('應該根據WebSocket事件更新進度顯示 (處理完成)', async () => {
    // 渲染組件，傳入初始進度
    const { rerender } = render(
      <ProcessingProgress 
        type="file"
        progress={baseProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 模擬接收WebSocket消息 - 處理完成
    const processingCompleted: FileProcessingProgress = {
      ...baseProgress,
      status: 'completed',
      progress: 100,
      currentStep: '處理完成',
      extractedSentences: [
        {
          sentence_uuid: 'ext-123',
          file_uuid: 'file-123',
          sentence: '這是提取的句子',
          page: 1
        }
      ],
      classifiedSentences: [
        {
          sentence_uuid: 'cls-123',
          file_uuid: 'file-123',
          sentence: '這是分類的句子',
          page: 1,
          defining_type: 'od',
          reason: '包含操作定義'
        }
      ]
    };
    
    // 重新渲染組件，傳入更新後的進度
    rerender(
      <ProcessingProgress 
        type="file"
        progress={processingCompleted}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查UI是否更新 - 進度和階段
    await waitFor(() => {
      expect(screen.getByText('處理完成')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    
    // 檢查詳細面板中的句子
    expect(screen.getByText('已提取句子')).toBeInTheDocument();
    expect(screen.getByText('已分類句子')).toBeInTheDocument();
  });
  
  it('應該根據WebSocket事件更新進度顯示 (處理失敗)', async () => {
    // 渲染組件，傳入初始進度
    const { rerender } = render(
      <ProcessingProgress 
        type="file"
        progress={baseProgress}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 模擬接收WebSocket消息 - 處理失敗
    const processingFailed: FileProcessingProgress = {
      ...baseProgress,
      status: 'failed',
      progress: 45,
      currentStep: '處理失敗',
      errorMessage: '處理過程中發生錯誤：無法訪問外部API服務'
    };
    
    // 重新渲染組件，傳入更新後的進度
    rerender(
      <ProcessingProgress 
        type="file"
        progress={processingFailed}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查UI是否更新 - 進度和階段
    await waitFor(() => {
      expect(screen.getByText('處理失敗')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
    
    // 檢查錯誤訊息
    expect(screen.getByText('處理過程中發生錯誤：無法訪問外部API服務')).toBeInTheDocument();
  });
  
  it('應該顯示WebSocket連接錯誤', async () => {
    // 渲染組件，傳入連接錯誤
    render(
      <ProcessingProgress 
        type="file"
        progress={baseProgress}
        error="WebSocket連接失敗"
        isFallbackMode={true}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 檢查錯誤訊息顯示
    expect(screen.getByText('WebSocket連接失敗')).toBeInTheDocument();
    expect(screen.getByText(/使用輪詢模式/)).toBeInTheDocument();
  });
  
  it('應該處理句子點擊事件', async () => {
    // 準備包含句子的進度數據
    const progressWithSentences: FileProcessingProgress = {
      ...baseProgress,
      status: 'processing',
      progress: 65,
      currentStep: '正在進行句子分類',
      classifiedSentences: [
        {
          sentence_uuid: 'sent-123',
          file_uuid: 'file-123',
          sentence: '這是一個測試句子',
          page: 5,
          defining_type: 'cd',
          reason: '測試用'
        }
      ]
    };
    
    // 渲染組件
    render(
      <ProcessingProgress 
        type="file"
        progress={progressWithSentences}
        onSentenceClick={mockHandleSentenceClick}
      />
    );
    
    // 模擬點擊句子
    const sentenceElement = screen.getByText('這是一個測試句子');
    sentenceElement.click();
    
    // 檢查點擊處理函數是否被調用
    expect(mockHandleSentenceClick).toHaveBeenCalledTimes(1);
    expect(mockHandleSentenceClick).toHaveBeenCalledWith(progressWithSentences.classifiedSentences[0]);
  });
}); 