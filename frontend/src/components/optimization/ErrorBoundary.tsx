import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logPerformanceMetric } from '../../utils/performance';

interface ErrorBoundaryProps {
  /** 子組件 */
  children: ReactNode;
  /** 發生錯誤時顯示的回退UI */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  /** 錯誤發生時的回調函數 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 用於識別錯誤邊界的名稱 */
  name?: string;
}

interface ErrorBoundaryState {
  /** 是否發生錯誤 */
  hasError: boolean;
  /** 錯誤對象 */
  error: Error | null;
}

/**
 * 錯誤邊界組件
 * 
 * 捕獲子組件樹中的JavaScript錯誤，並顯示回退UI，防止整個應用崩潰
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  /**
   * 捕獲錯誤並更新狀態
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  /**
   * 錯誤處理和記錄
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 將錯誤記錄到性能指標
    logPerformanceMetric({
      category: 'error',
      label: `error-boundary-${this.props.name || 'unknown'}`,
      duration: 0,
      timestamp: Date.now()
    });

    // 調用onError回調
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 記錄錯誤到控制台
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  /**
   * 重置錯誤狀態
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    // 如果發生錯誤，顯示回退UI
    if (hasError && error) {
      // 如果fallback是函數，則調用它並傳入錯誤和重置函數
      if (typeof fallback === 'function') {
        return fallback(error, this.resetError);
      }
      
      // 如果提供了fallback UI，則顯示它
      if (fallback) {
        return fallback;
      }
      
      // 默認的回退UI
      return (
        <div 
          style={{ 
            padding: '16px', 
            margin: '16px', 
            border: '1px solid #f5222d',
            borderRadius: '4px',
            backgroundColor: '#fff1f0' 
          }}
        >
          <h2 style={{ color: '#f5222d', margin: '0 0 8px' }}>
            發生錯誤
          </h2>
          <p style={{ margin: '0 0 8px' }}>
            {error.message}
          </p>
          <button
            onClick={this.resetError}
            style={{
              backgroundColor: '#f5222d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            重試
          </button>
        </div>
      );
    }

    // 正常渲染子組件
    return children;
  }
}

/**
 * 用於包裝頁面或組件的高階組件
 * 
 * @param Component 要包裝的組件
 * @param fallback 可選的回退UI
 * @param onError 可選的錯誤處理函數
 * @param name 可選的錯誤邊界名稱
 */
export function withErrorBoundary<P>(
  Component: React.ComponentType<P>,
  options: {
    fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    name?: string;
  } = {}
): React.FC<P> {
  const { fallback, onError, name } = options;
  
  const WithErrorBoundary: React.FC<P> = (props) => {
    return (
      <ErrorBoundary 
        fallback={fallback}
        onError={onError}
        name={name || Component.displayName || Component.name}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  
  // 設置displayName以便於調試
  WithErrorBoundary.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  
  return WithErrorBoundary;
}

/**
 * 用於特定元素或區域的錯誤捕獲Hook
 */
export function useCaptureError() {
  const [error, setError] = React.useState<Error | null>(null);
  
  const captureError = React.useCallback((fn: () => void) => {
    try {
      fn();
    } catch (err) {
      setError(err as Error);
      
      // 記錄錯誤
      console.error('Captured error:', err);
      
      // 記錄到性能指標
      logPerformanceMetric({
        category: 'error',
        label: 'use-capture-error',
        duration: 0,
        timestamp: Date.now()
      });
    }
  }, []);
  
  const resetError = React.useCallback(() => {
    setError(null);
  }, []);
  
  return { error, captureError, resetError };
}

export default ErrorBoundary; 