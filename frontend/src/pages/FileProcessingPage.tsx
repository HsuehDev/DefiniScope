import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileProcessing, SentenceData } from '../hooks/useFileProcessing';
import { FileProcessingProgress } from '../components/FileProcessingProgress';
import styled from 'styled-components';

const Container = styled.div`
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  margin-bottom: 1rem;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const SentenceModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.25rem;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
  
  &:hover {
    background-color: #1976D2;
  }
  
  &:disabled {
    background-color: #BDBDBD;
    cursor: not-allowed;
  }
`;

const FileProcessingPage: React.FC = () => {
  const { fileUuid } = useParams<{ fileUuid: string }>();
  const navigate = useNavigate();
  const [selectedSentence, setSelectedSentence] = useState<SentenceData | null>(null);
  
  const handleProcessingComplete = useCallback(() => {
    // 可以顯示完成通知或自動導航到檔案詳情頁
    console.log('Processing completed!');
  }, []);
  
  const handleProcessingFail = useCallback((errorMessage: string) => {
    // 顯示錯誤通知
    console.error('Processing failed:', errorMessage);
  }, []);
  
  const { progress, wsStatus, connectionError, fallbackMode } = useFileProcessing({
    fileUuid: fileUuid || '',
    onComplete: handleProcessingComplete,
    onFail: handleProcessingFail
  });
  
  const handleViewSentence = useCallback((sentence: SentenceData) => {
    setSelectedSentence(sentence);
  }, []);
  
  const handleViewInPdf = useCallback(() => {
    if (selectedSentence) {
      // 導航到PDF預覽頁面，並高亮顯示選中的句子
      navigate(`/files/${fileUuid}/preview?page=${selectedSentence.page}&highlight=${selectedSentence.sentence_uuid}`);
    }
  }, [selectedSentence, fileUuid, navigate]);
  
  return (
    <Container>
      <Title>檔案處理進度</Title>
      
      <Card>
        <FileProcessingProgress 
          progress={progress} 
          onViewSentence={handleViewSentence}
          connectionError={connectionError}
          fallbackMode={fallbackMode}
        />
        
        {wsStatus !== 'connected' && wsStatus !== 'connecting' && !fallbackMode && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Button onClick={() => window.location.reload()}>
              重新連接
            </Button>
          </div>
        )}
      </Card>
      
      {selectedSentence && (
        <SentenceModal onClick={() => setSelectedSentence(null)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                {selectedSentence.defining_type === 'cd' ? '概念型定義' : 
                 selectedSentence.defining_type === 'od' ? '操作型定義' : 
                 '句子'} (頁碼: {selectedSentence.page})
              </ModalTitle>
              <CloseButton onClick={() => setSelectedSentence(null)}>&times;</CloseButton>
            </ModalHeader>
            
            <div style={{ marginBottom: '1rem' }}>
              {selectedSentence.sentence}
            </div>
            
            {selectedSentence.reason && (
              <div style={{ fontSize: '0.875rem', color: '#757575', marginBottom: '1rem' }}>
                <strong>分類理由:</strong> {selectedSentence.reason}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleViewInPdf}>
                在PDF中查看
              </Button>
            </div>
          </ModalContent>
        </SentenceModal>
      )}
    </Container>
  );
};

export default FileProcessingPage; 