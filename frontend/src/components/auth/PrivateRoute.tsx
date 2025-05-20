import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * 受保護的路由組件
 * 如果用戶未登入，重定向到登入頁面，並保存當前URL作為登入後的重定向地址
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ 
  children, 
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // 如果認證狀態還在加載中，顯示加載狀態
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" role="status" aria-label="載入中"></div>
      </div>
    );
  }

  // 如果用戶未認證，重定向到登入頁面
  if (!isAuthenticated) {
    // 保存當前位置，以便登入後返回
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 用戶已認證，渲染子組件
  return <>{children}</>;
}; 