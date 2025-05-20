import { FileListResponse, FilePaginationParams } from '../types/files';

// 預設API基礎URL
const API_BASE_URL = '/api';

export const filesService = {
  /**
   * 獲取使用者檔案列表
   */
  async getFilesList(params: FilePaginationParams = {}): Promise<FileListResponse> {
    const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = params;
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sort_by,
      sort_order
    });
    
    const response = await fetch(`${API_BASE_URL}/files?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '獲取檔案列表失敗');
    }
    
    return response.json();
  },
  
  /**
   * 刪除檔案
   */
  async deleteFile(fileUuid: string): Promise<{ detail: string }> {
    const response = await fetch(`${API_BASE_URL}/files/${fileUuid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '刪除檔案失敗');
    }
    
    return response.json();
  }
}; 