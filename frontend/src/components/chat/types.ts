// 句子引用類型
export interface Reference {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: 'cd' | 'od' | 'none';
}

// 聊天消息類型
export interface ChatMessage {
  message_uuid: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Reference[];
  created_at: string;
}

// 對話類型
export interface Conversation {
  conversation_uuid: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  messages: ChatMessage[];
}

// 查詢處理進度事件類型
export interface QueryProgressEvent {
  event: string;
  query_uuid: string;
  progress?: number;
  current_step?: string;
  keywords?: string[];
  found_definitions?: {
    cd: number;
    od: number;
  };
  timestamp: string;
}

// 資料庫搜尋結果事件類型
export interface DatabaseSearchResultEvent {
  event: 'database_search_result';
  query_uuid: string;
  keyword: string;
  found_sentences: Reference[];
  timestamp: string;
}

// 引用句子事件類型
export interface ReferencedSentencesEvent {
  event: 'referenced_sentences';
  query_uuid: string;
  referenced_sentences: Reference[];
  timestamp: string;
}

// WebSocket事件類型聯合
export type WebSocketEvent = 
  | QueryProgressEvent 
  | DatabaseSearchResultEvent 
  | ReferencedSentencesEvent;

// 聊天輸入參數
export interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  placeholder?: string;
}

// 聊天消息參數
export interface ChatMessageProps {
  message: ChatMessage;
  onViewReference?: (reference: Reference) => void;
}

// 引用顯示參數
export interface ReferenceDisplayProps {
  reference: Reference;
  onClick?: () => void;
}

// 聊天容器參數
export interface ChatContainerProps {
  conversation: Conversation | null;
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
  onViewReference: (reference: Reference) => void;
  processingProgress?: number;
  processingStep?: string;
  referencedSentences?: Reference[];
} 