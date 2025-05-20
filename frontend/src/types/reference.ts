// 句子類型定義
export interface Sentence {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: 'cd' | 'od' | 'none';
  reason?: string;
}

// 參考引用類型定義
export interface Reference {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: 'cd' | 'od';
}

// 消息類型定義
export interface Message {
  message_uuid: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Reference[];
  created_at: string;
}

// 預覽PDF頁面時需要的參數
export interface PDFPreviewParams {
  file_uuid: string;
  page: number;
  sentence_uuid?: string; // 用於高亮顯示特定句子
}

// 預覽上下文視窗的參數
export interface ContextViewerParams {
  reference: Reference;
  isOpen: boolean;
  onClose: () => void;
}

// 引用標籤的參數
export interface ReferenceTagProps {
  reference: Reference;
  onClick: (reference: Reference) => void;
  onHover: (reference: Reference) => void;
}

// 參考信息面板相關類型定義

// 句子引用類型
export interface SentenceReference {
  sentence_uuid: string;
  file_uuid: string;
  original_name: string;
  sentence: string;
  page: number;
  defining_type: 'cd' | 'od' | 'none';
  reason?: string;
  relevance_score?: number;
}

// 消息引用類型
export interface MessageReference {
  message_uuid: string;
  references: SentenceReference[];
}

// 處理步驟中參考的句子類型
export interface ProcessingReference {
  event: string;
  file_uuid: string;
  sentences: SentenceReference[];
  timestamp: string;
}

// 參考面板屬性
export interface ReferencePanelProps {
  // 當前選中的消息UUID(如果是從聊天中查看引用)
  selectedMessageUuid?: string;
  // 從處理過程中參考的句子(如果是從處理過程中查看引用)
  processingReference?: ProcessingReference;
  // 回調函數，跳轉到PDF中的指定頁面並高亮句子
  onViewInPdf?: (fileUuid: string, page: number, sentenceUuid: string) => void;
  // 參考來源(聊天或處理過程)
  referenceSource: 'chat' | 'processing';
}

// 單個參考項屬性
export interface ReferenceItemProps {
  reference: SentenceReference;
  onViewInPdf?: (fileUuid: string, page: number, sentenceUuid: string) => void;
}

// 參考列表屬性
export interface ReferenceListProps {
  references: SentenceReference[];
  onViewInPdf?: (fileUuid: string, page: number, sentenceUuid: string) => void;
} 