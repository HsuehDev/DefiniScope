import React, { useState } from 'react';
import { ProcessingProgress } from '../ProcessingProgress';
import { FileProcessingProgress, QueryProcessingProgress, SentenceData, ReferencedSentence } from '../../../types/progress';

// 文件處理進度示例數據
const fileProgressExample: FileProcessingProgress = {
  file_uuid: '550e8400-e29b-41d4-a716-446655440000',
  progress: 65,
  status: 'processing',
  currentStep: '正在進行句子分類',
  current: 65,
  total: 100,
  extractedSentences: [
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440001',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      sentence: '自適應專業知識是指基於個體經驗和背景，在特定環境下能夠靈活應用和調整的知識體系。',
      page: 3,
      defining_type: 'cd',
      reason: '此句提供了「自適應專業知識」的明確定義，說明了其本質和特徵。'
    },
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440002',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      sentence: '專業知識的類型可分為隱性知識和顯性知識兩大類。',
      page: 5,
      defining_type: 'none',
      reason: '此句只是描述了專業知識的分類，並未給出定義。'
    },
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440003',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      sentence: '測量自適應專業知識的方式包括問卷調查、情景測試、模擬實驗和實際工作表現評估四種方法。',
      page: 12,
      defining_type: 'od',
      reason: '此句提供了測量「自適應專業知識」的具體方法，屬於操作型定義。'
    }
  ],
  classifiedSentences: [
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440001',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      sentence: '自適應專業知識是指基於個體經驗和背景，在特定環境下能夠靈活應用和調整的知識體系。',
      page: 3,
      defining_type: 'cd',
      reason: '此句提供了「自適應專業知識」的明確定義，說明了其本質和特徵。'
    },
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440003',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      sentence: '測量自適應專業知識的方式包括問卷調查、情景測試、模擬實驗和實際工作表現評估四種方法。',
      page: 12,
      defining_type: 'od',
      reason: '此句提供了測量「自適應專業知識」的具體方法，屬於操作型定義。'
    }
  ]
};

// 查詢處理進度示例數據
const queryProgressExample: QueryProcessingProgress = {
  query_uuid: '660e8400-e29b-41d4-a716-446655440000',
  progress: 75,
  status: 'processing',
  currentStep: '正在生成答案',
  keywords: ['自適應專業知識', '專業知識', '知識測量'],
  foundDefinitions: { cd: 3, od: 2 },
  searchResults: {
    '自適應專業知識': [
      {
        sentence_uuid: '550e8400-e29b-41d4-a716-446655440001',
        file_uuid: '550e8400-e29b-41d4-a716-446655440000',
        original_name: 'example.pdf',
        sentence: '自適應專業知識是指基於個體經驗和背景，在特定環境下能夠靈活應用和調整的知識體系。',
        page: 3,
        defining_type: 'cd',
        relevance_score: 0.92
      }
    ],
    '知識測量': [
      {
        sentence_uuid: '550e8400-e29b-41d4-a716-446655440003',
        file_uuid: '550e8400-e29b-41d4-a716-446655440000',
        original_name: 'example.pdf',
        sentence: '測量自適應專業知識的方式包括問卷調查、情景測試、模擬實驗和實際工作表現評估四種方法。',
        page: 12,
        defining_type: 'od',
        relevance_score: 0.85
      }
    ]
  },
  referencedSentences: [
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440001',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      original_name: 'example.pdf',
      sentence: '自適應專業知識是指基於個體經驗和背景，在特定環境下能夠靈活應用和調整的知識體系。',
      page: 3,
      defining_type: 'cd'
    },
    {
      sentence_uuid: '550e8400-e29b-41d4-a716-446655440003',
      file_uuid: '550e8400-e29b-41d4-a716-446655440000',
      original_name: 'example.pdf',
      sentence: '測量自適應專業知識的方式包括問卷調查、情景測試、模擬實驗和實際工作表現評估四種方法。',
      page: 12,
      defining_type: 'od'
    }
  ]
};

export const ProcessingProgressExample: React.FC = () => {
  const [selectedSentence, setSelectedSentence] = useState<SentenceData | ReferencedSentence | null>(null);
  
  // 處理句子點擊
  const handleSentenceClick = (sentence: SentenceData | ReferencedSentence) => {
    setSelectedSentence(sentence);
    // 實際應用中，這裡可能會打開 PDF 預覽模態框，跳轉到指定頁面等
    console.log('點擊句子:', sentence);
  };

  // 模擬 WebSocket 錯誤
  const [wsError, setWsError] = useState<string | null>(null);
  
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">進度顯示組件示例</h1>
      
      {/* 控制按鈕 */}
      <div className="flex space-x-4 mb-6">
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          onClick={() => setWsError(wsError ? null : 'WebSocket連接失敗，嘗試重新連接...')}
        >
          {wsError ? '清除連接錯誤' : '模擬WebSocket錯誤'}
        </button>
      </div>
      
      {/* 文件處理進度 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">文件處理進度</h2>
        <ProcessingProgress 
          type="file"
          progress={fileProgressExample}
          error={wsError}
          isFallbackMode={!!wsError}
          onSentenceClick={handleSentenceClick}
        />
      </div>
      
      {/* 查詢處理進度 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-3">查詢處理進度</h2>
        <ProcessingProgress 
          type="query"
          progress={queryProgressExample}
          error={wsError}
          isFallbackMode={!!wsError}
          onSentenceClick={handleSentenceClick}
        />
      </div>
      
      {/* 選中的句子預覽 */}
      {selectedSentence && (
        <div className="mt-8 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">選中的句子</h2>
          <p className="text-gray-800">{selectedSentence.sentence}</p>
          <div className="mt-2 text-sm text-gray-600">
            <div>頁碼: {selectedSentence.page}</div>
            {'original_name' in selectedSentence && (
              <div>來源文件: {selectedSentence.original_name}</div>
            )}
            <div>
              類型: {
                selectedSentence.defining_type === 'cd' ? '概念型定義' : 
                selectedSentence.defining_type === 'od' ? '操作型定義' : 
                '非定義句'
              }
            </div>
            {'reason' in selectedSentence && selectedSentence.reason && (
              <div>分類理由: {selectedSentence.reason}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 