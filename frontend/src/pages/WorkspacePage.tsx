import React, { useState } from 'react';
import ThreeColumnLayout from '../layouts/ThreeColumnLayout';
import Navbar from '../layouts/Navbar';
import FileList from '../components/files/FileList';
import ChatMessage from '../components/chat/ChatMessage';
import DocumentDetails from '../components/ReferencePanel/DocumentDetails';

// 定義類型
interface FileItem {
  id: string;
  name: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'error';
  progress?: number;
  selected?: boolean;
}

interface ChatMessageItem {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  citations?: {
    id: string;
    text: string;
    source: string;
    page: string;
  }[];
}

// 模擬數據
const mockFiles: FileItem[] = [
  { id: '1', name: '研究文獻1.pdf', uploadDate: '2023-05-10', status: 'completed', selected: false },
  { id: '2', name: '論文資料2.pdf', uploadDate: '2023-05-11', status: 'processing', progress: 75, selected: false },
  { id: '3', name: '研究報告3.pdf', uploadDate: '2023-05-12', status: 'completed', selected: true },
];

const mockMessages: ChatMessageItem[] = [
  {
    id: '1',
    content: '您好，歡迎使用文獻智能助手。有任何關於選取文獻的問題，都可以向我諮詢。\n\n我可以協助您理解概念、歸納重點，或分析關鍵因素。',
    sender: 'assistant',
    timestamp: '10:30'
  },
  {
    id: '2',
    content: '請幫我摘要這篇文獻的研究方法和主要發現',
    sender: 'user',
    timestamp: '10:31'
  },
  {
    id: '3',
    content: '該文獻使用了混合研究方法，結合質性和量化分析，主要發現包括：\n\n1. 受試者在使用新系統後工作效率提高了35%\n2. 用戶滿意度顯著提升，平均評分從3.2提升至4.5（滿分5分）\n3. 系統使用門檻低，95%的新用戶能在首次使用時完成核心任務\n\n研究還發現系統在不同年齡層的用戶中均有良好表現，尤其在45歲以上人群中接受度高於預期。',
    sender: 'assistant',
    timestamp: '10:32',
    citations: [
      { id: '1', text: '受試者在完成所有測試任務後，效率提升了35%...', source: '研究報告3.pdf', page: '24' },
      { id: '2', text: '用戶滿意度從3.2分提升至4.5分...', source: '研究報告3.pdf', page: '26' },
      { id: '3', text: '95%的首次使用者能夠在不需説明的情況下完成任務...', source: '研究報告3.pdf', page: '28' },
    ]
  }
];

const documentDetails = {
  documentName: '研究報告3.pdf',
  uploadDate: '2023-05-10',
  pageCount: 42,
  tags: [
    { id: '1', name: '研究方法' },
    { id: '2', name: '用戶體驗' },
    { id: '3', name: '系統評估' },
  ]
};

const WorkspacePage: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>(mockFiles);
  const [messages] = useState<ChatMessageItem[]>(mockMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [websocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');

  const handleSelectFile = (id: string) => {
    setFiles(prevFiles => prevFiles.map(file => ({
      ...file,
      selected: file.id === id ? !file.selected : file.selected
    })));
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    // 在實際應用中，這裡會發送消息到後端
    console.log('發送消息:', inputMessage);
    setInputMessage('');
  };

  // 左側面板內容
  const leftPanelContent = (
    <FileList 
      files={files}
      onSelectFile={handleSelectFile}
    />
  );

  // 中間面板內容
  const middlePanelContent = (
    <div className="flex flex-col h-full p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">智能文獻對話</h1>
        <p className="text-sm text-gray-600 mt-1">已選取 1 份文獻進行對話</p>
      </div>

      <div className="flex items-center mb-6">
        <div className="h-px flex-grow bg-gray-300"></div>
        <div className="mx-4 w-2.5 h-2.5 bg-gray-500 transform rotate-45"></div>
        <div className="h-px flex-grow bg-gray-300"></div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin">
        {messages.map(message => (
          <ChatMessage
            key={message.id}
            id={message.id}
            content={message.content}
            sender={message.sender}
            timestamp={message.timestamp}
            citations={message.citations}
          />
        ))}
      </div>

      <div className="mt-auto pt-4">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-3 bg-white p-3 rounded-xl border border-gray-300 shadow-md">
          <textarea 
            className="flex-1 border-0 focus:ring-0 resize-none p-2 bg-transparent text-sm" 
            rows={2} 
            placeholder="請輸入您的問題..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
          ></textarea>
          <button 
            type="submit" 
            className="p-2 rounded-lg bg-tech-700 text-white hover:bg-tech-800 transition-colors"
            disabled={!inputMessage.trim()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );

  // 右側面板內容
  const rightPanelContent = (
    <DocumentDetails 
      documentName={documentDetails.documentName}
      uploadDate={documentDetails.uploadDate}
      pageCount={documentDetails.pageCount}
      tags={documentDetails.tags}
    />
  );

  // 導航欄內容
  const navbarContent = (
    <Navbar websocketStatus={websocketStatus} />
  );

  return (
    <ThreeColumnLayout
      leftContent={leftPanelContent}
      middleContent={middlePanelContent}
      rightContent={rightPanelContent}
      navbarContent={navbarContent}
    />
  );
};

export default WorkspacePage; 