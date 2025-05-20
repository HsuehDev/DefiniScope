// progress.ts - 定義處理進度顯示相關類型

// 檔案處理狀態
export type FileProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 定義類型
export type DefiningType = 'cd' | 'od' | 'none';

// 句子數據
export interface SentenceData {
  sentence_uuid?: string;
  file_uuid?: string;
  sentence: string;
  page: number;
  defining_type?: DefiningType;
  reason?: string;
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
  event?: FileProcessingEvent;
  file_uuid: string;
  progress: number;  // 0-100
  current?: number;
  total?: number;
  status: FileProcessingStatus;
  currentStep: string;
  errorMessage?: string;
  timestamp?: string;
  extractedSentences: SentenceData[];
  classifiedSentences: SentenceData[];
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
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: DefiningType;
  relevance_score?: number;
}

// 查詢處理進度
export interface QueryProcessingProgress {
  event?: QueryProcessingEvent;
  query_uuid: string;
  progress: number;  // 0-100
  status: FileProcessingStatus;
  currentStep: string;
  errorMessage?: string;
  timestamp?: string;
  keywords: string[];
  foundDefinitions: {
    cd: number;
    od: number;
  };
  searchResults: Record<string, ReferencedSentence[]>;
  referencedSentences: ReferencedSentence[];
}

// WebSocket消息
export interface WebSocketMessage<T> {
  event: string;
  data: T;
} 