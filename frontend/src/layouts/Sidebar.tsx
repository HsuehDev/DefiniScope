import React from 'react';
import { NavLink } from 'react-router-dom';
import classNames from 'classnames';

interface SidebarProps {
  isCollapsed: boolean;
}

/**
 * 側邊欄組件
 * 提供主要導航和應用功能入口
 */
export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed }) => {
  return (
    <aside 
      id="sidebar"
      className={classNames(
        "fixed left-0 top-0 z-20 h-full pt-16 flex flex-col flex-shrink-0 transition-width duration-300 bg-white border-r border-gray-200",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="relative flex-1 flex flex-col min-h-0 pt-0">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex-1 px-3 space-y-1">
            <NavLink 
              to="/app/files" 
              className={({ isActive }) => classNames(
                "flex items-center p-2 text-base font-normal rounded-lg",
                isActive ? "bg-blue-100 text-blue-800" : "text-gray-900 hover:bg-gray-100",
                isCollapsed && "justify-center" 
              )}
            >
              <svg 
                className={classNames(
                  "w-6 h-6 transition-all",
                  isCollapsed ? "mx-auto" : "mr-3"
                )} 
                fill="currentColor" 
                viewBox="0 0 20 20" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
              </svg>
              {!isCollapsed && <span>檔案管理</span>}
            </NavLink>
            
            <NavLink 
              to="/app/chat" 
              className={({ isActive }) => classNames(
                "flex items-center p-2 text-base font-normal rounded-lg",
                isActive ? "bg-blue-100 text-blue-800" : "text-gray-900 hover:bg-gray-100",
                isCollapsed && "justify-center"
              )}
            >
              <svg 
                className={classNames(
                  "w-6 h-6 transition-all",
                  isCollapsed ? "mx-auto" : "mr-3"
                )} 
                fill="currentColor" 
                viewBox="0 0 20 20" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"></path>
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"></path>
              </svg>
              {!isCollapsed && <span>智能對話</span>}
            </NavLink>
            
            <NavLink 
              to="/app/upload" 
              className={({ isActive }) => classNames(
                "flex items-center p-2 text-base font-normal rounded-lg",
                isActive ? "bg-blue-100 text-blue-800" : "text-gray-900 hover:bg-gray-100",
                isCollapsed && "justify-center"
              )}
            >
              <svg 
                className={classNames(
                  "w-6 h-6 transition-all",
                  isCollapsed ? "mx-auto" : "mr-3"
                )} 
                fill="currentColor" 
                viewBox="0 0 20 20" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"></path>
              </svg>
              {!isCollapsed && <span>上傳文件</span>}
            </NavLink>
          </div>
        </div>
        
        {/* 底部操作區 */}
        <div className="p-3 border-t border-gray-200">
          <NavLink
            to="/app/settings"
            className={({ isActive }) => classNames(
              "flex items-center p-2 text-base font-normal rounded-lg",
              isActive ? "bg-blue-100 text-blue-800" : "text-gray-900 hover:bg-gray-100",
              isCollapsed && "justify-center"
            )}
          >
            <svg 
              className={classNames(
                "w-6 h-6 transition-all",
                isCollapsed ? "mx-auto" : "mr-3"
              )} 
              fill="currentColor" 
              viewBox="0 0 20 20" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
            </svg>
            {!isCollapsed && <span>設定</span>}
          </NavLink>
        </div>
      </div>
    </aside>
  );
}; 