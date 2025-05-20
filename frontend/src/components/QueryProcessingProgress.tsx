import React, { useState } from 'react';
import styled from 'styled-components';
import { ProgressDisplay } from './ProgressDisplay';
import { QueryProcessingProgress as QueryProgressType, ReferencedSentence } from '../hooks/useQueryProcessing';

interface QueryProcessingProgressProps {
  progress: QueryProgressType;
  onViewSentence?: (sentence: ReferencedSentence) => void;
  connectionError?: string | null;
  fallbackMode?: boolean;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: #f5f5f5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
`;

const Section = styled.div`
  margin-top: 1rem;
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const SectionContent = styled.div`
  margin-left: 1rem;
  margin-bottom: 1rem;
`;

const SentenceItem = styled.div<{ type?: string }>`
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
  background-color: ${props => 
    props.type === 'cd' ? '#E3F2FD' : 
    props.type === 'od' ? '#E8F5E9' : 
    '#FFF'};
  border-left: 4px solid ${props => 
    props.type === 'cd' ? '#2196F3' : 
    props.type === 'od' ? '#4CAF50' : 
    '#E0E0E0'};
  cursor: pointer;
  
  &:hover {
    background-color: ${props => 
      props.type === 'cd' ? '#BBDEFB' : 
      props.type === 'od' ? '#C8E6C9' : 
      '#F5F5F5'};
  }
`;

const KeywordPill = styled.div`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  margin: 0.25rem;
  border-radius: 1rem;
  background-color: #E1F5FE;
  color: #0288D1;
  font-size: 0.875rem;
  border: 1px solid #B3E5FC;
`;

const DefinitionStats = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
`;

const StatItem = styled.div<{ type: string }>`
  padding: 0.5rem;
  border-radius: 0.25rem;
  background-color: ${props => props.type === 'cd' ? '#E3F2FD' : '#E8F5E9'};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: #616161;
`;

const StatValue = styled.div<{ type: string }>`
  font-size: 1.25rem;
  font-weight: 500;
  color: ${props => props.type === 'cd' ? '#1976D2' : '#388E3C'};
`;

const ConnectionError = styled.div`
  padding: 0.5rem;
  margin-top: 0.5rem;
  border-radius: 0.25rem;
  background-color: #FFF3E0;
  color: #E65100;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 0.5rem;
  }
`;

export const QueryProcessingProgress: React.FC<QueryProcessingProgressProps> = ({
  progress,
  onViewSentence,
  connectionError,
  fallbackMode
}) => {
  const [showKeywords, setShowKeywords] = useState(true);
  const [showSearchResults, setShowSearchResults] = useState(true);
  const [showReferencedSentences, setShowReferencedSentences] = useState(true);
  
  return (
    <Container>
      <ProgressDisplay
        progress={progress.progress}
        status={progress.status}
        currentStep={progress.currentStep}
        errorMessage={progress.errorMessage}
      />
      
      {connectionError && (
        <ConnectionError>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 7H13V13H11V7ZM11 15H13V17H11V15Z" fill="#E65100"/>
          </svg>
          {connectionError} {fallbackMode && '(使用輪詢模式)'}
        </ConnectionError>
      )}
      
      <Section>
        <SectionTitle onClick={() => setShowKeywords(!showKeywords)}>
          關鍵詞 {showKeywords ? '🔽' : '🔼'}
        </SectionTitle>
        
        {showKeywords && (
          <SectionContent>
            {progress.keywords.length > 0 ? (
              <div>
                {progress.keywords.map((keyword, index) => (
                  <KeywordPill key={index}>{keyword}</KeywordPill>
                ))}
              </div>
            ) : (
              <div style={{ color: '#757575', fontSize: '0.875rem' }}>尚未提取關鍵詞</div>
            )}
            
            {progress.foundDefinitions.cd > 0 || progress.foundDefinitions.od > 0 ? (
              <DefinitionStats>
                <StatItem type="cd">
                  <StatValue type="cd">{progress.foundDefinitions.cd}</StatValue>
                  <StatLabel>概念型定義</StatLabel>
                </StatItem>
                <StatItem type="od">
                  <StatValue type="od">{progress.foundDefinitions.od}</StatValue>
                  <StatLabel>操作型定義</StatLabel>
                </StatItem>
              </DefinitionStats>
            ) : null}
          </SectionContent>
        )}
      </Section>
      
      {Object.keys(progress.searchResults).length > 0 && (
        <Section>
          <SectionTitle onClick={() => setShowSearchResults(!showSearchResults)}>
            搜尋結果 {showSearchResults ? '🔽' : '🔼'}
          </SectionTitle>
          
          {showSearchResults && (
            <SectionContent>
              {Object.entries(progress.searchResults).map(([keyword, sentences]) => (
                <div key={keyword} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                    關鍵詞: {keyword} ({sentences.length} 個相關句子)
                  </div>
                  
                  {sentences.slice(0, 3).map((sentence, index) => (
                    <SentenceItem 
                      key={sentence.sentence_uuid || index} 
                      type={sentence.defining_type}
                      onClick={() => onViewSentence && onViewSentence(sentence)}
                    >
                      {sentence.sentence.length > 100 
                        ? `${sentence.sentence.substring(0, 100)}...` 
                        : sentence.sentence}
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        <span style={{ color: '#757575' }}>來源: {sentence.original_name} (頁 {sentence.page})</span>
                        {sentence.relevance_score && (
                          <span style={{ marginLeft: '0.5rem', color: '#757575' }}>
                            相關度: {(sentence.relevance_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </SentenceItem>
                  ))}
                  
                  {sentences.length > 3 && (
                    <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#757575' }}>
                      顯示前3項，共 {sentences.length} 項
                    </div>
                  )}
                </div>
              ))}
            </SectionContent>
          )}
        </Section>
      )}
      
      {progress.referencedSentences.length > 0 && (
        <Section>
          <SectionTitle onClick={() => setShowReferencedSentences(!showReferencedSentences)}>
            生成答案參考句子 {showReferencedSentences ? '🔽' : '🔼'}
          </SectionTitle>
          
          {showReferencedSentences && (
            <SectionContent>
              {progress.referencedSentences.map((sentence, index) => (
                <SentenceItem 
                  key={sentence.sentence_uuid || index} 
                  type={sentence.defining_type}
                  onClick={() => onViewSentence && onViewSentence(sentence)}
                >
                  {sentence.sentence.length > 100 
                    ? `${sentence.sentence.substring(0, 100)}...` 
                    : sentence.sentence}
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    <span style={{ color: '#757575' }}>
                      來源: {sentence.original_name} (頁 {sentence.page})
                    </span>
                  </div>
                </SentenceItem>
              ))}
            </SectionContent>
          )}
        </Section>
      )}
    </Container>
  );
}; 