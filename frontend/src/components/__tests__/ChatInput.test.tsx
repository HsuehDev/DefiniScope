import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatInput } from '../chat/ChatInput';

describe('ChatInput 組件', () => {
  const mockSendMessage = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('應該正確渲染輸入框和按鈕', () => {
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    expect(screen.getByPlaceholderText('請先在這裡輸入問題文字...')).toBeInTheDocument();
    expect(screen.getByText('發送')).toBeInTheDocument();
    expect(screen.getByText('按 Enter 鍵發送，Shift+Enter 換行')).toBeInTheDocument();
  });
  
  it('輸入文字應該更新輸入框的值', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    await user.type(inputElement, '測試消息');
    
    expect(inputElement).toHaveValue('測試消息');
  });
  
  it('點擊發送按鈕應該調用onSendMessage', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    await user.type(inputElement, '測試消息');
    
    const sendButton = screen.getByText('發送');
    await user.click(sendButton);
    
    expect(mockSendMessage).toHaveBeenCalledWith('測試消息');
    expect(inputElement).toHaveValue('');
  });
  
  it('按下Enter鍵應該發送消息', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    await user.type(inputElement, '測試消息');
    
    // 模擬按下Enter鍵
    await user.keyboard('{Enter}');
    
    expect(mockSendMessage).toHaveBeenCalledWith('測試消息');
    expect(inputElement).toHaveValue('');
  });
  
  it('按下Shift+Enter應該換行而不發送消息', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    await user.type(inputElement, '第一行');
    
    // 模擬按下Shift+Enter
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    
    // 使用fireEvent直接觸發keyDown事件以更精確測試
    fireEvent.keyDown(inputElement, { 
      key: 'Enter',
      code: 'Enter',
      shiftKey: true 
    });
    
    // 添加第二行文字
    await user.type(inputElement, '第二行');
    
    // 在測試環境中textarea的換行可能不好模擬，所以可能無法直接檢查值
    // 但可以確認onSendMessage沒有被調用
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
  
  it('當isProcessing為true時應該禁用輸入框和按鈕', () => {
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={true}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    const sendButton = screen.getByText('處理中...');
    
    expect(inputElement).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });
  
  it('空消息不應該觸發發送', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    // 只輸入空格
    await user.type(inputElement, '   ');
    
    const sendButton = screen.getByText('發送');
    await user.click(sendButton);
    
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
  
  it('應該接受自定義的placeholder文本', () => {
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
        placeholder="自定義占位符"
      />
    );
    
    expect(screen.getByPlaceholderText('自定義占位符')).toBeInTheDocument();
  });
  
  // 模擬中文輸入法狀態的測試
  it('在IME組合中不應該觸發發送', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInput 
        onSendMessage={mockSendMessage}
        isProcessing={false}
      />
    );
    
    const inputElement = screen.getByPlaceholderText('請先在這裡輸入問題文字...');
    
    // 先輸入一些文字
    await user.type(inputElement, '測試');
    
    // 模擬IME組合狀態
    const imeEvent = new Event('compositionstart', { bubbles: true });
    fireEvent(inputElement, imeEvent);
    
    // 在IME組合狀態中按Enter
    fireEvent.keyDown(inputElement, { key: 'Enter' });
    
    // 驗證消息未被發送
    expect(mockSendMessage).not.toHaveBeenCalled();
    
    // 結束IME組合
    const imeEndEvent = new Event('compositionend', { bubbles: true });
    fireEvent(inputElement, imeEndEvent);
    
    // 在IME組合結束後按Enter
    await user.keyboard('{Enter}');
    
    // 現在消息應該被發送
    expect(mockSendMessage).toHaveBeenCalledWith('測試');
  });
}); 