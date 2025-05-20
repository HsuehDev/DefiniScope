import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesService } from '../services/filesService';
import { FilePaginationParams } from '../types/files';

export function useFilesList(params: FilePaginationParams = {}) {
  return useQuery({
    queryKey: ['files', params],
    queryFn: () => filesService.getFilesList(params),
    staleTime: 1000 * 60 * 5, // 5分鐘
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (fileUuid: string) => filesService.deleteFile(fileUuid),
    onSuccess: () => {
      // 刪除成功後，使所有檔案列表查詢無效
      queryClient.invalidateQueries({ queryKey: ['files'] });
    }
  });
} 