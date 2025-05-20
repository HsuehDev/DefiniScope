import axios from 'axios';
import { SentenceReference } from '../types/reference';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

/**
 * 獲取消息的參考句子信息
 * @param messageUuid 消息UUID
 * @returns 包含參考句子的響應數據
 */
export const fetchMessageReferences = async (messageUuid: string): Promise<{ references: SentenceReference[] }> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/chat/messages/${messageUuid}/references`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('獲取消息參考信息失敗:', error);
    throw error;
  }
};

/**
 * 獲取對話內容
 * @param conversationUuid 對話UUID
 * @returns 包含對話信息和消息列表的響應數據
 */
export const fetchConversation = async (conversationUuid: string): Promise<any> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/chat/conversations/${conversationUuid}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('獲取對話內容失敗:', error);
    throw error;
  }
}; 