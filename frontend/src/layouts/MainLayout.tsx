import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import classNames from 'classnames';

/**
 * 應用主要布局組件
 * 提供頂部導航欄、側邊欄和主內容區域結構
 */
export const MainLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 頂部導航欄 */}
      <Navbar onToggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 pt-16">
        {/* 側邊欄 */}
        <Sidebar isCollapsed={isSidebarCollapsed} />
        
        {/* 主內容區域 */}
        <div className={classNames(
          "flex-1 transition-all duration-300 ease-in-out p-4",
          isSidebarCollapsed ? "ml-16" : "ml-64"
        )}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}; 