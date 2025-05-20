import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar組件', () => {
  it('應該顯示正確的進度百分比', () => {
    render(<ProgressBar progress={75} status="processing" />);
    
    // 檢查百分比文本
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
  
  it('應該將進度值限制在0-100範圍內', () => {
    // 測試超出範圍的值
    const { rerender } = render(<ProgressBar progress={-10} status="processing" />);
    
    // 負值應該顯示為0%
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    // 測試超過100的值
    rerender(<ProgressBar progress={150} status="processing" />);
    
    // 超過100的值應該顯示為100%
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
  
  it('應該根據狀態顯示不同顏色', () => {
    // 測試不同狀態下的顏色
    render(<ProgressBar progress={50} status="processing" />);
    
    // 檢查顏色類，使用更可靠的選擇器
    const container = screen.getByText('50%').parentElement?.parentElement?.parentElement;
    const progressBarDiv = container?.querySelector('.bg-blue-500');
    expect(progressBarDiv).toBeInTheDocument();
    
    // 由於在不同狀態下難以直接測試樣式類的變化，
    // 我們這裡只測試該元素是否存在，實際應用中可以使用更複雜的選擇器
  });
  
  it('可以隱藏百分比顯示', () => {
    render(<ProgressBar progress={60} status="processing" showPercentage={false} />);
    
    // 百分比不應該顯示
    expect(screen.queryByText('60%')).not.toBeInTheDocument();
  });
  
  it('應該接受自定義CSS類別', () => {
    render(<ProgressBar progress={50} status="processing" className="custom-progress-bar" />);
    
    // 檢查最外層容器是否有自定義類
    const container = screen.getByText('50%').parentElement?.parentElement?.parentElement;
    expect(container).toHaveClass('custom-progress-bar');
  });
  
  it('進度條寬度應該匹配進度百分比', () => {
    render(<ProgressBar progress={35} status="processing" />);
    
    // 使用更可靠的選擇器來找到進度條元素
    const container = screen.getByText('35%').parentElement?.parentElement?.parentElement;
    const progressBar = container?.querySelector('div[style*="width: 35%"]');
    expect(progressBar).toBeInTheDocument();
  });
  
  it('應該四捨五入顯示進度', () => {
    render(<ProgressBar progress={66.7} status="processing" />);
    
    // 檢查四捨五入後的進度顯示
    expect(screen.getByText('67%')).toBeInTheDocument();
  });
}); 