import axios from 'axios';
import { 
  InitUploadResponse, 
  UploadPartResponse, 
  CompleteUploadResponse,
  UploadStatusResponse
} from '../types/upload';

const API_BASE_URL = '/api';

/**
 * 初始化分片上傳
 * 
 * @param fileName 檔案名稱
 * @param fileSize 檔案大小
 * @param contentType 檔案類型
 * @param chunkCount 分片數量
 * @returns 上傳ID和檔案ID
 */
export const initMultipartUpload = async (
  fileName: string,
  fileSize: number,
  contentType: string,
  chunkCount: number
): Promise<InitUploadResponse> => {
  try {
    const response = await axios.post<InitUploadResponse>(
      `${API_BASE_URL}/files/multipart/init`,
      {
        file_name: fileName,
        file_size: fileSize,
        content_type: contentType,
        chunk_count: chunkCount
      }
    );
    return response.data;
  } catch (error) {
    console.error('初始化上傳失敗:', error);
    throw error;
  }
};

/**
 * 上傳分片
 * 
 * @param fileId 檔案ID
 * @param uploadId 上傳ID
 * @param partNumber 分片編號
 * @param blob 分片數據
 * @returns 分片上傳結果
 */
export const uploadPart = async (
  fileId: string,
  uploadId: string,
  partNumber: number,
  blob: Blob
): Promise<UploadPartResponse> => {
  const formData = new FormData();
  formData.append('file', blob);

  try {
    const response = await axios.post<UploadPartResponse>(
      `${API_BASE_URL}/files/multipart/${fileId}/${uploadId}/${partNumber}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          // 這裡可以添加進度處理，但在 hook 中處理更合適
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(`上傳分片 ${partNumber} 失敗:`, error);
    throw error;
  }
};

/**
 * 完成分片上傳
 * 
 * @param fileId 檔案ID
 * @param uploadId 上傳ID
 * @returns 完成上傳結果
 */
export const completeMultipartUpload = async (
  fileId: string,
  uploadId: string
): Promise<CompleteUploadResponse> => {
  try {
    const response = await axios.post<CompleteUploadResponse>(
      `${API_BASE_URL}/files/multipart/${fileId}/${uploadId}/complete`
    );
    return response.data;
  } catch (error) {
    console.error('完成上傳失敗:', error);
    throw error;
  }
};

/**
 * 取消分片上傳
 * 
 * @param fileId 檔案ID
 * @param uploadId 上傳ID
 * @returns 是否成功取消
 */
export const abortMultipartUpload = async (
  fileId: string,
  uploadId: string
): Promise<{ status: string; message: string }> => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/files/multipart/${fileId}/${uploadId}`
    );
    return response.data;
  } catch (error) {
    console.error('取消上傳失敗:', error);
    throw error;
  }
};

/**
 * 獲取上傳狀態 (用於斷點續傳)
 * 
 * @param fileId 檔案ID
 * @param uploadId 上傳ID
 * @returns 上傳狀態
 */
export const getUploadStatus = async (
  fileId: string,
  uploadId: string
): Promise<UploadStatusResponse> => {
  try {
    const response = await axios.get<UploadStatusResponse>(
      `${API_BASE_URL}/files/multipart/${fileId}/${uploadId}/status`
    );
    return response.data;
  } catch (error) {
    console.error('獲取上傳狀態失敗:', error);
    throw error;
  }
}; 