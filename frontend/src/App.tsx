import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileUploadZone } from './components/upload/FileUploadZone';

// 創建QueryClient實例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 2,
    },
  },
});

/**
 * 應用程式主組件
 */
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <h1 className="text-lg font-semibold text-gray-900">
              文件分析平台
            </h1>
          </div>
        </header>
        
        <main className="flex-1">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <div className="bg-white overflow-hidden shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">上傳檔案</h2>
                <FileUploadZone />
              </div>
            </div>
          </div>
        </main>
        
        <footer className="bg-white">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} 文件分析平台 - 所有權利保留
            </p>
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  );
};

export default App; 