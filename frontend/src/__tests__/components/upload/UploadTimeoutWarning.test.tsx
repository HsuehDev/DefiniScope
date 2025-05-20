import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { UploadTimeoutWarning } from '../../../components/upload/UploadTimeoutWarning';

// 模擬格式化時間功能
vi.mock('../../../utils/uploadUtils', () => ({
  formatTime: vi.fn((seconds) => `00:${seconds.toString().padStart(2, '0')}`)
}));

describe('UploadTimeoutWarning 組件', () => {
  // 基本屬性
  const defaultProps = {
    remainingTime: 90, // 90 seconds
    timeoutMinutes: 10, // 10 minutes timeout
    onCancel: vi.fn(),
    onContinue: vi.fn()
  };
  
  test('應該正確渲染超時警告內容', () => {
    render(<UploadTimeoutWarning {...defaultProps} />);
    
    // 檢查警告標題
    expect(screen.getByText('上傳即將超時')).toBeInTheDocument();
    
    // 檢查剩餘時間顯示
    expect(screen.getByText('剩餘時間: 00:90')).toBeInTheDocument();
    
    // 檢查警告文字
    expect(screen.getByText(/您的檔案上傳已進行/)).toBeInTheDocument();
    expect(screen.getByText(/即將達到 10 分鐘的超時限制/)).toBeInTheDocument();
    
    // 檢查進度條
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    
    // 計算進度百分比 (90秒相當於10分鐘的15%)
    expect(progressBar).toHaveStyle('width: 15%');
  });
  
  test('點擊取消上傳按鈕應該調用 onCancel 回調', () => {
    render(<UploadTimeoutWarning {...defaultProps} />);
    
    // 點擊取消上傳按鈕
    const cancelButton = screen.getByTestId('cancel-upload-btn');
    fireEvent.click(cancelButton);
    
    // 檢查 onCancel 是否被調用
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
  
  test('點擊繼續上傳按鈕應該調用 onContinue 回調', () => {
    render(<UploadTimeoutWarning {...defaultProps} />);
    
    // 點擊繼續上傳按鈕
    const continueButton = screen.getByTestId('continue-upload-btn');
    fireEvent.click(continueButton);
    
    // 檢查 onContinue 是否被調用
    expect(defaultProps.onContinue).toHaveBeenCalledTimes(1);
  });
  
  test('剩餘時間較短時應顯示更緊急的警告', () => {
    // 設置較短的剩餘時間 (30 秒)
    render(
      <UploadTimeoutWarning 
        {...defaultProps}
        remainingTime={30}
      />
    );
    
    // 檢查剩餘時間顯示
    expect(screen.getByText('剩餘時間: 00:30')).toBeInTheDocument();
    
    // 檢查進度條百分比 (30秒相當於10分鐘的5%)
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle('width: 5%');
  });
  
  test('剩餘時間為零時應顯示完全耗盡的進度條', () => {
    // 設置剩餘時間為0
    render(
      <UploadTimeoutWarning 
        {...defaultProps}
        remainingTime={0}
      />
    );
    
    // 檢查進度條百分比
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle('width: 0%');
  });

  test('超時時間不同時，應正確計算和顯示剩餘百分比', () => {
    // 設置不同的超時時間 (5 分鐘)
    render(
      <UploadTimeoutWarning 
        {...defaultProps}
        timeoutMinutes={5}
        remainingTime={60}
      />
    );
    
    // 檢查警告文字
    expect(screen.getByText(/即將達到 5 分鐘的超時限制/)).toBeInTheDocument();
    
    // 檢查進度條百分比 (60秒相當於5分鐘的20%)
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle('width: 20%');
  });
}); 