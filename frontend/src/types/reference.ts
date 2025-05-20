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