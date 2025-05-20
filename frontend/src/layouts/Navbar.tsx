import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onToggleSidebar: () => void;
}

/**
 * 頂部導航欄組件
 * 提供應用名稱、頁面導航和用戶信息顯示
 */
export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleUserMenu = () => {
    setShowUserMenu(prev => !prev);
  };

  return (
    <nav className="bg-white border-b border-gray-200 fixed z-30 w-full">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* 側邊欄開關按鈕 */}
            <button
              onClick={onToggleSidebar}
              className="mr-2 text-gray-600 focus:outline-none"
              aria-expanded="true"
              aria-controls="sidebar"
            >
              <svg 
                className="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
            
            {/* 應用名稱 */}
            <Link to="/" className="text-xl font-bold flex items-center lg:ml-2.5">
              <span className="self-center whitespace-nowrap">文獻智能助手</span>
            </Link>
          </div>
          
          {/* 主導航鏈接 */}
          <div className="hidden md:flex items-center">
            <Link to="/app/files" className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">檔案管理</Link>
            <Link to="/app/chat" className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">智能對話</Link>
          </div>
          
          {/* 用戶資訊 */}
          <div className="flex items-center">
            <div className="hidden md:flex items-center ml-3">
              <div className="relative">
                <button
                  type="button"
                  className="flex text-sm bg-gray-800 rounded-full focus:ring-4 focus:ring-gray-300"
                  id="user-menu-button"
                  aria-expanded={showUserMenu}
                  onClick={toggleUserMenu}
                >
                  <span className="sr-only">打開用戶選單</span>
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                </button>
                
                {/* 用戶下拉選單 */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                  >
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                      <p className="font-medium">{user?.email}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      登出
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}; 