import { useState, useCallback } from 'react';
import { Reference } from '../types/reference';

/**
 * 引用管理Hook
 * 管理引用的狀態和操作，包括懸停預覽、上下文查看和PDF預覽
 */
export function useReferenceManager() {
  // 懸停預覽相關狀態
  const [hoveredReference, setHoveredReference] = useState<Reference | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  
  // 上下文查看相關狀態
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null);
  const [showContextViewer, setShowContextViewer] = useState(false);
  
  // PDF預覽相關狀態
  const [pdfReference, setPdfReference] = useState<Reference | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // 處理引用懸停
  const handleReferenceHover = useCallback((reference: Reference, event?: React.MouseEvent) => {
    setHoveredReference(reference);
    
    if (event) {
      // 計算懸停位置
      setPopoverPosition({
        x: event.clientX,
        y: event.clientY
      });
    }
    
    setShowPopover(true);
    
    // 設置定時器，2秒後隱藏懸停預覽
    const timer = setTimeout(() => {
      setShowPopover(false);
    }, 2000);
    
    // 清除之前的定時器
    return () => clearTimeout(timer);
  }, []);

  // 處理引用點擊
  const handleReferenceClick = useCallback((reference: Reference) => {
    setSelectedReference(reference);
    setShowContextViewer(true);
    // 點擊引用時隱藏懸停預覽
    setShowPopover(false);
  }, []);

  // 關閉上下文查看器
  const closeContextViewer = useCallback(() => {
    setShowContextViewer(false);
  }, []);

  // 處理查看PDF
  const handleViewPdf = useCallback((reference: Reference) => {
    setPdfReference(reference);
    setShowPdfPreview(true);
    // 關閉上下文查看器
    setShowContextViewer(false);
  }, []);

  // 關閉PDF預覽
  const closePdfPreview = useCallback(() => {
    setShowPdfPreview(false);
  }, []);

  return {
    // 懸停預覽相關
    hoveredReference,
    popoverPosition,
    showPopover,
    handleReferenceHover,
    
    // 上下文查看相關
    selectedReference,
    showContextViewer,
    handleReferenceClick,
    closeContextViewer,
    
    // PDF預覽相關
    pdfReference,
    showPdfPreview,
    handleViewPdf,
    closePdfPreview
  };
} 