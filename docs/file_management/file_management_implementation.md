# 檔案管理功能實作說明

## 1. 功能概述

檔案管理功能是本文件分析平台的核心功能之一，允許使用者對上傳的 PDF 檔案進行管理操作，包括：

- 列出所有已上傳的檔案及其處理狀態
- 刪除檔案（同時移除資料庫記錄和實際檔案）
- 預覽檔案內容

檔案管理功能遵循產品需求文件 (PRD) 中的規格，確保檔案刪除操作的安全性和完整性，同時提供良好的使用者體驗。

## 2. 技術實現詳解

### 2.1 數據模型與類型定義

檔案相關的類型定義在 `frontend/src/types/files.ts` 中：

```typescript
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
```

這些類型定義確保了前端與後端 API 之間的數據一致性，並提供了良好的類型安全性。

### 2.2 API 服務層

檔案服務層實現在 `frontend/src/services/filesService.ts` 中，主要提供兩個核心功能：

1. **獲取檔案列表**：調用 `GET /files` API 獲取使用者的檔案列表
2. **刪除檔案**：調用 `DELETE /files/{file_uuid}` API 刪除指定檔案

API 實現專注於處理 HTTP 請求和錯誤情況，不包含業務邏輯。

### 2.3 資料管理與快取

檔案資料管理使用 TanStack Query (React Query) 實現，位於 `frontend/src/hooks/useFiles.ts`：

```typescript
// 獲取檔案列表
export function useFilesList(params: FilePaginationParams = {}) {
  return useQuery({
    queryKey: ['files', params],
    queryFn: () => filesService.getFilesList(params),
    staleTime: 1000 * 60 * 5, // 5分鐘
  });
}

// 刪除檔案
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
```

主要特點：
- 使用 `useQuery` 取得檔案列表並自動處理加載、錯誤和重試
- 使用 `useMutation` 處理檔案刪除操作
- 實現智能快取，設置 5 分鐘的快取有效期
- 當檔案刪除成功後，自動使檔案列表查詢失效，確保數據一致性

### 2.4 刪除確認機制

檔案刪除流程中的確認機制實現在 `DeleteFileDialog` 組件中：

1. **確認對話框**：在執行刪除操作前，顯示詳細的確認對話框
2. **顯示影響範圍**：明確告知使用者刪除操作將同時刪除哪些關聯數據
3. **警告提示**：強調操作不可逆性
4. **狀態顯示**：在刪除過程中顯示加載狀態
5. **錯誤處理**：如果刪除失敗，直接在對話框中顯示錯誤信息

![刪除確認對話框示意](../assets/delete_confirm_dialog.png)

### 2.5 檔案刪除流程

完整的檔案刪除流程如下：

1. 用戶點擊檔案項目上的刪除按鈕
2. 系統顯示確認對話框，包含詳細的刪除範圍說明
3. 用戶確認刪除
4. 前端發送 DELETE 請求到後端 API
5. 後端執行事務性刪除操作：
   - 刪除資料庫中的檔案記錄
   - 級聯刪除相關句子記錄
   - 級聯刪除引用記錄
   - 從 MinIO 中刪除實際的 PDF 檔案
6. 後端返回刪除結果
7. 前端顯示刪除結果通知
8. 如果成功，自動更新檔案列表顯示
9. 如果失敗，在對話框中顯示詳細的錯誤信息

## 3. 用戶界面元素

### 3.1 檔案列表

檔案列表組件 (`FilesList`) 實現了以下功能：

- 網格式顯示檔案項目
- 處理加載狀態、錯誤狀態和空數據狀態
- 整合檔案刪除流程
- 支援檔案預覽功能

### 3.2 檔案項目

檔案項目組件 (`FileItem`) 顯示豐富的檔案信息：

- 檔案名稱和大小
- 上傳時間
- 上傳和處理狀態（帶有顏色編碼的狀態標籤）
- 統計數據（總句數、概念定義數、操作定義數）
- 錯誤信息（如適用）
- 預覽和刪除按鈕

## 4. 數據一致性保障

檔案刪除操作涉及多個相關資源的刪除，包括資料庫記錄和實際檔案存儲。為確保數據一致性，系統實現了以下機制：

### 4.1 事務性刪除

後端使用資料庫事務確保刪除操作的原子性：

```sql
CREATE OR REPLACE FUNCTION delete_file_with_cleanup(file_uuid_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    bucket_name VARCHAR;
    object_key VARCHAR;
    success BOOLEAN := FALSE;
BEGIN
    -- 獲取 MinIO 信息
    SELECT minio_bucket_name, minio_object_key INTO bucket_name, object_key
    FROM files
    WHERE file_uuid = file_uuid_param;
    
    -- 記錄刪除操作
    INSERT INTO deletion_logs (file_uuid, minio_bucket_name, minio_object_key, deleted_at)
    VALUES (file_uuid_param, bucket_name, object_key, NOW());
    
    -- 刪除檔案記錄 (會通過 CASCADE 刪除相關記錄)
    DELETE FROM files WHERE file_uuid = file_uuid_param;
    
    -- 標記操作成功
    success := TRUE;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 失敗重試機制

當 MinIO 物件刪除失敗時，系統會記錄刪除日誌，並通過定期任務重試：

```sql
CREATE TABLE deletion_logs (
    log_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_uuid UUID NOT NULL,
    minio_bucket_name VARCHAR(100) NOT NULL,
    minio_object_key VARCHAR(255) NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    minio_cleanup_status VARCHAR(20) DEFAULT 'pending',
    minio_cleanup_attempts INTEGER DEFAULT 0,
    minio_cleanup_completed_at TIMESTAMPTZ
);
```

### 4.3 前端資料同步

前端使用 TanStack Query 的 `invalidateQueries` 機制確保刪除操作後自動刷新檔案列表：

```typescript
onSuccess: () => {
  // 刪除成功後，使所有檔案列表查詢無效
  queryClient.invalidateQueries({ queryKey: ['files'] });
}
```

## 5. 最佳實踐與設計考量

### 5.1 用戶體驗考量

檔案管理功能實現了以下用戶體驗最佳實踐：

1. **清晰的視覺反饋**：
   - 使用顏色編碼的狀態標籤
   - 加載和錯誤狀態的明確顯示
   - 刪除過程中的按鈕狀態變化

2. **防止意外操作**：
   - 刪除操作需二次確認
   - 確認對話框清晰說明操作的影響範圍

3. **即時反饋**：
   - 操作結果立即顯示
   - 刪除後自動更新檔案列表

### 5.2 效能考量

檔案管理功能考慮了以下效能因素：

1. **資料快取策略**：
   - 設置適當的快取時間 (5分鐘)
   - 僅在必要時刷新數據

2. **延遲加載**：
   - 檔案預覽採用按需加載方式
   - 使用 iframe 進行隔離，避免影響主頁面性能

### 5.3 安全考量

檔案刪除功能實現了以下安全措施：

1. **權限檢查**：
   - 確保用戶只能刪除自己的檔案
   - 使用 JWT 令牌進行身份驗證

2. **防止意外刪除**：
   - 詳細的確認對話框
   - 清晰描述刪除操作的後果

## 6. 未來優化方向

以下是檔案管理功能的潛在優化方向：

1. **批量操作**：實現多檔案選擇和批量刪除功能
2. **刪除撤銷**：增加臨時回收站功能，允許在一定時間內恢復已刪除檔案
3. **檔案排序和過濾**：增強檔案列表的排序和過濾功能
4. **檔案預覽增強**：增加直接在預覽中標記句子的功能
5. **上傳進度和處理進度**：更詳細的上傳和處理進度顯示 