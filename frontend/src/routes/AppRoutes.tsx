import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { PrivateRoute } from '../components/auth/PrivateRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ChatPage } from '../pages/ChatPage';
import { FilesManagementPage } from '../pages/FilesManagementPage';
import { UploadPage } from '../pages/UploadPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * 應用路由配置組件
 * 定義應用中的所有路由結構
 */
export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公開路由 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* 首頁重定向到應用首頁 */}
      <Route path="/" element={<Navigate to="/app/chat" />} />
      
      {/* 應用路由 - 受保護的路由 */}
      <Route path="/app" element={
        <PrivateRoute>
          <MainLayout />
        </PrivateRoute>
      }>
        {/* 應用子路由 */}
        <Route path="" element={<Navigate to="chat" />} />
        <Route path="files" element={<FilesManagementPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/:conversationId" element={<ChatPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      
      {/* 404 頁面 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}; 