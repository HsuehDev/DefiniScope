import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteFileDialog } from '../files/DeleteFileDialog';
import { FileStatus } from '../../types/files';

describe('DeleteFileDialog元件', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockFile = {
    file_uuid: '550e8400-e29b-41d4-a716-446655440000',
    original_name: 'example1.pdf',
    size_bytes: 1024000,
    upload_status: 'completed' as FileStatus,
    processing_status: 'completed' as FileStatus,
    sentence_count: 120,
    cd_count: 5,
    od_count: 8,
    created_at: '2023-08-18T12:34:56.789Z',
    updated_at: '2023-08-18T13:00:00.000Z'
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('當開啟時應顯示確認對話框', () => {
    render(
      <DeleteFileDialog
        isOpen={true}
        file={mockFile}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
        error={null}
      />
    );

    // 檢查對話框標題和內容
    expect(screen.getByText('確認刪除檔案')).toBeInTheDocument();
    expect(screen.getByText(/您即將刪除以下檔案/)).toBeInTheDocument();
    expect(screen.getByText('example1.pdf')).toBeInTheDocument();
    
    // 檢查確認和取消按鈕
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /確認刪除/ })).toBeInTheDocument();
  });

  test('當關閉時不應顯示對話框', () => {
    render(
      <DeleteFileDialog
        isOpen={false}
        file={mockFile}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
        error={null}
      />
    );

    // 檢查對話框不存在
    expect(screen.queryByText('確認刪除檔案')).not.toBeInTheDocument();
  });

  test('點擊刪除按鈕應觸發onConfirm回調', () => {
    render(
      <DeleteFileDialog
        isOpen={true}
        file={mockFile}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
        error={null}
      />
    );

    // 點擊刪除按鈕
    fireEvent.click(screen.getByRole('button', { name: /確認刪除/ }));
    
    // 檢查回調是否被調用
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  test('點擊取消按鈕應觸發onCancel回調', () => {
    render(
      <DeleteFileDialog
        isOpen={true}
        file={mockFile}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
        error={null}
      />
    );

    // 點擊取消按鈕
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    
    // 檢查回調是否被調用
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  test('當正在刪除時應顯示載入狀態', () => {
    render(
      <DeleteFileDialog
        isOpen={true}
        file={mockFile}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={true}
        error={null}
      />
    );

    // 檢查刪除按鈕是否處於禁用狀態
    const deleteButton = screen.getByRole('button', { name: /刪除中/ });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    
    // 檢查取消按鈕是否處於禁用狀態
    const cancelButton = screen.getByRole('button', { name: '取消' });
    expect(cancelButton).toBeDisabled();
  });
}); 