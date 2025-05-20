import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryProcessing, ReferencedSentence } from '../hooks/useQueryProcessing';
import { QueryProcessingProgress } from '../components/QueryProcessingProgress';
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

const AnswerContainer = styled.div`
  margin-top: 1.5rem;
  padding: 1.5rem;
  border-radius: 0.5rem;
  background-color: #F9FBE7;
  border-left: 4px solid #8BC34A;
`;

const ChatQueryPage: React.FC = () => {
  const { queryUuid, conversationUuid } = useParams<{ queryUuid: string; conversationUuid: string }>();
  const [selectedSentence, setSelectedSentence] = useState<ReferencedSentence | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  
  const handleProcessingComplete = useCallback(() => {
    // 查詢完成後，獲取答案
    fetchAnswer();
  }, []);
  
  const handleProcessingFail = useCallback((errorMessage: string) => {
    // 顯示錯誤通知
    console.error('Query processing failed:', errorMessage);
  }, []);
  
  const fetchAnswer = async () => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationUuid}/messages?query_uuid=${queryUuid}`);
      if (response.ok) {
        const data = await response.json();
        const assistantMessage = data.messages.find((msg: any) => msg.role === 'assistant');
        if (assistantMessage) {
          setAnswer(assistantMessage.content);
        }
      }
    } catch (error) {
      console.error('Failed to fetch answer:', error);
    }
  };
  
  const { progress, wsStatus, connectionError, fallbackMode } = useQueryProcessing({
    queryUuid: queryUuid || '',
    onComplete: handleProcessingComplete,
    onFail: handleProcessingFail
  });
  
  const handleViewSentence = useCallback((sentence: ReferencedSentence) => {
    setSelectedSentence(sentence);
  }, []);
  
  const handleViewInPdf = useCallback(() => {
    if (selectedSentence) {
      // 開啟PDF預覽並高亮顯示選中的句子
      window.open(`/files/${selectedSentence.file_uuid}/preview?page=${selectedSentence.page}&highlight=${selectedSentence.sentence_uuid}`, '_blank');
    }
  }, [selectedSentence]);
  
  useEffect(() => {
    // 如果處理已完成，獲取答案
    if (progress.status === 'completed') {
      fetchAnswer();
    }
  }, [progress.status]);
  
  return (
    <Container>
      <Title>查詢處理進度</Title>
      
      <Card>
        <QueryProcessingProgress 
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
      
      {answer && (
        <AnswerContainer>
          <h3>回答</h3>
          <div dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br/>') }} />
        </AnswerContainer>
      )}
      
      {selectedSentence && (
        <SentenceModal onClick={() => setSelectedSentence(null)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                {selectedSentence.defining_type === 'cd' ? '概念型定義' : 
                 selectedSentence.defining_type === 'od' ? '操作型定義' : 
                 '句子'} ({selectedSentence.original_name})
              </ModalTitle>
              <CloseButton onClick={() => setSelectedSentence(null)}>&times;</CloseButton>
            </ModalHeader>
            
            <div style={{ marginBottom: '1rem' }}>
              {selectedSentence.sentence}
            </div>
            
            <div style={{ fontSize: '0.875rem', color: '#757575', marginBottom: '1rem' }}>
              <strong>頁碼:</strong> {selectedSentence.page}
            </div>
            
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

export default ChatQueryPage; 