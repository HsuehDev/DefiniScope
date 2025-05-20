import React, { useState } from 'react';
import { SentencePreview } from './SentencePreview';
import { SentenceData, ReferencedSentence } from '../../types/progress';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}

// 可折疊的內容區段
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  children,
  defaultOpen = false,
  testId
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <div 
        className="flex items-center justify-between p-2 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors duration-200"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={testId ? `${testId}-header` : undefined}
      >
        <div className="flex items-center">
          <span className="font-medium text-gray-800">{title}</span>
          <span className="ml-2 text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            fillRule="evenodd" 
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
            clipRule="evenodd" 
          />
        </svg>
      </div>
      
      {isOpen && (
        <div className="mt-2 pl-2" data-testid={testId ? `${testId}-content` : undefined}>
          {children}
        </div>
      )}
    </div>
  );
};

// 關鍵詞顯示組件
interface KeywordBadgeProps {
  keyword: string;
  count?: number;
}

const KeywordBadge: React.FC<KeywordBadgeProps> = ({ keyword, count }) => (
  <div className="inline-flex items-center px-3 py-1 m-1 rounded-full bg-blue-50 border border-blue-200" data-testid={`keyword-${keyword}`}>
    <span className="text-sm text-blue-800">{keyword}</span>
    {count !== undefined && (
      <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-200 text-blue-800 rounded-full">
        {count}
      </span>
    )}
  </div>
);

// 定義統計信息組件
interface DefinitionStatsProps {
  cdCount: number;
  odCount: number;
}

const DefinitionStats: React.FC<DefinitionStatsProps> = ({ cdCount, odCount }) => (
  <div className="flex space-x-4 mt-3 mb-1">
    <div className="flex-1 bg-blue-50 rounded-md p-3 text-center border border-blue-100" data-testid="definition-stats-cd">
      <div className="text-2xl font-bold text-blue-700">{cdCount}</div>
      <div className="text-sm text-blue-600">概念型定義</div>
    </div>
    <div className="flex-1 bg-green-50 rounded-md p-3 text-center border border-green-100" data-testid="definition-stats-od">
      <div className="text-2xl font-bold text-green-700">{odCount}</div>
      <div className="text-sm text-green-600">操作型定義</div>
    </div>
  </div>
);

// 詳細信息面板主組件
interface DetailPanelProps {
  extractedSentences?: SentenceData[];
  classifiedSentences?: SentenceData[];
  keywords?: string[];
  searchResults?: Record<string, ReferencedSentence[]>;
  referencedSentences?: ReferencedSentence[];
  foundDefinitions?: { cd: number, od: number };
  onSentenceClick?: (sentence: SentenceData | ReferencedSentence) => void;
  className?: string;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  extractedSentences = [],
  classifiedSentences = [],
  keywords = [],
  searchResults = {},
  referencedSentences = [],
  foundDefinitions = { cd: 0, od: 0 },
  onSentenceClick,
  className = ''
}) => {
  const searchResultsCount = Object.values(searchResults).reduce(
    (total, sentences) => total + sentences.length, 
    0
  );

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`} data-testid="detail-panel-container">
      {/* 關鍵詞區段 */}
      {keywords.length > 0 && (
        <div className="mb-4" data-testid="keywords-section">
          <h3 className="text-sm font-medium text-gray-700 mb-2">關鍵詞</h3>
          <div className="flex flex-wrap">
            {keywords.map((keyword, index) => (
              <KeywordBadge 
                key={index} 
                keyword={keyword} 
                count={searchResults[keyword]?.length}
              />
            ))}
          </div>
          
          {(foundDefinitions.cd > 0 || foundDefinitions.od > 0) && (
            <DefinitionStats cdCount={foundDefinitions.cd} odCount={foundDefinitions.od} />
          )}
        </div>
      )}
      
      {/* 已提取句子區段 */}
      {extractedSentences.length > 0 && (
        <CollapsibleSection 
          title="已提取句子" 
          count={extractedSentences.length}
          defaultOpen={false}
          testId="extracted-sentences"
        >
          {extractedSentences.slice(0, 5).map((sentence, index) => (
            <SentencePreview
              key={sentence.sentence_uuid || `extracted-${index}`}
              sentence={sentence}
              onClick={() => onSentenceClick && onSentenceClick(sentence)}
            />
          ))}
          {extractedSentences.length > 5 && (
            <div className="text-center text-sm text-gray-500 mt-2">
              顯示前5項，共 {extractedSentences.length} 項
            </div>
          )}
        </CollapsibleSection>
      )}
      
      {/* 已分類句子區段 */}
      {classifiedSentences.length > 0 && (
        <CollapsibleSection 
          title="已分類句子" 
          count={classifiedSentences.length}
          defaultOpen={true}
          testId="classified-sentences"
        >
          {classifiedSentences.slice(0, 5).map((sentence, index) => (
            <SentencePreview
              key={sentence.sentence_uuid || `classified-${index}`}
              sentence={sentence}
              onClick={() => onSentenceClick && onSentenceClick(sentence)}
            />
          ))}
          {classifiedSentences.length > 5 && (
            <div className="text-center text-sm text-gray-500 mt-2">
              顯示前5項，共 {classifiedSentences.length} 項
            </div>
          )}
        </CollapsibleSection>
      )}
      
      {/* 搜尋結果區段 */}
      {searchResultsCount > 0 && (
        <CollapsibleSection 
          title="搜尋結果" 
          count={searchResultsCount}
          defaultOpen={true}
          testId="search-results"
        >
          {Object.entries(searchResults).map(([keyword, sentences]) => (
            <div key={keyword} className="mb-3" data-testid={`search-result-${keyword}`}>
              <div className="text-sm font-medium text-gray-700 mb-1.5" data-testid={`search-result-keyword-title-${keyword}`}>
                關鍵詞: {keyword} ({sentences.length} 個相關句子)
              </div>
              
              {sentences.slice(0, 3).map((sentence, index) => (
                <SentencePreview
                  key={sentence.sentence_uuid || `search-${keyword}-${index}`}
                  sentence={sentence}
                  onClick={() => onSentenceClick && onSentenceClick(sentence)}
                />
              ))}
              
              {sentences.length > 3 && (
                <div className="text-center text-sm text-gray-500 mt-2 mb-3">
                  顯示前3項，共 {sentences.length} 項
                </div>
              )}
            </div>
          ))}
        </CollapsibleSection>
      )}
      
      {/* 參考句子區段 */}
      {referencedSentences.length > 0 && (
        <CollapsibleSection 
          title="生成答案參考句子" 
          count={referencedSentences.length}
          defaultOpen={true}
          testId="referenced-sentences"
        >
          {referencedSentences.map((sentence, index) => (
            <SentencePreview
              key={sentence.sentence_uuid || `referenced-${index}`}
              sentence={sentence}
              onClick={() => onSentenceClick && onSentenceClick(sentence)}
            />
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}; 