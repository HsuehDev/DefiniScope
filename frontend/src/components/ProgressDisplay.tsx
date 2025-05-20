import React from 'react';
import styled from 'styled-components';

interface ProgressDisplayProps {
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  errorMessage?: string;
  className?: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 1rem 0;
`;

const ProgressBarContainer = styled.div`
  width: 100%;
  height: 0.5rem;
  background-color: #e0e0e0;
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
`;

const ProgressBarFill = styled.div<{ progress: number; status: string }>`
  height: 100%;
  width: ${props => `${props.progress}%`};
  background-color: ${props => 
    props.status === 'failed' ? '#F44336' : 
    props.status === 'completed' ? '#4CAF50' : 
    '#2196F3'};
  transition: width 0.3s ease-in-out;
`;

const StepInfo = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
`;

const StepText = styled.span<{ status: string }>`
  color: ${props => 
    props.status === 'failed' ? '#D32F2F' : 
    props.status === 'completed' ? '#388E3C' : 
    props.status === 'pending' ? '#757575' : 
    '#1976D2'};
  font-weight: ${props => props.status === 'pending' ? 'normal' : '500'};
`;

const ProgressPercentage = styled.span`
  font-weight: 500;
`;

const ErrorMessage = styled.div`
  color: #D32F2F;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
  background-color: #FFEBEE;
`;

export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  progress,
  status,
  currentStep,
  errorMessage,
  className
}) => {
  return (
    <Container className={className} data-testid="progress-display-container">
      <ProgressBarContainer>
        <ProgressBarFill 
          progress={progress} 
          status={status} 
          data-testid="progress-bar-fill"
        />
      </ProgressBarContainer>
      
      <StepInfo>
        <StepText status={status} data-testid="progress-step-text">
          {status === 'pending' ? '等待處理' : 
           status === 'processing' ? currentStep : 
           status === 'completed' ? '處理完成' : 
           '處理失敗'}
        </StepText>
        <ProgressPercentage data-testid="progress-percentage">{Math.round(progress)}%</ProgressPercentage>
      </StepInfo>
      
      {status === 'failed' && errorMessage && (
        <ErrorMessage data-testid="progress-error-message">{errorMessage}</ErrorMessage>
      )}
    </Container>
  );
}; 