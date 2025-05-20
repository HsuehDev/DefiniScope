import React from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * 設定頁面
 */
export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            系統設定
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            管理您的帳號設定和偏好
          </p>
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            帳號資訊
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            您的個人帳號詳情
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                電子郵件
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {user?.email}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                帳號 ID
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {user?.user_uuid}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      {/* 系統偏好設定區域 - 未來可擴充 */}
      <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            系統偏好
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            自訂您的使用體驗
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <p className="text-sm text-gray-500">目前沒有可設定的偏好選項</p>
        </div>
      </div>
    </div>
  );
}; 