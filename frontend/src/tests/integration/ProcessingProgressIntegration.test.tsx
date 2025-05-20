import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessingProgress } from '../../components/ProcessingProgress/ProcessingProgress';
import { FileProcessingStatus, FileProcessingProgress, DefiningType } from '../../types/progress';

describe('ProcessingProgress組件整合測試', () => {
  // 初始狀態測試數據
  const testData = {
    // 待處理狀態
    pendingProgress: {
      file_uuid: 'file-123',
      progress: 0,
      status: 'pending' as FileProcessingStatus,
      currentStep: '等待處理',
      extractedSentences: [],
      classifiedSentences: []
    } as FileProcessingProgress,
    
    // 提取PDF進度狀態
    extractingProgress: {
      file_uuid: 'file-123',
      progress: 35,
      status: 'processing' as FileProcessingStatus,
      currentStep: '正在提取PDF文本',
      current: 3,
      total: 10,
      extractedSentences: [
        {
          sentence_uuid: 'sent-1',
          file_uuid: 'file-123',
          sentence: '第一個提取的句子',
          page: 1
        }
      ],
      classifiedSentences: []
    } as FileProcessingProgress,
    
    // 句子分類進度狀態
    classifyingProgress: {
      file_uuid: 'file-123',
      progress: 65,
      status: 'processing' as FileProcessingStatus,
      currentStep: '正在進行句子分類',
      current: 13,
      total: 20,
      extractedSentences: [
        {
          sentence_uuid: 'sent-1',
          file_uuid: 'file-123',
          sentence: '提取的句子',
          page: 1
        }
      ],
      classifiedSentences: [
        {
          sentence_uuid: 'sent-1',
          file_uuid: 'file-123',
          sentence: '這是一個概念型定義的句子',
          page: 5,
          defining_type: 'cd' as DefiningType,
          reason: '包含明確的概念定義'
        }
      ]
    } as FileProcessingProgress,
    
    // 處理完成狀態
    completedProgress: {
      file_uuid: 'file-123',
      progress: 100,
      status: 'completed' as FileProcessingStatus,
      currentStep: '處理完成',
      extractedSentences: [],
      classifiedSentences: []
    } as FileProcessingProgress,
    
    // 處理失敗狀態
    failedProgress: {
      file_uuid: 'file-123',
      progress: 45,
      status: 'failed' as FileProcessingStatus,
      currentStep: '處理失敗',
      errorMessage: '無法處理檔案，格式不支援',
      extractedSentences: [],
      classifiedSentences: []
    } as FileProcessingProgress
  };

  // 模擬處理過程進度變化
  const simulateProcessing = async (setState: (value: any) => void) => {
    // 從待處理到提取文本
    setState(testData.pendingProgress);
    await new Promise(r => setTimeout(r, 100));
    
    // 提取文本進度
    setState(testData.extractingProgress);
    await new Promise(r => setTimeout(r, 100));
    
    // 句子分類進度
    setState(testData.classifyingProgress);
    await new Promise(r => setTimeout(r, 100));
    
    // 處理完成
    setState(testData.completedProgress);
  };

  it('應顯示待處理狀態', () => {
    render(<ProcessingProgress type="file" progress={testData.pendingProgress} />);
    
    const currentStep = screen.getByTestId('current-step');
    expect(currentStep).toHaveTextContent('等待處理');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('應顯示PDF提取進度', () => {
    render(<ProcessingProgress type="file" progress={testData.extractingProgress} />);
    
    const currentStep = screen.getByTestId('current-step');
    expect(currentStep).toHaveTextContent(/提取PDF文本/);
    expect(currentStep).toHaveTextContent(/3\/10/);
    expect(screen.getByText('35%')).toBeInTheDocument();
    
    // 確認詳細信息是否顯示
    const detailPanel = screen.getByTestId('detail-panel-container');
    expect(detailPanel).toBeInTheDocument();
    
    // 檢查提取的句子區塊是否存在
    const extractedHeader = screen.getByTestId('extracted-sentences-header');
    expect(extractedHeader).toHaveTextContent('已提取句子');
    expect(extractedHeader).toHaveTextContent('1');
  });

  it('應顯示句子分類進度和句子內容', async () => {
    render(<ProcessingProgress type="file" progress={testData.classifyingProgress} />);
    
    const currentStep = screen.getByTestId('current-step');
    expect(currentStep).toHaveTextContent(/句子分類/);
    expect(currentStep).toHaveTextContent(/13\/20/);
    expect(screen.getByText('65%')).toBeInTheDocument();
    
    // 確認分類標題存在
    const classifiedHeader = screen.getByTestId('classified-sentences-header');
    expect(classifiedHeader).toHaveTextContent('已分類句子');
    expect(classifiedHeader).toHaveTextContent('1');
    
    // 確認分類內容區域（默認展開）
    const classifiedContent = screen.getByTestId('classified-sentences-content');
    expect(classifiedContent).toBeInTheDocument();
    expect(classifiedContent).toHaveTextContent('這是一個概念型定義的句子');
    expect(classifiedContent).toHaveTextContent('概念型定義');
  });

  it('應顯示處理完成狀態', () => {
    render(<ProcessingProgress type="file" progress={testData.completedProgress} />);
    
    const currentStep = screen.getByTestId('current-step');
    expect(currentStep).toHaveTextContent('處理完成');
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    // 完成狀態下進度條應該是綠色
    const progressBar = screen.getByText('100%').parentElement?.parentElement?.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('應顯示處理失敗狀態', () => {
    render(<ProcessingProgress type="file" progress={testData.failedProgress} />);
    
    const currentStep = screen.getByTestId('current-step');
    expect(currentStep).toHaveTextContent('處理失敗');
    
    // 檢查錯誤信息是否顯示
    const errorMessage = screen.getByText(/無法處理檔案/);
    expect(errorMessage).toBeInTheDocument();
    
    // 失敗狀態下進度條應該是紅色
    const progressBar = screen.getByText('45%').parentElement?.parentElement?.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('應顯示WebSocket連接錯誤', () => {
    render(
      <ProcessingProgress
        type="file"
        progress={testData.pendingProgress}
        error="WebSocket連接失敗，請檢查網絡"
        isFallbackMode={true}
      />
    );
    
    // 檢查輪詢模式文本是否存在
    const errorBanner = screen.getByText(/WebSocket連接失敗/);
    expect(errorBanner).toBeInTheDocument();
    expect(errorBanner).toHaveTextContent(/輪詢模式/);
  });

  it('應處理句子點擊事件', () => {
    const handleSentenceClick = vi.fn();
    
    render(
      <ProcessingProgress
        type="file"
        progress={testData.classifyingProgress}
        onSentenceClick={handleSentenceClick}
      />
    );
    
    // 找到句子卡片元素並點擊
    const sentenceCard = screen.getByText('這是一個概念型定義的句子').closest('[data-testid="sentence-card"]');
    expect(sentenceCard).toBeInTheDocument();
    
    fireEvent.click(sentenceCard!);
    expect(handleSentenceClick).toHaveBeenCalledTimes(1);
  });
  
  it('應支持展開和折疊詳細信息', () => {
    render(<ProcessingProgress type="file" progress={testData.classifyingProgress} />);
    
    // 詳細信息面板默認顯示
    const detailPanel = screen.getByTestId('detail-panel-container');
    expect(detailPanel).toBeInTheDocument();
    
    // 點擊折疊按鈕 (沒有名稱，所以直接用第一個按鈕)
    const collapseButton = screen.getByRole('button');
    fireEvent.click(collapseButton);
    
    // 詳細信息應該隱藏
    expect(screen.queryByTestId('detail-panel-container')).not.toBeInTheDocument();
    
    // 再次點擊展開
    fireEvent.click(collapseButton);
    
    // 詳細信息應該再次顯示
    expect(screen.getByTestId('detail-panel-container')).toBeInTheDocument();
  });
  
  it('應顯示剩餘時間估計（處理中狀態）', () => {
    render(<ProcessingProgress type="file" progress={testData.extractingProgress} />);
    
    // 檢查剩餘時間估計是否顯示
    const timeEstimate = screen.getByText(/預估剩餘時間/);
    expect(timeEstimate).toBeInTheDocument();
  });
  
  it('應模擬完整處理流程', async () => {
    // 建立一個可控的進度狀態
    let currentProgress: FileProcessingProgress = testData.pendingProgress;
    const setProgress = (newProgress: FileProcessingProgress) => {
      currentProgress = newProgress;
      rerender(<ProcessingProgress type="file" progress={currentProgress} />);
    };
    
    // 初始渲染
    const { rerender } = render(<ProcessingProgress type="file" progress={currentProgress} />);
    
    // 初始狀態檢查
    expect(screen.getByTestId('current-step')).toHaveTextContent('等待處理');
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    // 模擬提取文本階段
    setProgress(testData.extractingProgress);
    expect(screen.getByTestId('current-step')).toHaveTextContent(/提取PDF文本/);
    expect(screen.getByText('35%')).toBeInTheDocument();
    
    // 模擬分類階段
    setProgress(testData.classifyingProgress);
    expect(screen.getByTestId('current-step')).toHaveTextContent(/句子分類/);
    expect(screen.getByText('65%')).toBeInTheDocument();
    
    // 模擬完成階段
    setProgress(testData.completedProgress);
    expect(screen.getByTestId('current-step')).toHaveTextContent('處理完成');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
}); 