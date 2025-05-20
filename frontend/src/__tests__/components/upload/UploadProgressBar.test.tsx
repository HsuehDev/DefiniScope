import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { UploadProgressBar } from '../../../components/upload/UploadProgressBar';
import { UploadStatus } from '../../../types/upload';

// 模擬格式化功能
vi.mock('../../../utils/uploadUtils', () => ({
  formatFileSize: vi.fn((bytes) => `${bytes / 1024} KB`),
  formatTime: vi.fn((seconds) => `00:${seconds.toString().padStart(2, '0')}`),
  formatSpeed: vi.fn((speed) => `${speed / 1024} KB/s`)
}));

describe('UploadProgressBar 組件', () => {
  // 基本屬性
  const defaultProps = {
    progress: 50,
    status: UploadStatus.UPLOADING,
    fileSize: 1024 * 1024, // 1MB
    uploadedBytes: 512 * 1024, // 512KB
    speed: 100 * 1024, // 100KB/s
    remainingTime: 30, // 30 seconds
    timeoutWarning: false,
  };
  
  test('應該正確渲染上傳進度條和進度信息', () => {
    render(<UploadProgressBar {...defaultProps} />);
    
    // 檢查進度條存在
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle('width: 50%');
    
    // 檢查狀態文本
    expect(screen.getByTestId('status-text')).toHaveTextContent('上傳中');
    
    // 檢查上傳進度信息
    expect(screen.getByTestId('progress-info')).toHaveTextContent('512 KB / 1024 KB');
    
    // 檢查上傳速度
    expect(screen.getByTestId('upload-speed')).toHaveTextContent('100 KB/s');
    
    // 檢查剩餘時間
    expect(screen.getByTestId('remaining-time')).toHaveTextContent('剩餘 00:30');
  });
  
  test('當上傳成功時，應該顯示成功狀態', () => {
    render(
      <UploadProgressBar 
        {...defaultProps}
        status={UploadStatus.SUCCESS}
        progress={100}
        uploadedBytes={1024 * 1024}
      />
    );
    
    // 檢查進度條樣式
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveClass('bg-green-500');
    
    // 檢查狀態文本
    expect(screen.getByTestId('status-text')).toHaveTextContent('上傳完成');
    
    // 檢查進度信息
    expect(screen.getByTestId('progress-info')).toHaveTextContent('1024 KB / 1024 KB');
    
    // 速度和剩餘時間不應顯示
    expect(screen.queryByTestId('upload-speed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remaining-time')).not.toBeInTheDocument();
  });
  
  test('當上傳失敗時，應該顯示錯誤狀態和錯誤信息', () => {
    render(
      <UploadProgressBar 
        {...defaultProps}
        status={UploadStatus.ERROR}
        progress={25}
        errorMessage="網絡連接失敗"
      />
    );
    
    // 檢查進度條樣式
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveClass('bg-red-500');
    
    // 檢查狀態文本
    expect(screen.getByTestId('status-text')).toHaveTextContent('錯誤: 網絡連接失敗');
  });
  
  test('當上傳暫停時，應該顯示暫停狀態', () => {
    render(
      <UploadProgressBar 
        {...defaultProps}
        status={UploadStatus.PAUSED}
        speed={0}
      />
    );
    
    // 檢查進度條樣式
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveClass('bg-gray-500');
    
    // 檢查狀態文本
    expect(screen.getByTestId('status-text')).toHaveTextContent('已暫停');
    
    // 速度和剩餘時間不應顯示
    expect(screen.queryByTestId('upload-speed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remaining-time')).not.toBeInTheDocument();
  });
  
  test('當上傳超時時，應該顯示超時狀態', () => {
    render(
      <UploadProgressBar 
        {...defaultProps}
        status={UploadStatus.TIMEOUT}
      />
    );
    
    // 檢查進度條樣式
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveClass('bg-red-500');
    
    // 檢查狀態文本
    expect(screen.getByTestId('status-text')).toHaveTextContent('上傳超時 (10分鐘)');
  });
  
  test('當顯示超時警告時，進度條和剩餘時間應有警告樣式', () => {
    render(
      <UploadProgressBar 
        {...defaultProps}
        timeoutWarning={true}
      />
    );
    
    // 檢查進度條樣式
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveClass('bg-yellow-500');
    
    // 檢查狀態文本
    expect(screen.getByTestId('status-text')).toHaveTextContent('上傳中 (警告: 接近超時)');
    
    // 檢查剩餘時間警告樣式
    const remainingTime = screen.getByTestId('remaining-time');
    expect(remainingTime).toHaveClass('text-red-500');
    expect(remainingTime).toHaveClass('font-bold');
  });
}); 