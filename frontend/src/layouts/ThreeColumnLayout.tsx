import React, { ReactNode, useState } from 'react';
import classNames from 'classnames';

interface ThreeColumnLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  leftPanelTitle?: string;
  centerPanelTitle?: string;
  rightPanelTitle?: string;
}

/**
 * 三欄式佈局組件
 * 提供三個可調整的面板用於顯示檔案管理、聊天對話和參考資訊
 */
export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  leftPanelTitle = '檔案管理',
  centerPanelTitle = '智能對話',
  rightPanelTitle = '參考資訊',
}) => {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // 在小螢幕上的面板顯示狀態 (僅顯示一個面板)
  const [activeMobilePanel, setActiveMobilePanel] = useState<'left' | 'center' | 'right'>('center');

  // 切換左側面板
  const toggleLeftPanel = () => {
    setLeftPanelCollapsed(!leftPanelCollapsed);
  };

  // 切換右側面板
  const toggleRightPanel = () => {
    setRightPanelCollapsed(!rightPanelCollapsed);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 小螢幕上的面板選擇器 */}
      <div className="md:hidden flex border-b border-gray-200 mb-2">
        <button
          className={classNames(
            "flex-1 py-2 px-4 text-center",
            activeMobilePanel === 'left' ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600"
          )}
          onClick={() => setActiveMobilePanel('left')}
        >
          {leftPanelTitle}
        </button>
        <button
          className={classNames(
            "flex-1 py-2 px-4 text-center",
            activeMobilePanel === 'center' ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600"
          )}
          onClick={() => setActiveMobilePanel('center')}
        >
          {centerPanelTitle}
        </button>
        <button
          className={classNames(
            "flex-1 py-2 px-4 text-center",
            activeMobilePanel === 'right' ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600"
          )}
          onClick={() => setActiveMobilePanel('right')}
        >
          {rightPanelTitle}
        </button>
      </div>
      
      {/* 面板容器 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側面板 */}
        <div
          className={classNames(
            "flex flex-col transition-all duration-300 ease-in-out border-r border-gray-200 bg-gray-50",
            {
              "w-64 md:w-80": !leftPanelCollapsed,
              "w-0 md:w-12": leftPanelCollapsed,
            },
            {
              "hidden": activeMobilePanel !== 'left' && window.innerWidth < 768,
              "flex": activeMobilePanel === 'left' || window.innerWidth >= 768
            }
          )}
        >
          {/* 左側面板標題 */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className={classNames(
              "font-medium transition-opacity",
              leftPanelCollapsed ? "opacity-0 md:hidden" : "opacity-100"
            )}>
              {leftPanelTitle}
            </h2>
            <button 
              onClick={toggleLeftPanel}
              className="text-gray-500 hover:text-gray-700 focus:outline-none p-1"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {leftPanelCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>
          
          {/* 左側面板內容 */}
          <div className={classNames(
            "flex-1 overflow-y-auto",
            leftPanelCollapsed ? "hidden md:block md:invisible" : "visible"
          )}>
            {leftPanel}
          </div>
        </div>
        
        {/* 中間面板 */}
        <div 
          className={classNames(
            "flex-1 flex flex-col bg-white",
            {
              "hidden": activeMobilePanel !== 'center' && window.innerWidth < 768,
              "flex": activeMobilePanel === 'center' || window.innerWidth >= 768
            }
          )}
        >
          {/* 中間面板標題 */}
          <div className="hidden md:flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="font-medium">{centerPanelTitle}</h2>
          </div>
          
          {/* 中間面板內容 */}
          <div className="flex-1 overflow-y-auto">
            {centerPanel}
          </div>
        </div>
        
        {/* 右側面板 */}
        <div
          className={classNames(
            "flex flex-col transition-all duration-300 ease-in-out border-l border-gray-200 bg-gray-50",
            {
              "w-64 md:w-80": !rightPanelCollapsed,
              "w-0 md:w-12": rightPanelCollapsed,
            },
            {
              "hidden": activeMobilePanel !== 'right' && window.innerWidth < 768,
              "flex": activeMobilePanel === 'right' || window.innerWidth >= 768
            }
          )}
        >
          {/* 右側面板標題 */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <button 
              onClick={toggleRightPanel}
              className="text-gray-500 hover:text-gray-700 focus:outline-none p-1 order-first"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {rightPanelCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                )}
              </svg>
            </button>
            <h2 className={classNames(
              "font-medium transition-opacity",
              rightPanelCollapsed ? "opacity-0 md:hidden" : "opacity-100"
            )}>
              {rightPanelTitle}
            </h2>
          </div>
          
          {/* 右側面板內容 */}
          <div className={classNames(
            "flex-1 overflow-y-auto",
            rightPanelCollapsed ? "hidden md:block md:invisible" : "visible"
          )}>
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  );
}; 