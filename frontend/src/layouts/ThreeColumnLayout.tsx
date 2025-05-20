import React, { ReactNode } from 'react';

interface ThreeColumnLayoutProps {
  leftContent: ReactNode;
  middleContent: ReactNode;
  rightContent: ReactNode;
  navbarContent: ReactNode;
}

const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  leftContent,
  middleContent,
  rightContent,
  navbarContent
}) => {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 導航欄 */}
      <div className="bg-gradient-to-r from-tech-800 to-tech-700 text-tech-100 p-4 shadow-md">
        {navbarContent}
      </div>
      
      {/* 主要內容區 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左側面板：文件列表 */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
          {leftContent}
        </div>
        
        {/* 中間面板：聊天區域 */}
        <div className="flex-1 flex flex-col bg-gray-50 shadow-inner">
          {middleContent}
        </div>
        
        {/* 右側面板：詳細資訊 */}
        <div className="w-64 border-l border-gray-200 bg-white p-4 overflow-y-auto">
          {rightContent}
        </div>
      </div>
    </div>
  );
};

export default ThreeColumnLayout; 