import React, { useState } from 'react';
import { FileItem as FileItemComponent } from './FileItem';
import { DeleteFileDialog } from './DeleteFileDialog';
import { useFilesList, useDeleteFile } from '../../hooks/useFiles';
import { FileItem } from '../../types/files';

interface FilesListProps {
  onPreviewFile: (file: FileItem) => void;
}

export const FilesList: React.FC<FilesListProps> = ({ onPreviewFile }) => {
  // 取得檔案列表資料
  const { 
    data, 
    isLoading, 
    isError, 
    refetch 
  } = useFilesList();
  
  // 刪除檔案的 mutation
  const deleteFileMutation = useDeleteFile();
  
  // 刪除對話框狀態
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // 打開刪除對話框
  const handleOpenDeleteDialog = (file: FileItem) => {
    setFileToDelete(file);
    setIsDeleteDialogOpen(true);
    setDeleteError(null);
  };
  
  // 關閉刪除對話框
  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setFileToDelete(null);
    setDeleteError(null);
  };
  
  // 確認刪除檔案
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    
    try {
      setDeleteError(null);
      await deleteFileMutation.mutateAsync(fileToDelete.file_uuid);
      
      // 顯示成功提示
      alert(`檔案 "${fileToDelete.original_name}" 已成功刪除`);
      
      // 關閉對話框
      handleCloseDeleteDialog();
    } catch (error) {
      // 顯示錯誤訊息
      const errorMessage = error instanceof Error ? error.message : '刪除檔案時發生未知錯誤';
      setDeleteError(errorMessage);
      alert(errorMessage);
    }
  };
  
  // 處理重新加載
  const handleRetry = () => {
    refetch();
  };
  
  // 加載中顯示
  if (isLoading) {
    return (
      <div className="py-8 flex flex-col items-center justify-center">
        <div className="mb-4">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-gray-600">正在載入檔案列表...</p>
      </div>
    );
  }
  
  // 錯誤顯示
  if (isError) {
    return (
      <div className="py-8 flex flex-col items-center justify-center">
        <div className="mb-4 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">載入檔案時發生錯誤</h3>
        <p className="text-gray-600 mb-4">無法載入您的檔案列表，請稍後再試。</p>
        <button
          onClick={handleRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          重新載入
        </button>
      </div>
    );
  }
  
  // 無檔案顯示
  if (!data || data.files.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="mb-4 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">尚無上傳檔案</h3>
        <p className="text-gray-600">上傳您的第一個 PDF 檔案開始使用</p>
      </div>
    );
  }
  
  // 檔案列表
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.files.map((file) => (
          <FileItemComponent
            key={file.file_uuid}
            file={file}
            onDelete={handleOpenDeleteDialog}
            onPreview={onPreviewFile}
          />
        ))}
      </div>
      
      {/* 刪除確認對話框 */}
      <DeleteFileDialog
        file={fileToDelete}
        isOpen={isDeleteDialogOpen}
        isDeleting={deleteFileMutation.isLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCloseDeleteDialog}
        error={deleteError}
      />
    </div>
  );
}; 