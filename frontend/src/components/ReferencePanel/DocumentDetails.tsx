import React from 'react';

interface Tag {
  id: string;
  name: string;
}

interface DocumentDetailsProps {
  documentName: string;
  uploadDate: string;
  pageCount: number;
  tags?: Tag[];
}

const DocumentDetails: React.FC<DocumentDetailsProps> = ({
  documentName,
  uploadDate,
  pageCount,
  tags = []
}) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-tech-800 mb-3">文獻詳情</h3>
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-tech-700">已選文獻</h4>
          <p className="text-sm text-gray-700 mt-1">{documentName}</p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-tech-700">上傳時間</h4>
          <p className="text-sm text-gray-700 mt-1">{uploadDate}</p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-tech-700">頁數</h4>
          <p className="text-sm text-gray-700 mt-1">{pageCount} 頁</p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-tech-700">主題標籤</h4>
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map(tag => (
              <span 
                key={tag.id} 
                className="px-2 py-1 text-xs bg-tech-100 text-tech-700 rounded-lg"
              >
                {tag.name}
              </span>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-gray-500">尚未添加標籤</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetails; 