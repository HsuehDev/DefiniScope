import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// 導入頁面和組件
import { getAccessToken } from './services/auth/authService';
import WebSocketTest from './components/WebSocketTest';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import { PrivateRoute } from './components/auth/PrivateRoute';

function App() {
  // 測試認證令牌是否存在
  useEffect(() => {
    const token = getAccessToken();
    console.log('當前認證令牌:', token ? 'Token存在' : 'Token不存在');
  }, []);

  return (
    <Router>
      <Routes>
        {/* 公開路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/websocket-test" element={<WebSocketTest />} />
        
        {/* 受保護路由 */}
        <Route 
          path="/app" 
          element={
            <PrivateRoute>
              <WorkspacePage />
            </PrivateRoute>
          } 
        />
        
        {/* 默認路由重定向 */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Router>
  );
}

export default App; 