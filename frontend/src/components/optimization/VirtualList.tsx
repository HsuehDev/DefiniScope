import React, { useRef, useState, useEffect, useCallback, useMemo, CSSProperties } from 'react';
import { useThrottle } from '../../hooks/useRenderOptimization';

interface ItemData {
  height: number;
  offset: number;
}

interface VirtualListProps<T> {
  /** 列表數據 */
  items: T[];
  /** 列表可視區域高度 */
  height: number;
  /** 列表項目渲染函數 */
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode;
  /** 緩衝區域項目數 */
  overscan?: number;
  /** 項目高度 */
  itemHeight: number | ((index: number, item: T) => number);
  /** 自定義類名 */
  className?: string;
  /** 自定義樣式 */
  style?: CSSProperties;
  /** 滾動到列表底部時的回調函數 */
  onReachEnd?: () => void;
  /** 距離底部多遠觸發onReachEnd，默認為200px */
  endReachedThreshold?: number;
  /** 是否顯示滾動條 */
  showScrollbar?: boolean;
  /** 滾動事件回調 */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  /** 初始滾動位置 */
  initialScrollIndex?: number;
}

/**
 * 計算列表項目的高度和偏移量
 */
function calculateItemMetadata<T>(
  itemCount: number,
  itemHeight: number | ((index: number, item: T) => number),
  items: T[]
): ItemData[] {
  const itemMetadata: ItemData[] = [];
  let offset = 0;

  for (let i = 0; i < itemCount; i++) {
    const height = typeof itemHeight === 'function' 
      ? itemHeight(i, items[i]) 
      : itemHeight;
    
    itemMetadata[i] = { height, offset };
    offset += height;
  }

  return itemMetadata;
}

/**
 * 虛擬列表組件
 * 
 * 只渲染可見區域的列表項目，適用於大量數據渲染
 */
function VirtualList<T>({
  items,
  height,
  renderItem,
  overscan = 3,
  itemHeight,
  className = '',
  style = {},
  onReachEnd,
  endReachedThreshold = 200,
  showScrollbar = true,
  onScroll,
  initialScrollIndex,
}: VirtualListProps<T>) {
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 滾動狀態
  const [scrollTop, setScrollTop] = useState(0);
  
  // 是否已經觸發了onReachEnd
  const hasReachedEndRef = useRef(false);
  
  // 計算所有項目的高度和偏移量
  const itemMetadata = useMemo(() => 
    calculateItemMetadata(items.length, itemHeight, items),
    [items, itemHeight]
  );
  
  // 計算列表總高度
  const totalHeight = useMemo(() => {
    return itemMetadata.length > 0 
      ? itemMetadata[itemMetadata.length - 1].offset + itemMetadata[itemMetadata.length - 1].height
      : 0;
  }, [itemMetadata]);
  
  // 計算可見範圍內的項目索引範圍
  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }
    
    // 找到第一個可見的項目索引
    let start = 0;
    while (
      start < items.length - 1 && 
      itemMetadata[start].offset + itemMetadata[start].height < scrollTop
    ) {
      start++;
    }
    
    // 找到最後一個可見的項目索引
    let end = start;
    while (
      end < items.length - 1 && 
      itemMetadata[end].offset < scrollTop + height
    ) {
      end++;
    }
    
    // 添加overscan緩衝區
    start = Math.max(0, start - overscan);
    end = Math.min(items.length - 1, end + overscan);
    
    return { startIndex: start, endIndex: end };
  }, [items.length, scrollTop, height, overscan, itemMetadata]);
  
  // 節流處理滾動事件
  const handleScroll = useThrottle((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    
    setScrollTop(newScrollTop);
    
    // 檢查是否滾動到底部
    if (
      onReachEnd && 
      !hasReachedEndRef.current && 
      totalHeight - newScrollTop - height <= endReachedThreshold
    ) {
      hasReachedEndRef.current = true;
      onReachEnd();
    } else if (totalHeight - newScrollTop - height > endReachedThreshold) {
      hasReachedEndRef.current = false;
    }
    
    if (onScroll) {
      onScroll(event);
    }
  }, 16); // 約60fps
  
  // 滾動到指定索引
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'auto') => {
    if (
      containerRef.current && 
      index >= 0 && 
      index < items.length && 
      itemMetadata[index]
    ) {
      containerRef.current.scrollTo({
        top: itemMetadata[index].offset,
        behavior
      });
    }
  }, [items.length, itemMetadata]);
  
  // 初始化滾動位置
  useEffect(() => {
    if (initialScrollIndex !== undefined) {
      scrollToIndex(initialScrollIndex);
    }
  }, [initialScrollIndex, scrollToIndex]);
  
  // 渲染可見項目
  const renderItems = useMemo(() => {
    const visibleItems = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      const { height, offset } = itemMetadata[i];
      
      const style: CSSProperties = {
        position: 'absolute',
        top: offset,
        left: 0,
        width: '100%',
        height,
      };
      
      visibleItems.push(
        <React.Fragment key={i}>
          {renderItem(item, i, style)}
        </React.Fragment>
      );
    }
    
    return visibleItems;
  }, [startIndex, endIndex, items, itemMetadata, renderItem]);
  
  // 容器樣式
  const containerStyle: CSSProperties = {
    position: 'relative',
    height,
    overflow: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain', // 防止滾動傳播
    WebkitOverflowScrolling: 'touch', // 提升移動端滾動體驗
    ...style,
  };
  
  if (!showScrollbar) {
    containerStyle.scrollbarWidth = 'none'; // Firefox
    containerStyle.msOverflowStyle = 'none'; // IE/Edge
    // WebKit瀏覽器通過偽類選擇器隱藏滾動條
  }
  
  // 內容樣式
  const contentStyle: CSSProperties = {
    height: totalHeight,
    position: 'relative',
  };
  
  // 渲染組件
  return (
    <div 
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={containerStyle}
      onScroll={handleScroll}
    >
      <div className="virtual-list-inner" style={contentStyle}>
        {renderItems}
      </div>
    </div>
  );
}

/**
 * 虛擬網格組件
 * 
 * 用於高效渲染網格狀的大量數據
 */
interface VirtualGridProps<T> extends Omit<VirtualListProps<T>, 'renderItem' | 'itemHeight'> {
  /** 渲染網格項目的函數 */
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode;
  /** 列寬 */
  columnWidth: number;
  /** 行高 */
  rowHeight: number;
  /** 列數 */
  columns: number;
  /** 網格的間隔 */
  gap?: number;
}

export function VirtualGrid<T>({
  items,
  height,
  columnWidth,
  rowHeight,
  columns,
  gap = 0,
  overscan = 3,
  className = '',
  style = {},
  onReachEnd,
  endReachedThreshold = 200,
  showScrollbar = true,
  onScroll,
  initialScrollIndex,
  renderItem,
}: VirtualGridProps<T>) {
  // 計算每行的項目數
  const itemsPerRow = columns;
  
  // 計算行數
  const rowCount = Math.ceil(items.length / itemsPerRow);
  
  // 創建虛擬行
  const rows = useMemo(() => {
    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const startIndex = rowIndex * itemsPerRow;
      const rowItems = items.slice(startIndex, startIndex + itemsPerRow);
      return { items: rowItems, rowIndex, startIndex };
    });
  }, [items, rowCount, itemsPerRow]);
  
  // 渲染網格行
  const renderRow = useCallback((row: { items: T[], rowIndex: number, startIndex: number }, index: number, style: CSSProperties) => {
    const rowStyle: CSSProperties = {
      ...style,
      display: 'flex',
      flexDirection: 'row',
    };
    
    if (gap > 0) {
      rowStyle.gap = gap;
    }
    
    return (
      <div style={rowStyle} className="virtual-grid-row">
        {row.items.map((item, columnIndex) => {
          const itemIndex = row.startIndex + columnIndex;
          const itemStyle: CSSProperties = {
            width: columnWidth,
            height: rowHeight,
            flexShrink: 0,
          };
          
          return (
            <div key={itemIndex} style={itemStyle} className="virtual-grid-cell">
              {renderItem(item, itemIndex, itemStyle)}
            </div>
          );
        })}
      </div>
    );
  }, [columnWidth, rowHeight, gap, renderItem]);
  
  // 使用虛擬列表渲染行
  return (
    <VirtualList
      items={rows}
      height={height}
      itemHeight={rowHeight + (gap || 0)}
      overscan={overscan}
      className={`virtual-grid ${className}`}
      style={style}
      onReachEnd={onReachEnd}
      endReachedThreshold={endReachedThreshold}
      showScrollbar={showScrollbar}
      onScroll={onScroll}
      initialScrollIndex={initialScrollIndex}
      renderItem={renderRow}
    />
  );
}

export default VirtualList; 