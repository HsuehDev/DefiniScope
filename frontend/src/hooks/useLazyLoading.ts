import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * 圖片懶加載Hook，在圖片進入視口時才載入
 * 
 * @param src 圖片原始地址
 * @param options 配置選項
 * @returns 圖片狀態對象和ref
 */
export function useLazyImage(
  src: string,
  options: {
    rootMargin?: string;
    threshold?: number;
    placeholderSrc?: string;
    onLoad?: () => void;
    onError?: (error: Error) => void;
  } = {}
): {
  loaded: boolean;
  error: boolean;
  currentSrc: string;
  ref: React.RefObject<HTMLImageElement>;
  blur: boolean;
} {
  const {
    rootMargin = '0px',
    threshold = 0.1,
    placeholderSrc = '',
    onLoad,
    onError
  } = options;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [blur, setBlur] = useState(true);
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    let isUnmounted = false;

    const loadImage = () => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (!isUnmounted) {
          setLoaded(true);
          setCurrentSrc(src);
          // 設置短暫的模糊過渡效果
          setTimeout(() => setBlur(false), 50);
          onLoad?.();
        }
      };
      img.onerror = () => {
        if (!isUnmounted) {
          setError(true);
          onError?.(new Error(`Failed to load image: ${src}`));
        }
      };
    };

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !loaded && !error) {
          loadImage();
          observer.disconnect();
        }
      });
    };

    if (imgRef.current) {
      observer = new IntersectionObserver(handleIntersection, {
        rootMargin,
        threshold
      });
      observer.observe(imgRef.current);
    }

    return () => {
      isUnmounted = true;
      if (observer) {
        observer.disconnect();
      }
    };
  }, [src, loaded, error, rootMargin, threshold, onLoad, onError]);

  return { loaded, error, currentSrc, ref: imgRef, blur };
}

/**
 * 使用媒體查詢有條件地載入資源
 * 
 * @param resources 資源對象，根據媒體查詢條件映射到資源URL
 * @param defaultResource 默認資源URL
 * @returns 當前適用的資源URL
 */
export function useResponsiveResource(
  resources: Record<string, string>,
  defaultResource: string
): string {
  const [activeResource, setActiveResource] = useState(defaultResource);

  useEffect(() => {
    // 追踪所有媒體查詢
    const mediaQueries: { mql: MediaQueryList; query: string; resource: string }[] = [];

    // 創建媒體查詢監聽器
    Object.entries(resources).forEach(([query, resource]) => {
      const mql = window.matchMedia(query);
      
      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        if (e.matches) {
          setActiveResource(resource);
        }
      };
      
      mql.addEventListener('change', handleChange as any);
      handleChange(mql);
      
      mediaQueries.push({ mql, query, resource });
    });

    // 初始化時檢查哪個媒體查詢匹配
    let matchFound = false;
    for (const { mql, resource } of mediaQueries) {
      if (mql.matches) {
        setActiveResource(resource);
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      setActiveResource(defaultResource);
    }

    // 清理
    return () => {
      mediaQueries.forEach(({ mql }) => {
        mql.removeEventListener('change', null as any);
      });
    };
  }, [resources, defaultResource]);

  return activeResource;
}

/**
 * 用於元素懶加載的Hook
 * 
 * @param options 配置選項
 * @returns 引用和可見性狀態
 */
export function useLazyElement(
  options: {
    rootMargin?: string;
    threshold?: number;
    triggerOnce?: boolean;
    onVisible?: () => void;
  } = {}
): {
  ref: React.RefObject<HTMLElement>;
  isVisible: boolean;
} {
  const {
    rootMargin = '0px',
    threshold = 0.1,
    triggerOnce = true,
    onVisible
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const current = elementRef.current;
    let observer: IntersectionObserver;

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      entries.forEach(entry => {
        const visible = entry.isIntersecting;
        setIsVisible(visible);
        
        if (visible) {
          onVisible?.();
          
          // 如果只需觸發一次，則停止觀察
          if (triggerOnce) {
            observer.disconnect();
          }
        }
      });
    };

    if (current) {
      observer = new IntersectionObserver(handleIntersection, {
        rootMargin,
        threshold
      });
      observer.observe(current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [rootMargin, threshold, triggerOnce, onVisible]);

  return { ref: elementRef, isVisible };
}

/**
 * 虛擬列表Hook，只渲染在視口中或附近的項目
 * 
 * @param options 配置選項
 * @returns 虛擬列表狀態和控制方法
 */
export function useVirtualList<T>(
  options: {
    items: T[];
    itemHeight: number | ((index: number) => number);
    overscan?: number;
    estimatedItemHeight?: number;
    scrollingDelay?: number;
  }
): {
  visibleItems: { item: T; index: number; }[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  containerRef: React.RefObject<HTMLElement>;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  isScrolling: boolean;
} {
  const {
    items,
    itemHeight,
    overscan = 3,
    estimatedItemHeight = 50,
    scrollingDelay = 150
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef<number>();

  // 計算項目高度
  const getItemHeight = useCallback(
    (index: number) => {
      return typeof itemHeight === 'function' 
        ? itemHeight(index) 
        : itemHeight;
    },
    [itemHeight]
  );

  // 計算項目位置信息
  const getItemMetadata = useCallback(
    (index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += getItemHeight(i);
      }
      return {
        offset,
        height: getItemHeight(index)
      };
    },
    [getItemHeight]
  );

  // 計算可見範圍
  const getVisibleRange = useCallback(
    () => {
      if (!containerRef.current) {
        return { startIndex: 0, endIndex: overscan };
      }

      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + clientHeight;

      let startIndex = -1;
      let endIndex = -1;

      // 查找開始索引
      let offset = 0;
      for (let i = 0; i < items.length; i++) {
        const height = getItemHeight(i);
        const itemBottom = offset + height;
        
        if (itemBottom > viewportTop && startIndex === -1) {
          startIndex = i;
        }
        
        if (offset > viewportBottom && endIndex === -1) {
          endIndex = i - 1;
          break;
        }
        
        offset += height;
      }

      // 如果沒有找到結束索引，則使用最後一個項目
      if (endIndex === -1) {
        endIndex = items.length - 1;
      }

      // 添加 overscan 緩衝區
      startIndex = Math.max(0, startIndex - overscan);
      endIndex = Math.min(items.length - 1, endIndex + overscan);

      return { startIndex, endIndex };
    },
    [scrollTop, clientHeight, overscan, items.length, getItemHeight]
  );

  // 計算列表總高度
  const getTotalHeight = useCallback(
    () => {
      return items.reduce((total, _, index) => total + getItemHeight(index), 0);
    },
    [items, getItemHeight]
  );

  // 可見項目範圍
  const { startIndex, endIndex } = getVisibleRange();

  // 可見項目列表
  const visibleItems = items
    .slice(startIndex, endIndex + 1)
    .map((item, relIndex) => ({
      item,
      index: startIndex + relIndex
    }));

  // 總高度
  const totalHeight = getTotalHeight();

  // 處理滾動事件
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
        setClientHeight(containerRef.current.clientHeight);
        setIsScrolling(true);

        // 清除先前的超時
        if (scrollingTimeoutRef.current) {
          clearTimeout(scrollingTimeoutRef.current);
        }

        // 設置新的超時
        scrollingTimeoutRef.current = window.setTimeout(() => {
          setIsScrolling(false);
        }, scrollingDelay);
      }
    };

    const current = containerRef.current;
    if (current) {
      current.addEventListener('scroll', handleScroll);
      handleScroll(); // 初始化
    }

    return () => {
      if (current) {
        current.removeEventListener('scroll', handleScroll);
      }
      
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, [scrollingDelay]);

  // 滾動到指定索引
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'auto') => {
      if (containerRef.current && index >= 0 && index < items.length) {
        const { offset } = getItemMetadata(index);
        containerRef.current.scrollTo({
          top: offset,
          behavior
        });
      }
    },
    [items.length, getItemMetadata]
  );

  return {
    visibleItems,
    totalHeight,
    startIndex,
    endIndex,
    containerRef,
    scrollToIndex,
    isScrolling
  };
}

export default {
  useLazyImage,
  useResponsiveResource,
  useLazyElement,
  useVirtualList
}; 