import React from 'react';

interface FileItem {
  id: string;
  name: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'error';
  progress?: number;
  selected?: boolean;
}

interface FileListProps {
  files: FileItem[];
  onSelectFile: (id: string) => void;
  onDeleteFile?: (id: string) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onSelectFile, onDeleteFile }) => {
  const getStatusBadge = (status: FileItem['status']) => {
    switch (status) {
      case 'completed':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">完成</span>;
      case 'processing':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">處理中</span>;
      case 'error':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">失敗</span>;
      default:
        return null;
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-tech-800 mb-3">文獻資料庫</h3>
      <div className="space-y-3">
        {files.map((file) => (
          <div key={file.id} className="bg-white rounded-lg p-3 border border-tech-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  className="mr-2 rounded text-tech-700" 
                  checked={file.selected}
                  onChange={() => onSelectFile(file.id)}
                />
                <span className="text-sm font-medium text-tech-800 truncate">{file.name}</span>
              </div>
              {getStatusBadge(file.status)}
            </div>
            
            {file.status === 'processing' && file.progress !== undefined && (
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full" 
                  style={{ width: `${file.progress}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
        
        {files.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            尚未上傳文獻
          </div>
        )}
      </div>
    </div>
  );
};

export default FileList; 