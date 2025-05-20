import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  websocketStatus?: 'connected' | 'disconnected' | 'connecting';
}

/**
 * 頂部導航欄組件
 * 提供應用名稱、頁面導航和用戶信息顯示
 */
const Navbar: React.FC<NavbarProps> = ({ websocketStatus = 'disconnected' }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getWebSocketStatusColor = () => {
    switch (websocketStatus) {
      case 'connected':
        return 'bg-green-400';
      case 'connecting':
        return 'bg-yellow-400';
      case 'disconnected':
      default:
        return 'bg-red-400';
    }
  };

  return (
    <div className="container mx-auto flex justify-between items-center">
      <div className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="text-xl font-bold">智慧文獻助手</span>
      </div>
      
      <div className="flex items-center space-x-6">
        <Link to="/app" className="px-4 py-2 rounded-xl text-sm font-medium bg-tech-800 text-white">工作區</Link>
        <Link to="/websocket-test" className="px-4 py-2 rounded-xl text-sm font-medium text-tech-100 hover:bg-tech-800 hover:text-white">連接測試</Link>
        <div className="flex items-center mr-4 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full ${getWebSocketStatusColor()} mr-2`}></span>
          <span>WebSocket</span>
        </div>
        {user && (
          <span className="text-sm">您好，{user.email}</span>
        )}
        <button 
          onClick={handleLogout}
          className="flex items-center px-4 py-2 rounded-xl bg-tech-900 hover:bg-tech-950 transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          登出
        </button>
      </div>
    </div>
  );
};

export default Navbar; 