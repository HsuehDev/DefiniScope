/**
 * API服務
 * 提供與後端API交互的函數
 */

import { Sentence, Reference } from '../types/reference';

const API_BASE_URL = '/api';

/**
 * 獲取句子上下文
 * @param fileUuid 文件UUID
 * @param sentenceUuid 句子UUID
 */
export async function fetchSentenceContext(fileUuid: string, sentenceUuid: string): Promise<{
  before: string[];
  sentence: string;
  after: string[];
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/files/${fileUuid}/sentences/${sentenceUuid}/context`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('獲取句子上下文時出錯:', error);
    throw error;
  }
}

/**
 * 獲取PDF預覽URL
 * @param fileUuid 文件UUID
 * @param page 頁碼
 * @param sentenceUuid 可選，高亮顯示的句子UUID
 */
export function getPdfPreviewUrl(fileUuid: string, page: number, sentenceUuid?: string): string {
  let url = `${API_BASE_URL}/files/${fileUuid}/preview?page=${page}`;
  
  if (sentenceUuid) {
    url += `&highlight=${sentenceUuid}`;
  }
  
  return url;
}

/**
 * 獲取文件中的特定句子
 * @param fileUuid 文件UUID
 * @param sentenceUuid 句子UUID
 */
export async function fetchSentence(fileUuid: string, sentenceUuid: string): Promise<Sentence> {
  try {
    const response = await fetch(`${API_BASE_URL}/files/${fileUuid}/sentences/${sentenceUuid}/view`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('獲取句子時出錯:', error);
    throw error;
  }
}

/**
 * 搜索定義
 * @param query 搜索關鍵詞
 * @param definingType 可選，定義類型
 * @param limit 可選，結果數量上限
 */
export async function searchDefinitions(
  query: string, 
  definingType?: 'cd' | 'od' | 'both',
  limit?: number
): Promise<Sentence[]> {
  try {
    let url = `${API_BASE_URL}/search/definitions?query=${encodeURIComponent(query)}`;
    
    if (definingType) {
      url += `&defining_type=${definingType}`;
    }
    
    if (limit) {
      url += `&limit=${limit}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('搜索定義時出錯:', error);
    throw error;
  }
} 