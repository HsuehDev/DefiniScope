import React, { useState } from 'react';
import styled from 'styled-components';
import { ProgressDisplay } from './ProgressDisplay';
import { FileProcessingProgress as FileProcessingProgressType, SentenceData } from '../hooks/useFileProcessing';

interface FileProcessingProgressProps {
  progress: FileProcessingProgressType;
  onViewSentence?: (sentence: SentenceData) => void;
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

const StepDetails = styled.div`
  margin-top: 1rem;
`;

const StepTitle = styled.h3`
  font-size: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const StepContent = styled.div`
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

const Pill = styled.span<{ type: string }>`
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
  margin-left: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: ${props => 
    props.type === 'cd' ? '#2196F3' : 
    props.type === 'od' ? '#4CAF50' : 
    '#9E9E9E'};
  color: white;
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

export const FileProcessingProgress: React.FC<FileProcessingProgressProps> = ({
  progress,
  onViewSentence,
  connectionError,
  fallbackMode
}) => {
  const [showExtractedSentences, setShowExtractedSentences] = useState(false);
  const [showClassifiedSentences, setShowClassifiedSentences] = useState(true);
  
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
      
      <StepDetails>
        {progress.extractedSentences.length > 0 && (
          <>
            <StepTitle onClick={() => setShowExtractedSentences(!showExtractedSentences)}>
              已提取句子 ({progress.extractedSentences.length})
              {showExtractedSentences ? ' 🔽' : ' 🔼'}
            </StepTitle>
            
            {showExtractedSentences && (
              <StepContent>
                {progress.extractedSentences.slice(0, 5).map((sentence, index) => (
                  <SentenceItem 
                    key={sentence.sentence_uuid || index} 
                    onClick={() => onViewSentence && onViewSentence(sentence)}
                  >
                    {sentence.sentence.length > 100 
                      ? `${sentence.sentence.substring(0, 100)}...` 
                      : sentence.sentence}
                    <div style={{ fontSize: '0.75rem', color: '#757575', marginTop: '0.25rem' }}>
                      頁碼: {sentence.page}
                    </div>
                  </SentenceItem>
                ))}
                {progress.extractedSentences.length > 5 && (
                  <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#757575' }}>
                    顯示前5項，共 {progress.extractedSentences.length} 項
                  </div>
                )}
              </StepContent>
            )}
          </>
        )}
        
        {progress.classifiedSentences.length > 0 && (
          <>
            <StepTitle onClick={() => setShowClassifiedSentences(!showClassifiedSentences)}>
              已分類句子 ({progress.classifiedSentences.length})
              {showClassifiedSentences ? ' 🔽' : ' 🔼'}
            </StepTitle>
            
            {showClassifiedSentences && (
              <StepContent>
                {progress.classifiedSentences.slice(0, 5).map((sentence, index) => (
                  <SentenceItem 
                    key={sentence.sentence_uuid || index} 
                    type={sentence.defining_type}
                    onClick={() => onViewSentence && onViewSentence(sentence)}
                  >
                    {sentence.sentence.length > 100 
                      ? `${sentence.sentence.substring(0, 100)}...` 
                      : sentence.sentence}
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#757575' }}>頁碼: {sentence.page}</span>
                      <Pill type={sentence.defining_type}>
                        {sentence.defining_type === 'cd' ? '概念型定義' : 
                         sentence.defining_type === 'od' ? '操作型定義' : 
                         '非定義句'}
                      </Pill>
                    </div>
                    {sentence.reason && (
                      <div style={{ fontSize: '0.75rem', color: '#757575', marginTop: '0.25rem' }}>
                        分類理由: {sentence.reason}
                      </div>
                    )}
                  </SentenceItem>
                ))}
                {progress.classifiedSentences.length > 5 && (
                  <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#757575' }}>
                    顯示前5項，共 {progress.classifiedSentences.length} 項
                  </div>
                )}
              </StepContent>
            )}
          </>
        )}
      </StepDetails>
    </Container>
  );
}; 