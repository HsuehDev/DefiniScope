/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import React from 'react';
import type { SentenceReference, ProcessingReference } from '../../types/reference';

// 先模擬服務
vi.mock('../../services/chatService', () => {
  return {
    fetchMessageReferences: vi.fn()
  };
});

// 導入組件和服務
import ReferencePanel from '../../components/ReferencePanel/ReferencePanel';
import { fetchMessageReferences } from '../../services/chatService';

describe('ReferencePanel 組件測試', () => {
  const mockViewInPdf = vi.fn();
  
  // 模擬CD參考句子
  const mockCdReferences: SentenceReference[] = [
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440000',
      file_uuid: '550e8400-e29b-41d4-a716-446655440001',
      original_name: 'example1.pdf',
      sentence: '自適應專業知識是指個體能夠根據環境變化調整其專業知識結構與內容的能力。',
      page: 3,
      defining_type: 'cd',
      reason: '此句包含明確的概念定義'
    },
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440002',
      file_uuid: '550e8400-e29b-41d4-a716-446655440001',
      original_name: 'example1.pdf',
      sentence: '概念型定義是指對概念本身的界定與解釋，包含概念的本質特徵。',
      page: 5,
      defining_type: 'cd',
      reason: '此句對概念型定義進行定義'
    }
  ];

  // 模擬處理過程參考信息
  const mockProcessingReference: ProcessingReference = {
    event: 'sentence_classification_detail',
    file_uuid: '550e8400-e29b-41d4-a716-446655440001',
    sentences: mockCdReferences,
    timestamp: '2023-08-18T12:40:05.000Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fetchMessageReferences as any).mockResolvedValue({
      references: mockCdReferences
    });
  });

  it('應正確渲染來自處理過程的參考信息', () => {
    const { container } = render(
      <ReferencePanel
        processingReference={mockProcessingReference}
        onViewInPdf={mockViewInPdf}
        referenceSource="processing"
      />
    );

    // 檢查標題
    expect(screen.getByText('句子分類結果')).toBeInTheDocument();
    
    // 檢查參考句子數量
    expect(screen.getByText(/共找到 2 個參考句子/)).toBeInTheDocument();
    
    // 檢查參考句子內容
    expect(screen.getByText('自適應專業知識是指個體能夠根據環境變化調整其專業知識結構與內容的能力。')).toBeInTheDocument();
    expect(screen.getByText('概念型定義是指對概念本身的界定與解釋，包含概念的本質特徵。')).toBeInTheDocument();
    
    // 檢查定義類型標記
    const cdBadges = screen.getAllByText('概念型定義');
    expect(cdBadges.length).toBe(2);
    
    // 檢查分類原因 - 使用容器和選擇器確保獲取正確的元素
    const reasonElements = container.querySelectorAll('.mt-2.text-xs.text-gray-500.italic.pt-1.border-t');
    expect(reasonElements[0].textContent).toContain('此句包含明確的概念定義');
    expect(reasonElements[1].textContent).toContain('此句對概念型定義進行定義');
  });

  it('點擊"在PDF中查看"按鈕時應調用onViewInPdf回調', () => {
    render(
      <ReferencePanel
        processingReference={mockProcessingReference}
        onViewInPdf={mockViewInPdf}
        referenceSource="processing"
      />
    );

    // 點擊第一個"在PDF中查看"按鈕
    const viewButtons = screen.getAllByText('在PDF中查看');
    fireEvent.click(viewButtons[0]);

    // 檢查是否使用正確參數調用了onViewInPdf
    expect(mockViewInPdf).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440001',  // file_uuid
      3,                                        // page
      '550e8400-e29b-41d4-a716-446655440000'   // sentence_uuid
    );
  });

  it('應顯示加載狀態', async () => {
    // 延遲解析的 Promise，以確保顯示加載狀態
    (fetchMessageReferences as any).mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ references: mockCdReferences });
        }, 100);
      });
    });

    render(
      <ReferencePanel
        selectedMessageUuid="test-message-uuid"
        onViewInPdf={mockViewInPdf}
        referenceSource="chat"
      />
    );

    // 檢查加載狀態
    expect(screen.getByText('正在加載參考資訊...')).toBeInTheDocument();

    // 等待加載完成
    await waitFor(() => {
      expect(screen.queryByText('正在加載參考資訊...')).not.toBeInTheDocument();
    });
  });

  it('應顯示錯誤信息', async () => {
    // 模擬API錯誤
    (fetchMessageReferences as any).mockRejectedValue(new Error('API 錯誤'));

    render(
      <ReferencePanel
        selectedMessageUuid="test-message-uuid"
        onViewInPdf={mockViewInPdf}
        referenceSource="chat"
      />
    );

    // 等待加載状态消失，錯誤信息顯示
    await waitFor(() => {
      expect(screen.getByText('無法加載參考信息，請稍後再試')).toBeInTheDocument();
    });
  });

  it('當沒有參考句子時應顯示提示信息', () => {
    // 模擬空參考列表
    const emptyProcessingReference: ProcessingReference = {
      event: 'sentence_classification_detail',
      file_uuid: '550e8400-e29b-41d4-a716-446655440001',
      sentences: [],
      timestamp: '2023-08-18T12:40:05.000Z'
    };

    render(
      <ReferencePanel
        processingReference={emptyProcessingReference}
        onViewInPdf={mockViewInPdf}
        referenceSource="processing"
      />
    );

    // 檢查空數據提示信息
    expect(screen.getByText('沒有找到相關參考句子')).toBeInTheDocument();
  });
}); 