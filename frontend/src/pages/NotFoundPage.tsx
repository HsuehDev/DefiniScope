import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 404 頁面 - 當用戶訪問不存在的路徑時顯示
 */
export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            404
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            抱歉，您訪問的頁面不存在。
          </p>
          <Link 
            to="/"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}; 