import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// 導入服務和上下文
import { getAccessToken } from './services/auth/authService';
import WebSocketTest from './components/WebSocketTest';

function App() {
  // 測試認證令牌是否存在
  useEffect(() => {
    const token = getAccessToken();
    console.log('當前認證令牌:', token ? 'Token存在' : 'Token不存在');
  }, []);

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>AI文件分析與互動平台</h1>
          <p>歡迎使用我們的智能文件處理系統</p>
        </header>
        <main>
          <Routes>
            <Route path="/websocket-test" element={<WebSocketTest />} />
          </Routes>
          
          <section className="features">
            <h2>系統功能</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>文件上傳與分析</h3>
                <p>上傳並智能分析各種文件格式</p>
              </div>
              <div className="feature-card">
                <h3>內容摘要生成</h3>
                <p>自動生成文件內容摘要</p>
              </div>
              <div className="feature-card">
                <h3>智能問答系統</h3>
                <p>基於文件內容提問與回答</p>
              </div>
              <div className="feature-card">
                <h3>文檔協作</h3>
                <p>團隊共享與協作功能</p>
              </div>
            </div>
          </section>
          
          <div className="my-4 text-center">
            <a href="/websocket-test" className="bg-blue-500 text-white py-2 px-4 rounded">
              測試 WebSocket 連接
            </a>
          </div>
        </main>
        <footer>
          <p>&copy; 2025 AI文件分析與互動平台</p>
        </footer>
      </div>
    </Router>
  );
}

export default App; 