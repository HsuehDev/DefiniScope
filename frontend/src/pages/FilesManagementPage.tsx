import React, { useState } from 'react';
import { FilesList } from '../components/files/FilesList';
import { FileItem } from '../types/files';

export const FilesManagementPage: React.FC = () => {
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // 處理檔案預覽
  const handlePreviewFile = (file: FileItem) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  // 關閉預覽
  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
  };

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            我的檔案
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            管理您已上傳的 PDF 檔案
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            上傳新檔案
          </button>
        </div>
      </div>

      {/* 檔案列表 */}
      <FilesList onPreviewFile={handlePreviewFile} />

      {/* 檔案預覽對話框 */}
      {isPreviewOpen && previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900 truncate max-w-md">
                {previewFile.original_name}
              </h3>
              <button
                onClick={handleClosePreview}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-1 bg-gray-100">
              <iframe
                src={`/api/files/${previewFile.file_uuid}/preview`}
                className="w-full h-full border-0"
                title={`預覽 ${previewFile.original_name}`}
              />
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span>總頁數：{previewFile.sentence_count > 0 ? Math.ceil(previewFile.sentence_count / 20) : '載入中...'}</span>
              </div>
              <button
                onClick={handleClosePreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 