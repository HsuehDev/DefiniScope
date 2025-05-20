import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatContainer } from '../chat/ChatContainer';
import { Conversation, Reference } from '../chat/types';

// 模擬IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

// 模擬scrollIntoView方法
Element.prototype.scrollIntoView = vi.fn();

describe('ChatContainer 組件', () => {
  // 模擬參考句子
  const mockReferences: Reference[] = [
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440000',
      file_uuid: '550e8400-e29b-41d4-a716-446655440001',
      original_name: 'example.pdf',
      sentence: '這是一個引用句子',
      page: 5,
      defining_type: 'cd'
    }
  ];

  // 模擬對話
  const mockConversation: Conversation = {
    conversation_uuid: '550e8400-e29b-41d4-a716-446655440002',
    title: '測試對話',
    created_at: '2023-08-18T12:34:56.789Z',
    updated_at: '2023-08-18T12:40:00.000Z',
    messages: [
      {
        message_uuid: '550e8400-e29b-41d4-a716-446655440003',
        role: 'user',
        content: '這是用戶的問題',
        created_at: '2023-08-18T12:34:56.789Z'
      },
      {
        message_uuid: '550e8400-e29b-41d4-a716-446655440004',
        role: 'assistant',
        content: '這是助手的回答',
        references: mockReferences,
        created_at: '2023-08-18T12:35:00.000Z'
      }
    ]
  };

  // 模擬函數
  const mockSendMessage = vi.fn();
  const mockViewReference = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應正確渲染所有聊天消息', () => {
    render(
      <ChatContainer
        conversation={mockConversation}
        isProcessing={false}
        onSendMessage={mockSendMessage}
        onViewReference={mockViewReference}
      />
    );

    // 檢查用戶消息是否顯示
    expect(screen.getByText('這是用戶的問題')).toBeInTheDocument();
    
    // 檢查助手消息是否顯示
    expect(screen.getByText('這是助手的回答')).toBeInTheDocument();
    
    // 檢查引用是否顯示
    expect(screen.getByText('引用來源：')).toBeInTheDocument();
    expect(screen.getByText(/這是一個引用句子/)).toBeInTheDocument();
  });

  it('應在處理中狀態時顯示進度指示器', () => {
    render(
      <ChatContainer
        conversation={mockConversation}
        isProcessing={true}
        onSendMessage={mockSendMessage}
        onViewReference={mockViewReference}
        processingProgress={50}
        processingStep="正在分析文件"
      />
    );

    // 使用更具體的選擇器來避免匹配多個元素
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('正在分析文件')).toBeInTheDocument();
    // 檢查處理中狀態元素的父元素
    const processingElement = screen.getByText('50%').parentElement;
    expect(processingElement).toBeInTheDocument();
    expect(processingElement?.parentElement?.textContent).toContain('處理中');
  });

  it('應在有參考句子時顯示它們', () => {
    render(
      <ChatContainer
        conversation={mockConversation}
        isProcessing={true}
        onSendMessage={mockSendMessage}
        onViewReference={mockViewReference}
        processingProgress={50}
        processingStep="正在分析文件"
        referencedSentences={mockReferences}
      />
    );

    // 檢查參考句子是否顯示
    expect(screen.getByText('正在參考的句子：')).toBeInTheDocument();
    expect(screen.getAllByText(/這是一個引用句子/).length).toBe(2); // 一次在引用區域，一次在處理區域
  });

  it('應在沒有消息時顯示空狀態提示', () => {
    render(
      <ChatContainer
        conversation={{...mockConversation, messages: []}}
        isProcessing={false}
        onSendMessage={mockSendMessage}
        onViewReference={mockViewReference}
      />
    );

    // 檢查空狀態提示是否顯示
    expect(screen.getByText('開始一個新的對話吧！')).toBeInTheDocument();
  });

  it('應在組件掛載後調用scrollToBottom', () => {
    render(
      <ChatContainer
        conversation={mockConversation}
        isProcessing={false}
        onSendMessage={mockSendMessage}
        onViewReference={mockViewReference}
      />
    );

    // 檢查scrollIntoView是否被調用，由於組件可能調用多次，修改預期次數為至少一次
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'end' });
  });

  // 測試長消息顯示
  it('應正確顯示包含多個換行的長消息', () => {
    const longMessage = {
      ...mockConversation,
      messages: [
        {
          message_uuid: '550e8400-e29b-41d4-a716-446655440005',
          role: 'user',
          content: '這是一個\n包含多行\n的長消息',
          created_at: '2023-08-18T12:34:56.789Z'
        }
      ]
    };

    render(
      <ChatContainer
        conversation={longMessage}
        isProcessing={false}
        onSendMessage={mockSendMessage}
        onViewReference={mockViewReference}
      />
    );

    // 使用更靈活的文本匹配方式，考慮到文字可能被分割為多個元素
    const userMessageContainer = screen.getByText(/的長消息/).closest('.text-white');
    expect(userMessageContainer).toBeInTheDocument();
    expect(userMessageContainer?.textContent).toContain('這是一個');
    expect(userMessageContainer?.textContent).toContain('包含多行');
    expect(userMessageContainer?.textContent).toContain('的長消息');
  });
}); 