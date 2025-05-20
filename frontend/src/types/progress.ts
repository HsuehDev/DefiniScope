// progress.ts - 定義處理進度顯示相關類型

// 檔案處理狀態
export type FileProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 定義類型
export type DefiningType = 'cd' | 'od' | 'none';

// 句子數據
export interface SentenceData {
  sentence_uuid: string;
  content: string;
  page_number?: number;
  [key: string]: any;
}

// 檔案處理相關事件類型
export type FileProcessingEvent = 
  | 'processing_started'
  | 'pdf_extraction_progress'
  | 'sentence_extraction_detail'
  | 'sentence_classification_progress'
  | 'sentence_classification_detail'
  | 'processing_completed'
  | 'processing_failed';

// 檔案處理進度
export interface FileProcessingProgress {
  file_uuid: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  extractedSentences: SentenceData[];
  classifiedSentences: SentenceData[];
  current?: number;
  total?: number;
  errorMessage?: string;
}

// 查詢處理相關事件類型
export type QueryProcessingEvent = 
  | 'query_processing_started'
  | 'keyword_extraction_completed'
  | 'database_search_progress'
  | 'database_search_result'
  | 'answer_generation_started'
  | 'referenced_sentences'
  | 'query_completed'
  | 'query_failed';

// 引用的句子
export interface ReferencedSentence {
  sentence_uuid: string;
  content: string;
  file_uuid?: string;
  page_number?: number;
  relevance_score?: number;
  [key: string]: any;
}

// 查詢處理進度
export interface QueryProcessingProgress {
  query_uuid: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  keywords: string[];
  foundDefinitions: {
    cd: number;
    od: number;
  };
  searchResults: Record<string, ReferencedSentence[]>;
  referencedSentences: ReferencedSentence[];
  errorMessage?: string;
}

// WebSocket 進度追踪相關類型

export interface WebSocketMessage<T = any> {
  event: string;
  data?: T;
  timestamp?: string;
}

// 文件處理進度
export interface FileProcessingProgress {
  file_uuid: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  extractedSentences: SentenceData[];
  classifiedSentences: SentenceData[];
  current?: number;
  total?: number;
  errorMessage?: string;
}

// 查詢處理進度
export interface QueryProcessingProgress {
  query_uuid: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  keywords: string[];
  foundDefinitions: {
    cd: number;
    od: number;
  };
  searchResults: Record<string, ReferencedSentence[]>;
  referencedSentences: ReferencedSentence[];
  errorMessage?: string;
} 