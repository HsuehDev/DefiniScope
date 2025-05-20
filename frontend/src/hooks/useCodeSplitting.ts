import { lazy, ComponentType, useState, useEffect } from 'react';
import { preloadResources } from '../utils/performance';

/**
 * 用於優化路由級組件加載的高階函數
 * 
 * @param importFn 動態導入函數
 * @param fallback 載入時顯示的回調函數
 * @param prefetchRelated 預取相關資源的函數
 * @returns 懶加載的組件
 */
export function createLazyRoute<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  preloadRelatedResources?: () => string[]
): {
  Component: React.LazyExoticComponent<T>;
  preload: () => void;
} {
  // 創建懶加載組件
  const Component = lazy(importFn);

  // 預加載函數
  const preload = () => {
    // 觸發組件預加載
    importFn();

    // 預加載相關資源
    if (preloadRelatedResources) {
      const resources = preloadRelatedResources();
      if (resources && resources.length > 0) {
        preloadResources(resources, 'prefetch');
      }
    }
  };

  return { Component, preload };
}

/**
 * 組件級懶加載Hook
 * 
 * @param importFn 動態導入函數
 * @returns [加載的組件, 加載狀態, 錯誤狀態]
 */
export function useLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): [React.LazyExoticComponent<T> | null, boolean, Error | null] {
  const [Component, setComponent] = useState<React.LazyExoticComponent<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    lazy(importFn);

    importFn()
      .then(module => {
        if (isMounted) {
          setComponent(lazy(() => Promise.resolve(module)));
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('組件載入失敗:', err);
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [importFn]);

  return [Component, isLoading, error];
}

/**
 * 預載入組件Hook，在合適的時機預加載組件
 * 
 * @param importFn 動態導入函數
 * @param triggerEvents 觸發預加載的事件類型列表
 * @param triggerElements 觸發預加載的元素選擇器列表
 */
export function usePreloadComponent(
  importFn: () => Promise<any>,
  triggerEvents: Array<'hover' | 'visible' | 'idle' | 'media'> = ['idle'],
  triggerElements: string[] = []
): void {
  useEffect(() => {
    let observers: IntersectionObserver[] = [];
    let eventListeners: { element: Element; event: string; handler: () => void }[] = [];

    // 鼠標懸停預加載
    if (triggerEvents.includes('hover') && triggerElements.length > 0) {
      triggerElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
          const handler = () => {
            importFn();
            element.removeEventListener('mouseenter', handler);
          };
          
          element.addEventListener('mouseenter', handler, { once: true });
          
          eventListeners.push({
            element,
            event: 'mouseenter',
            handler
          });
        });
      });
    }

    // 元素可見時預加載
    if (triggerEvents.includes('visible') && triggerElements.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            importFn();
            observer.disconnect();
          }
        });
      }, { threshold: 0.1 });

      triggerElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => observer.observe(element));
      });

      observers.push(observer);
    }

    // 瀏覽器閒置時預加載
    if (triggerEvents.includes('idle')) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          importFn();
        }, { timeout: 2000 });
      } else {
        // 降級處理
        setTimeout(() => {
          importFn();
        }, 2000);
      }
    }

    // 媒體查詢條件滿足時預加載
    if (triggerEvents.includes('media') && triggerElements.length > 0) {
      // 假設 triggerElements 包含媒體查詢字符串，例如 "min-width: 1024px"
      triggerElements.forEach(mediaQuery => {
        const mql = window.matchMedia(mediaQuery);
        
        const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
          if (e.matches) {
            importFn();
            mql.removeEventListener('change', handleChange as any);
          }
        };
        
        mql.addEventListener('change', handleChange as any);
        handleChange(mql);
        
        eventListeners.push({
          element: mql as unknown as Element,
          event: 'change',
          handler: handleChange as any
        });
      });
    }

    return () => {
      // 清理觀察者
      observers.forEach(observer => observer.disconnect());
      
      // 清理事件監聽器
      eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    };
  }, [importFn, ...triggerEvents, ...triggerElements]);
}

interface PreloadTask {
  (): void;
  timeout?: number;
}

/**
 * 智能組件預加載Hook，結合多種預加載策略
 * 
 * @param componentImports 組件導入函數映射
 */
export function useSmartPreload(
  componentImports: Record<string, () => Promise<any>>
): void {
  useEffect(() => {
    // 預加載優先級
    const priorities: {
      key: string;
      condition: () => boolean;
      delay: number;
    }[] = [
      // 高優先級 - 當前路由可能立即需要的組件
      {
        key: 'immediate',
        condition: () => true,
        delay: 0
      },
      // 中優先級 - 用戶可能很快需要的組件
      {
        key: 'soon',
        condition: () => true,
        delay: 1000
      },
      // 低優先級 - 用戶可能最終需要的組件
      {
        key: 'eventual',
        condition: () => 'requestIdleCallback' in window,
        delay: 3000
      }
    ];

    const preloadTasks: PreloadTask[] = [];

    // 根據優先級安排預加載任務
    priorities.forEach(({ key, condition, delay }) => {
      const importFn = componentImports[key];
      if (importFn && condition()) {
        const task = () => {
          importFn();
        };
        
        if (delay > 0) {
          const timeoutId = setTimeout(task, delay);
          task.timeout = timeoutId;
          preloadTasks.push(task);
        } else {
          task();
        }
      }
    });

    return () => {
      // 清理未執行的預加載任務
      preloadTasks.forEach(task => {
        if (task.timeout) {
          clearTimeout(task.timeout);
        }
      });
    };
  }, [componentImports]);
}

export default {
  createLazyRoute,
  useLazyComponent,
  usePreloadComponent,
  useSmartPreload
}; 