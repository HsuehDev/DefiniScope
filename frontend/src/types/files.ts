export type FileStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'timeout';

export interface FileItem {
  file_uuid: string;
  original_name: string;
  size_bytes: number;
  upload_status: FileStatus;
  processing_status: FileStatus;
  sentence_count: number;
  cd_count: number;
  od_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface FileListResponse {
  total: number;
  page: number;
  limit: number;
  files: FileItem[];
}

export interface FilePaginationParams {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'original_name';
  sort_order?: 'asc' | 'desc';
} 