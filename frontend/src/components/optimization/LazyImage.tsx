import React, { useState, useRef, useEffect } from 'react';
import { createPerformanceTracker } from '../../utils/performance';

// 創建性能跟踪器
const imageLoadPerformance = createPerformanceTracker('image-load');

interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  placeholderSrc?: string;
  fallbackSrc?: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  threshold?: number;
  rootMargin?: string;
  blurEffect?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * 懶加載圖片組件
 * 
 * 只有當圖片進入視口時才加載，支持佔位圖、模糊過渡、加載失敗回退等功能
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  placeholderSrc = '',
  fallbackSrc = '',
  alt,
  width,
  height,
  threshold = 0.1,
  rootMargin = '0px',
  blurEffect = true,
  onLoad,
  onError,
  className = '',
  style = {},
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const [isBlur, setIsBlur] = useState(blurEffect);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    let unMounted = false;

    // 圖片加載處理
    const loadImage = () => {
      const imageElement = new Image();
      
      // 開始跟踪加載性能
      const imageName = src.split('/').pop() || src;
      imageLoadPerformance.start(imageName);
      
      imageElement.src = src;
      
      imageElement.onload = () => {
        if (unMounted) return;
        
        // 記錄加載時間
        const loadTime = imageLoadPerformance.end(imageName);
        
        setCurrentSrc(src);
        setIsLoaded(true);
        
        // 啟用模糊效果過渡
        if (blurEffect) {
          setTimeout(() => {
            setIsBlur(false);
          }, 30);
        }
        
        if (onLoad) onLoad();
      };
      
      imageElement.onerror = () => {
        if (unMounted) return;
        
        imageLoadPerformance.end(imageName);
        setHasError(true);
        
        // 如果提供了回退圖片，則使用
        if (fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        
        if (onError) onError();
      };
    };

    // 處理元素進入視口
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoaded && !hasError) {
          loadImage();
          if (observer) {
            observer.disconnect();
          }
        }
      });
    };

    // 創建和設置Intersection Observer
    if (imgRef.current && !isLoaded && !hasError) {
      observer = new IntersectionObserver(handleIntersection, {
        rootMargin,
        threshold,
      });
      
      observer.observe(imgRef.current);
    }

    return () => {
      unMounted = true;
      if (observer) {
        observer.disconnect();
      }
    };
  }, [src, isLoaded, hasError, blurEffect, fallbackSrc, rootMargin, threshold, onLoad, onError]);

  // 計算CSS類和樣式
  const imageClasses = [
    className,
    isBlur && blurEffect ? 'blur-transition' : '',
    isLoaded ? 'loaded' : 'loading',
    hasError ? 'error' : '',
  ].filter(Boolean).join(' ');

  const imageStyles: React.CSSProperties = {
    ...style,
    width: width,
    height: height,
    transition: blurEffect ? 'filter 0.3s ease' : undefined,
    filter: isBlur && blurEffect ? 'blur(8px)' : 'none',
  };

  // 渲染圖片
  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      className={imageClasses}
      style={imageStyles}
      loading="lazy"
      {...rest}
    />
  );
};

/**
 * 響應式圖片組件
 * 支持不同分辨率屏幕加載不同尺寸的圖片，優化網絡流量
 */
interface ResponsiveImageProps extends Omit<LazyImageProps, 'src'> {
  srcSet: {
    // 斷點大小映射到圖片URL
    [breakpoint: string]: string;
  };
  defaultSrc: string;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  srcSet,
  defaultSrc,
  ...rest
}) => {
  // 轉換srcSet為標準HTML srcset屬性格式
  const sources = Object.entries(srcSet)
    .map(([breakpoint, url]) => `${url} ${breakpoint}`)
    .join(', ');

  return (
    <LazyImage
      src={defaultSrc}
      {...rest}
      srcSet={sources}
    />
  );
};

/**
 * 背景圖片懶加載組件
 * 用於將圖片設置為背景的場景
 */
interface LazyBackgroundProps {
  src: string;
  placeholderSrc?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  threshold?: number;
  rootMargin?: string;
  blurEffect?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const LazyBackground: React.FC<LazyBackgroundProps> = ({
  src,
  placeholderSrc = '',
  children,
  className = '',
  style = {},
  threshold = 0.1,
  rootMargin = '0px',
  blurEffect = true,
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const [isBlur, setIsBlur] = useState(blurEffect);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    let unMounted = false;

    // 圖片加載處理
    const loadImage = () => {
      const imageElement = new Image();
      imageElement.src = src;
      
      imageElement.onload = () => {
        if (unMounted) return;
        
        setCurrentSrc(src);
        setIsLoaded(true);
        
        if (blurEffect) {
          setTimeout(() => {
            setIsBlur(false);
          }, 30);
        }
        
        if (onLoad) onLoad();
      };
      
      imageElement.onerror = () => {
        if (unMounted) return;
        
        setHasError(true);
        
        if (onError) onError();
      };
    };

    // 處理元素進入視口
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoaded && !hasError) {
          loadImage();
          if (observer) {
            observer.disconnect();
          }
        }
      });
    };

    // 創建和設置Intersection Observer
    if (containerRef.current && !isLoaded && !hasError) {
      observer = new IntersectionObserver(handleIntersection, {
        rootMargin,
        threshold,
      });
      
      observer.observe(containerRef.current);
    }

    return () => {
      unMounted = true;
      if (observer) {
        observer.disconnect();
      }
    };
  }, [src, isLoaded, hasError, blurEffect, rootMargin, threshold, onLoad, onError]);

  // 計算CSS類和樣式
  const containerClasses = [
    className,
    isBlur && blurEffect ? 'blur-transition' : '',
    isLoaded ? 'bg-loaded' : 'bg-loading',
    hasError ? 'bg-error' : '',
  ].filter(Boolean).join(' ');

  const containerStyles: React.CSSProperties = {
    ...style,
    backgroundImage: currentSrc ? `url(${currentSrc})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: blurEffect ? 'filter 0.3s ease' : undefined,
    filter: isBlur && blurEffect ? 'blur(8px)' : 'none',
  };

  // 渲染背景容器
  return (
    <div
      ref={containerRef}
      className={containerClasses}
      style={containerStyles}
    >
      {children}
    </div>
  );
};

export default LazyImage; 