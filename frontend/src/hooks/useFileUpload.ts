import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  FileUploadInfo, 
  UploadStatus, 
  ChunkInfo,
  UploadConfig,
  ProcessingStatus
} from '../types/upload';
import { 
  initMultipartUpload, 
  uploadPart, 
  completeMultipartUpload,
  abortMultipartUpload,
  getUploadStatus
} from '../api/uploadApi';
import {
  generateUniqueId,
  splitFileIntoChunks,
  isAcceptedFileType,
  isFileSizeValid,
  calculateSpeed,
  estimateRemainingTime,
  shouldShowTimeoutWarning,
  isUploadTimedOut,
  getDefaultUploadConfig
} from '../utils/uploadUtils';

/**
 * 檔案上傳Hook
 * 管理檔案上傳的狀態和邏輯
 * 
 * @param customConfig 自定義上傳配置
 */
export const useFileUpload = (customConfig?: Partial<UploadConfig>) => {
  // 合併默認配置和自定義配置
  const config = { ...getDefaultUploadConfig(), ...customConfig };
  
  // 文件上傳狀態列表
  const [files, setFiles] = useState<FileUploadInfo[]>([]);
  
  // 上傳任務隊列
  const uploadQueue = useRef<string[]>([]);
  
  // 正在上傳的文件數
  const [activeUploads, setActiveUploads] = useState<number>(0);
  
  // 超時檢查定時器
  const timeoutCheckInterval = useRef<NodeJS.Timeout | null>(null);
  
  // 速度計算和進度更新定時器
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  
  // 斷網監聽器
  useEffect(() => {
    const handleOnline = () => {
      console.log('網絡已恢復，嘗試繼續上傳...');
      // 網絡恢復時，嘗試繼續上傳
      resumeAllPausedUploads();
    };
    
    const handleOffline = () => {
      console.log('網絡已斷開，暫停上傳...');
      // 網絡斷開時，暫停所有上傳
      pauseAllActiveUploads();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // 設置超時檢查
  useEffect(() => {
    // 每10秒檢查一次超時
    timeoutCheckInterval.current = setInterval(() => {
      checkForTimeouts();
    }, 10000);
    
    return () => {
      if (timeoutCheckInterval.current) {
        clearInterval(timeoutCheckInterval.current);
      }
    };
  }, []);
  
  // 設置進度更新定時器
  useEffect(() => {
    // 每秒更新一次進度和速度
    progressInterval.current = setInterval(() => {
      updateProgress();
    }, 1000);
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [files]);
  
  // 檢查上傳超時
  const checkForTimeouts = useCallback(() => {
    setFiles(prevFiles => 
      prevFiles.map(file => {
        // 只檢查正在上傳的文件
        if (file.status !== UploadStatus.UPLOADING) return file;
        
        // 檢查是否應該顯示警告
        const showWarning = shouldShowTimeoutWarning(
          file.startTime,
          config.timeoutMinutes,
          config.warningThreshold
        );
        
        // 檢查是否已超時
        const timedOut = isUploadTimedOut(file.startTime, config.timeoutMinutes);
        
        if (timedOut) {
          // 標記文件為超時狀態
          return {
            ...file,
            status: UploadStatus.TIMEOUT,
            errorMessage: `上傳超時 (${config.timeoutMinutes} 分鐘)`
          };
        } else if (showWarning && !file.timeoutWarning) {
          // 顯示超時警告
          return {
            ...file,
            timeoutWarning: true
          };
        }
        
        return file;
      })
    );
  }, [config.timeoutMinutes, config.warningThreshold]);
  
  // 更新上傳進度和速度
  const updateProgress = useCallback(() => {
    setFiles(prevFiles => 
      prevFiles.map(file => {
        if (file.status !== UploadStatus.UPLOADING) return file;
        
        const currentTime = Date.now();
        const elapsedMs = currentTime - file.startTime;
        
        // 計算速度 (bytes/s)
        const speed = calculateSpeed(file.uploadedBytes, elapsedMs);
        
        // 估算剩餘時間 (秒)
        const remainingTime = estimateRemainingTime(
          file.file.size,
          file.uploadedBytes,
          speed
        );
        
        return {
          ...file,
          speed,
          remainingTime
        };
      })
    );
  }, []);
  
  // 暫停所有正在上傳的文件
  const pauseAllActiveUploads = useCallback(() => {
    setFiles(prevFiles => 
      prevFiles.map(file => {
        if (file.status === UploadStatus.UPLOADING) {
          return {
            ...file,
            status: UploadStatus.PAUSED,
          };
        }
        return file;
      })
    );
  }, []);
  
  // 繼續所有暫停的上傳
  const resumeAllPausedUploads = useCallback(() => {
    let updatedFiles = [...files];
    
    // 先更新狀態
    updatedFiles = updatedFiles.map(file => {
      if (file.status === UploadStatus.PAUSED) {
        return {
          ...file,
          status: UploadStatus.UPLOADING,
        };
      }
      return file;
    });
    
    setFiles(updatedFiles);
    
    // 然後重新啟動上傳
    updatedFiles.forEach(file => {
      if (file.status === UploadStatus.UPLOADING && file.uploadId) {
        // 如果文件有uploadId，則繼續上傳未完成的分片
        continueChunkUpload(file.id);
      }
    });
  }, [files]);
  
  // 處理文件添加
  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: FileUploadInfo[] = [];
    const invalidFiles: { file: File; reason: string }[] = [];
    
    // 驗證文件
    for (const file of newFiles) {
      // 檢查文件類型
      if (!isAcceptedFileType(file, config.acceptedFileTypes)) {
        invalidFiles.push({
          file,
          reason: '不支援的檔案類型，僅接受PDF檔案'
        });
        continue;
      }
      
      // 檢查文件大小
      if (!isFileSizeValid(file, config.maxFileSize)) {
        invalidFiles.push({
          file,
          reason: `檔案大小超過限制 (最大 ${config.maxFileSize / (1024 * 1024)} MB)`
        });
        continue;
      }
      
      // 生成分片
      const chunks = splitFileIntoChunks(file, config.chunkSize);
      
      // 建立檔案上傳信息
      validFiles.push({
        id: generateUniqueId(),
        file,
        status: UploadStatus.IDLE,
        progress: 0,
        startTime: 0,
        uploadedBytes: 0,
        speed: 0,
        remainingTime: 0,
        timeoutWarning: false,
        chunks
      });
    }
    
    // 更新文件列表
    setFiles(prev => [...prev, ...validFiles]);
    
    // 將有效文件添加到上傳隊列
    validFiles.forEach(file => {
      uploadQueue.current.push(file.id);
    });
    
    // 開始上傳
    processQueue();
    
    return {
      validFiles,
      invalidFiles
    };
  }, [config.acceptedFileTypes, config.chunkSize, config.maxFileSize]);
  
  // 初始化上傳的 mutation
  const initUploadMutation = useMutation({
    mutationFn: async (fileInfo: FileUploadInfo) => {
      return await initMultipartUpload(
        fileInfo.file.name,
        fileInfo.file.size,
        fileInfo.file.type,
        fileInfo.chunks.length
      );
    },
  });
  
  // 上傳分片的 mutation
  const uploadPartMutation = useMutation({
    mutationFn: async ({ 
      fileId, 
      uploadId, 
      partNumber, 
      blob 
    }: { 
      fileId: string; 
      uploadId: string; 
      partNumber: number; 
      blob: Blob 
    }) => {
      return await uploadPart(fileId, uploadId, partNumber, blob);
    },
  });
  
  // 完成上傳的 mutation
  const completeUploadMutation = useMutation({
    mutationFn: async ({ 
      fileId, 
      uploadId 
    }: { 
      fileId: string; 
      uploadId: string;
    }) => {
      return await completeMultipartUpload(fileId, uploadId);
    },
  });
  
  // 取消上傳的 mutation
  const abortUploadMutation = useMutation({
    mutationFn: async ({ 
      fileId, 
      uploadId 
    }: { 
      fileId: string; 
      uploadId: string;
    }) => {
      return await abortMultipartUpload(fileId, uploadId);
    },
  });
  
  // 處理上傳隊列
  const processQueue = useCallback(() => {
    // 如果隊列為空，或正在上傳的文件數已達上限，則不處理
    if (uploadQueue.current.length === 0 || activeUploads >= config.concurrentUploads) {
      return;
    }
    
    // 從隊列中取出要上傳的文件ID
    const fileId = uploadQueue.current.shift();
    if (!fileId) return;
    
    // 更新活躍上傳數
    setActiveUploads(prev => prev + 1);
    
    // 開始上傳
    startUpload(fileId);
  }, [activeUploads, config.concurrentUploads]);
  
  // 開始上傳文件
  const startUpload = useCallback(async (fileId: string) => {
    // 更新文件狀態為準備中
    setFiles(prevFiles => 
      prevFiles.map(file => {
        if (file.id === fileId) {
          return {
            ...file,
            status: UploadStatus.PREPARING,
            startTime: Date.now()
          };
        }
        return file;
      })
    );
    
    try {
      // 獲取文件信息
      const fileInfo = files.find(f => f.id === fileId);
      if (!fileInfo) {
        throw new Error('找不到檔案資訊');
      }
      
      // 初始化上傳
      const initResult = await initUploadMutation.mutateAsync(fileInfo);
      
      // 更新文件狀態為上傳中
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            return {
              ...file,
              status: UploadStatus.UPLOADING,
              uploadId: initResult.upload_id,
              bucketName: initResult.bucket,
              objectKey: initResult.key
            };
          }
          return file;
        })
      );
      
      // 開始上傳分片
      continueChunkUpload(fileId);
    } catch (error) {
      console.error('初始化上傳失敗:', error);
      
      // 更新文件狀態為錯誤
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            return {
              ...file,
              status: UploadStatus.ERROR,
              errorMessage: '初始化上傳失敗'
            };
          }
          return file;
        })
      );
      
      // 更新活躍上傳數
      setActiveUploads(prev => Math.max(0, prev - 1));
      
      // 處理下一個上傳任務
      processQueue();
    }
  }, [files, initUploadMutation]);
  
  // 繼續上傳未完成的分片
  const continueChunkUpload = useCallback(async (fileId: string) => {
    try {
      // 獲取文件信息
      const fileInfo = files.find(f => f.id === fileId);
      if (!fileInfo || !fileInfo.uploadId) {
        throw new Error('找不到檔案資訊或上傳ID');
      }
      
      // 獲取尚未上傳的分片
      const pendingChunks = fileInfo.chunks.filter(chunk => !chunk.uploaded);
      
      // 如果沒有待上傳的分片，則完成上傳
      if (pendingChunks.length === 0) {
        await completeUpload(fileId);
        return;
      }
      
      // 同時上傳多個分片 (最多3個)
      const uploadPromises = pendingChunks
        .slice(0, config.concurrentUploads)
        .map(chunk => uploadChunk(fileId, chunk));
      
      await Promise.all(uploadPromises);
      
      // 再次檢查是否還有未上傳的分片
      const currentFileInfo = files.find(f => f.id === fileId);
      if (!currentFileInfo) return;
      
      const stillPendingChunks = currentFileInfo.chunks.filter(chunk => !chunk.uploaded);
      
      if (stillPendingChunks.length === 0) {
        // 所有分片上傳完成，完成上傳
        await completeUpload(fileId);
      } else if (currentFileInfo.status === UploadStatus.UPLOADING) {
        // 還有分片需要上傳，且狀態為上傳中，繼續上傳
        continueChunkUpload(fileId);
      }
    } catch (error) {
      console.error('上傳分片失敗:', error);
      
      // 檢查文件當前狀態
      const currentFileInfo = files.find(f => f.id === fileId);
      if (!currentFileInfo) return;
      
      // 如果已暫停或出錯，不再嘗試上傳
      if (currentFileInfo.status !== UploadStatus.UPLOADING) return;
      
      // 更新文件狀態為錯誤
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            return {
              ...file,
              status: UploadStatus.ERROR,
              errorMessage: '上傳分片失敗'
            };
          }
          return file;
        })
      );
      
      // 更新活躍上傳數
      setActiveUploads(prev => Math.max(0, prev - 1));
      
      // 處理下一個上傳任務
      processQueue();
    }
  }, [files, config.concurrentUploads]);
  
  // 上傳單個分片
  const uploadChunk = useCallback(async (fileId: string, chunk: ChunkInfo) => {
    try {
      // 獲取文件信息
      const fileInfo = files.find(f => f.id === fileId);
      if (!fileInfo || !fileInfo.uploadId) {
        throw new Error('找不到檔案資訊或上傳ID');
      }
      
      // 上傳分片
      const response = await uploadPartMutation.mutateAsync({
        fileId: fileInfo.uploadId.split('/')[0], // 從uploadId中提取fileId
        uploadId: fileInfo.uploadId,
        partNumber: chunk.index,
        blob: chunk.blob
      });
      
      // 更新分片狀態
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            // 更新分片狀態
            const updatedChunks = file.chunks.map(c => {
              if (c.index === chunk.index) {
                return {
                  ...c,
                  uploaded: true,
                  etag: response.etag
                };
              }
              return c;
            });
            
            // 計算新的上傳進度
            const uploadedChunks = updatedChunks.filter(c => c.uploaded);
            const progress = (uploadedChunks.length / updatedChunks.length) * 100;
            const uploadedBytes = uploadedChunks.reduce(
              (total, c) => total + (c.endByte - c.startByte + 1), 
              0
            );
            
            return {
              ...file,
              chunks: updatedChunks,
              progress,
              uploadedBytes
            };
          }
          return file;
        })
      );
      
      return response;
    } catch (error) {
      console.error(`上傳分片 ${chunk.index} 失敗:`, error);
      
      // 更新分片重試次數
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            const updatedChunks = file.chunks.map(c => {
              if (c.index === chunk.index) {
                return {
                  ...c,
                  retries: c.retries + 1
                };
              }
              return c;
            });
            
            return {
              ...file,
              chunks: updatedChunks
            };
          }
          return file;
        })
      );
      
      // 檢查是否超過最大重試次數
      const updatedChunk = files
        .find(f => f.id === fileId)?.chunks
        .find(c => c.index === chunk.index);
      
      if (updatedChunk && updatedChunk.retries >= config.maxRetries) {
        throw new Error(`上傳分片 ${chunk.index} 失敗，已達到最大重試次數`);
      }
      
      // 延遲後重試
      await new Promise(resolve => setTimeout(resolve, 1000));
      return uploadChunk(fileId, chunk);
    }
  }, [files, uploadPartMutation, config.maxRetries]);
  
  // 完成上傳
  const completeUpload = useCallback(async (fileId: string) => {
    try {
      // 獲取文件信息
      const fileInfo = files.find(f => f.id === fileId);
      if (!fileInfo || !fileInfo.uploadId) {
        throw new Error('找不到檔案資訊或上傳ID');
      }
      
      // 完成上傳
      const response = await completeUploadMutation.mutateAsync({
        fileId: fileInfo.uploadId.split('/')[0], // 從uploadId中提取fileId
        uploadId: fileInfo.uploadId
      });
      
      // 更新文件狀態為成功
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            return {
              ...file,
              status: UploadStatus.SUCCESS,
              progress: 100,
              processingStatus: ProcessingStatus.PENDING // 上傳完成後等待處理
            };
          }
          return file;
        })
      );
      
      // 更新活躍上傳數
      setActiveUploads(prev => Math.max(0, prev - 1));
      
      // 處理下一個上傳任務
      processQueue();
      
      return response;
    } catch (error) {
      console.error('完成上傳失敗:', error);
      
      // 更新文件狀態為錯誤
      setFiles(prevFiles => 
        prevFiles.map(file => {
          if (file.id === fileId) {
            return {
              ...file,
              status: UploadStatus.ERROR,
              errorMessage: '完成上傳失敗'
            };
          }
          return file;
        })
      );
      
      // 更新活躍上傳數
      setActiveUploads(prev => Math.max(0, prev - 1));
      
      // 處理下一個上傳任務
      processQueue();
      
      throw error;
    }
  }, [files, completeUploadMutation]);
  
  // 取消上傳
  const cancelUpload = useCallback(async (fileId: string) => {
    try {
      // 獲取文件信息
      const fileInfo = files.find(f => f.id === fileId);
      if (!fileInfo) {
        throw new Error('找不到檔案資訊');
      }
      
      // 如果有上傳ID，則取消上傳
      if (fileInfo.uploadId) {
        await abortUploadMutation.mutateAsync({
          fileId: fileInfo.uploadId.split('/')[0], // 從uploadId中提取fileId
          uploadId: fileInfo.uploadId
        });
      }
      
      // 從文件列表中移除
      setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
      
      // 從上傳隊列中移除
      uploadQueue.current = uploadQueue.current.filter(id => id !== fileId);
      
      // 如果文件正在上傳，則更新活躍上傳數
      if (
        fileInfo.status === UploadStatus.UPLOADING ||
        fileInfo.status === UploadStatus.PREPARING
      ) {
        setActiveUploads(prev => Math.max(0, prev - 1));
        
        // 處理下一個上傳任務
        processQueue();
      }
    } catch (error) {
      console.error('取消上傳失敗:', error);
      throw error;
    }
  }, [files, abortUploadMutation]);
  
  // 重試上傳
  const retryUpload = useCallback((fileId: string) => {
    // 獲取文件信息
    const fileInfo = files.find(f => f.id === fileId);
    if (!fileInfo) {
      console.error('找不到檔案資訊');
      return;
    }
    
    // 重置文件狀態
    setFiles(prevFiles => 
      prevFiles.map(file => {
        if (file.id === fileId) {
          // 重置所有分片的上傳狀態
          const resetChunks = file.chunks.map(chunk => ({
            ...chunk,
            uploaded: false,
            retries: 0
          }));
          
          return {
            ...file,
            status: UploadStatus.IDLE,
            progress: 0,
            uploadedBytes: 0,
            speed: 0,
            remainingTime: 0,
            timeoutWarning: false,
            errorMessage: undefined,
            uploadId: undefined,
            chunks: resetChunks
          };
        }
        return file;
      })
    );
    
    // 將文件添加到上傳隊列
    uploadQueue.current.push(fileId);
    
    // 處理上傳隊列
    processQueue();
  }, [files]);
  
  // 暫停上傳
  const pauseUpload = useCallback((fileId: string) => {
    setFiles(prevFiles => 
      prevFiles.map(file => {
        if (file.id === fileId && file.status === UploadStatus.UPLOADING) {
          // 更新活躍上傳數
          setActiveUploads(prev => Math.max(0, prev - 1));
          
          return {
            ...file,
            status: UploadStatus.PAUSED
          };
        }
        return file;
      })
    );
    
    // 處理下一個上傳任務
    processQueue();
  }, []);
  
  // 繼續上傳
  const resumeUpload = useCallback((fileId: string) => {
    const fileInfo = files.find(f => f.id === fileId);
    if (!fileInfo || fileInfo.status !== UploadStatus.PAUSED) {
      return;
    }
    
    // 如果當前活躍上傳數已達上限，則將文件添加到隊列
    if (activeUploads >= config.concurrentUploads) {
      uploadQueue.current.push(fileId);
      return;
    }
    
    // 更新文件狀態
    setFiles(prevFiles => 
      prevFiles.map(file => {
        if (file.id === fileId) {
          return {
            ...file,
            status: UploadStatus.UPLOADING
          };
        }
        return file;
      })
    );
    
    // 更新活躍上傳數
    setActiveUploads(prev => prev + 1);
    
    // 繼續上傳
    continueChunkUpload(fileId);
  }, [files, activeUploads, config.concurrentUploads, continueChunkUpload]);
  
  // 每當活躍上傳數變化時，處理隊列
  useEffect(() => {
    if (activeUploads < config.concurrentUploads) {
      processQueue();
    }
  }, [activeUploads, config.concurrentUploads, processQueue]);
  
  return {
    files,
    addFiles,
    cancelUpload,
    retryUpload,
    pauseUpload,
    resumeUpload,
    pauseAllActiveUploads,
    resumeAllPausedUploads
  };
}; 