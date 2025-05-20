import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { ProgressDisplay } from '../ProgressDisplay';

describe('ProgressDisplay組件', () => {
  it('應該正確顯示待處理狀態', () => {
    render(
      <ProgressDisplay
        progress={0}
        status="pending"
        currentStep="等待處理"
      />
    );
    
    expect(screen.getByText('等待處理')).toBeInTheDocument();
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('0%');
    
    // 檢查進度條寬度
    const progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('width: 0%');
  });

  it('應該正確顯示處理中狀態', () => {
    const currentStep = '正在提取PDF文本';
    render(
      <ProgressDisplay
        progress={45}
        status="processing"
        currentStep={currentStep}
      />
    );
    
    expect(screen.getByText(currentStep)).toBeInTheDocument();
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('45%');
    
    // 檢查進度條寬度
    const progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('width: 45%');
  });

  it('應該正確顯示完成狀態', () => {
    render(
      <ProgressDisplay
        progress={100}
        status="completed"
        currentStep="處理完成"
      />
    );
    
    expect(screen.getByText('處理完成')).toBeInTheDocument();
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('100%');
    
    // 檢查進度條寬度
    const progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('width: 100%');
  });

  it('應該正確顯示失敗狀態和錯誤消息', () => {
    const errorMessage = '處理過程中發生錯誤';
    render(
      <ProgressDisplay
        progress={35}
        status="failed"
        currentStep="處理失敗"
        errorMessage={errorMessage}
      />
    );
    
    expect(screen.getByText('處理失敗')).toBeInTheDocument();
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('35%');
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    
    // 檢查進度條寬度
    const progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('width: 35%');
  });

  it('進度值應該正確向下四捨五入', () => {
    render(
      <ProgressDisplay
        progress={67.49}
        status="processing"
        currentStep="正在處理"
      />
    );
    
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('67%'); // 67.49 → 67
  });
  
  it('進度值應該正確向上四捨五入', () => {
    render(
      <ProgressDisplay
        progress={67.51}
        status="processing"
        currentStep="正在處理"
      />
    );
    
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('68%'); // 67.51 → 68
  });

  it('應該接受自定義CSS類別', () => {
    render(
      <ProgressDisplay
        progress={50}
        status="processing"
        currentStep="正在處理"
        className="custom-class"
      />
    );
    
    const progressContainer = screen.getByTestId('progress-display-container');
    expect(progressContainer).toHaveClass('custom-class');
  });

  it('應該根據狀態顯示不同顏色的進度條', () => {
    // 渲染三個不同狀態的進度條
    const { rerender } = render(
      <ProgressDisplay
        progress={50}
        status="processing"
        currentStep="正在處理"
      />
    );
    
    // 處理中狀態應該是藍色
    let progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('background-color: #2196F3');
    
    // 重新渲染完成狀態
    rerender(
      <ProgressDisplay
        progress={100}
        status="completed"
        currentStep="處理完成"
      />
    );
    
    // 完成狀態應該是綠色
    progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('background-color: #4CAF50');
    
    // 重新渲染失敗狀態
    rerender(
      <ProgressDisplay
        progress={30}
        status="failed"
        currentStep="處理失敗"
      />
    );
    
    // 失敗狀態應該是紅色
    progressBarFill = screen.getByTestId('progress-bar-fill');
    expect(progressBarFill).toHaveStyle('background-color: #F44336');
  });
}); 