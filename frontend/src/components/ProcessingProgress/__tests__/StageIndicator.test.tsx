import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { StageIndicator } from '../StageIndicator';

describe('StageIndicator組件', () => {
  it('應該在待處理狀態下顯示待處理文本', () => {
    render(<StageIndicator currentStep="初始化" status="pending" />);
    
    // 無論currentStep是什麼，待處理狀態都應該顯示'等待處理'
    expect(screen.getByText('等待處理')).toBeInTheDocument();
  });
  
  it('應該在處理中狀態下顯示當前步驟', () => {
    const currentStep = '正在提取文本';
    render(<StageIndicator currentStep={currentStep} status="processing" />);
    
    // 處理中狀態應該顯示currentStep
    expect(screen.getByText(currentStep)).toBeInTheDocument();
  });
  
  it('應該在處理中狀態下顯示進度信息', () => {
    const currentStep = '正在分類句子';
    render(
      <StageIndicator 
        currentStep={currentStep} 
        status="processing" 
        current={10} 
        total={30}
      />
    );
    
    // 處理中狀態應該顯示進度信息
    expect(screen.getByText(`${currentStep} (10/30)`)).toBeInTheDocument();
  });
  
  it('應該在完成狀態下顯示處理完成文本', () => {
    render(<StageIndicator currentStep="最後一步" status="completed" />);
    
    // 無論currentStep是什麼，完成狀態都應該顯示'處理完成'
    expect(screen.getByText('處理完成')).toBeInTheDocument();
  });
  
  it('應該在失敗狀態下顯示處理失敗文本', () => {
    render(<StageIndicator currentStep="某一步驟" status="failed" />);
    
    // 無論currentStep是什麼，失敗狀態都應該顯示'處理失敗'
    expect(screen.getByText('處理失敗')).toBeInTheDocument();
  });
  
  it('應該根據狀態顯示不同的圖標', () => {
    const { rerender } = render(<StageIndicator currentStep="測試" status="pending" />);
    
    // 待處理狀態應該顯示時鐘圖標
    let icon = screen.getByText('等待處理').previousSibling?.firstChild as SVGElement;
    expect(icon).toHaveClass('text-gray-400');
    
    // 處理中狀態應該顯示旋轉圖標
    rerender(<StageIndicator currentStep="測試" status="processing" />);
    icon = screen.getByText('測試').previousSibling?.firstChild as SVGElement;
    expect(icon).toHaveClass('text-blue-500');
    expect(icon).toHaveClass('animate-spin');
    
    // 完成狀態應該顯示勾選圖標
    rerender(<StageIndicator currentStep="測試" status="completed" />);
    icon = screen.getByText('處理完成').previousSibling?.firstChild as SVGElement;
    expect(icon).toHaveClass('text-green-500');
    
    // 失敗狀態應該顯示錯誤圖標
    rerender(<StageIndicator currentStep="測試" status="failed" />);
    icon = screen.getByText('處理失敗').previousSibling?.firstChild as SVGElement;
    expect(icon).toHaveClass('text-red-500');
  });
  
  it('應該根據狀態顯示不同的文本顏色', () => {
    const { rerender } = render(<StageIndicator currentStep="測試" status="pending" />);
    
    // 待處理狀態應該使用灰色文本
    let textElement = screen.getByText('等待處理');
    expect(textElement).toHaveClass('text-gray-600');
    
    // 處理中狀態應該使用藍色文本
    rerender(<StageIndicator currentStep="測試" status="processing" />);
    textElement = screen.getByText('測試');
    expect(textElement).toHaveClass('text-blue-700');
    
    // 完成狀態應該使用綠色文本
    rerender(<StageIndicator currentStep="測試" status="completed" />);
    textElement = screen.getByText('處理完成');
    expect(textElement).toHaveClass('text-green-700');
    
    // 失敗狀態應該使用紅色文本
    rerender(<StageIndicator currentStep="測試" status="failed" />);
    textElement = screen.getByText('處理失敗');
    expect(textElement).toHaveClass('text-red-700');
  });
  
  it('應該接受自定義CSS類別', () => {
    render(
      <StageIndicator 
        currentStep="測試" 
        status="processing" 
        className="custom-stage-indicator"
      />
    );
    
    // 檢查容器是否有自定義類
    const container = screen.getByText('測試').parentElement;
    expect(container).toHaveClass('custom-stage-indicator');
  });
}); 