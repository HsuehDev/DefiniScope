/**
 * 互動式句子引用功能測試的模擬數據
 * 包含各種測試場景需要的引用數據、上下文數據和聊天消息
 */

// 基本引用數據
export const mockReferences = {
  // 基本引用 - 概念型定義 (CD)
  basicCd: {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174000',
    file_uuid: '123e4567-e89b-12d3-a456-426614174001',
    original_name: 'concept-definitions.pdf',
    sentence: '自適應專業知識定義為一種高度靈活的專業知識形態。',
    page: 5,
    defining_type: 'cd'
  },
  
  // 基本引用 - 操作型定義 (OD)
  basicOd: {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174002',
    file_uuid: '123e4567-e89b-12d3-a456-426614174001',
    original_name: 'concept-definitions.pdf',
    sentence: '測量自適應專業知識的方法包含三個維度：靈活性、關聯性和應用性。',
    page: 7,
    defining_type: 'od'
  },
  
  // 長句子引用
  longSentence: {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174003',
    file_uuid: '123e4567-e89b-12d3-a456-426614174004',
    original_name: 'long-text-example.pdf',
    sentence: '複雜適應性系統理論指出，在不確定性高的環境中，系統需要具備自我調整、自我學習和演化的能力，這些能力共同構成了系統的適應性智能，而這種適應性智能是系統在動態複雜環境中維持穩定與發展的關鍵因素，尤其是當環境條件發生重大變化時，這種適應性智能能夠幫助系統快速反應並找到新的平衡狀態。',
    page: 12,
    defining_type: 'cd'
  },
  
  // 包含HTML特殊字符的引用
  htmlChars: {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174005',
    file_uuid: '123e4567-e89b-12d3-a456-426614174006',
    original_name: 'special-chars.pdf',
    sentence: '研究框架中的變量定義如下：X<sub>1</sub> = 自我效能感，X<sub>2</sub> = 適應力，Y = 學業表現。',
    page: 3,
    defining_type: 'od'
  },
  
  // 不同文件的引用
  differentFile: {
    sentence_uuid: '123e4567-e89b-12d3-a456-426614174007',
    file_uuid: '123e4567-e89b-12d3-a456-426614174008',
    original_name: 'another-research.pdf',
    sentence: '研究結果表明，社會支持與心理健康存在顯著正相關。',
    page: 21,
    defining_type: 'cd'
  }
};

// 模擬上下文數據
export const mockContexts = {
  // 標準上下文
  standard: {
    beforeContext: [
      '本研究探討了專業知識在不同領域的適用性。',
      '專業知識的靈活應用對於專家表現至關重要。'
    ],
    afterContext: [
      '這種形態允許知識在不同情境間轉換和應用。',
      '研究表明，高適應性的專業人士更容易應對變化。'
    ],
    isLoading: false
  },
  
  // 載入中狀態
  loading: {
    beforeContext: [],
    afterContext: [],
    isLoading: true
  },
  
  // 無上下文
  empty: {
    beforeContext: [],
    afterContext: [],
    isLoading: false
  },
  
  // 單側上下文（只有前文）
  onlyBefore: {
    beforeContext: [
      '專業知識的發展經歷多個階段。',
      '初學者往往擁有僵化的知識結構。',
      '隨著經驗積累，知識結構開始變得靈活。'
    ],
    afterContext: [],
    isLoading: false
  },
  
  // 單側上下文（只有後文）
  onlyAfter: {
    beforeContext: [],
    afterContext: [
      '適應性專業知識的獲取需要多元化的學習經驗。',
      '情境學習是發展這類知識的有效方法。',
      '專家通常能夠靈活運用知識解決新問題。'
    ],
    isLoading: false
  }
};

// 模擬聊天消息
export const mockMessages = {
  // 包含單一引用的消息
  singleReference: {
    messageId: 'msg-123',
    role: 'assistant',
    content: '根據研究資料，自適應專業知識定義為一種高度靈活的專業知識形態。這種知識形態允許專業人士在不同情境中靈活應用其專業知能。',
    references: [mockReferences.basicCd],
    timestamp: new Date().toISOString()
  },
  
  // 包含多個引用的消息
  multipleReferences: {
    messageId: 'msg-124',
    role: 'assistant',
    content: '自適應專業知識定義為一種高度靈活的專業知識形態。關於這種知識的測量方法，研究指出包含三個維度：靈活性、關聯性和應用性。這些維度共同構成了評估專業知識適應性的框架。',
    references: [
      mockReferences.basicCd,
      mockReferences.basicOd,
      mockReferences.longSentence
    ],
    timestamp: new Date().toISOString()
  },
  
  // 包含特殊引用的消息
  specialReference: {
    messageId: 'msg-125',
    role: 'assistant',
    content: '研究框架採用多種變量進行測量，研究框架中的變量定義如下：X₁ = 自我效能感，X₂ = 適應力，Y = 學業表現。這些變量間的關係模型為基礎構建了研究假設。',
    references: [mockReferences.htmlChars],
    timestamp: new Date().toISOString()
  },
  
  // 無引用的消息
  noReference: {
    messageId: 'msg-126',
    role: 'assistant',
    content: '這是一個沒有包含任何引用的回答，僅用於測試正常消息顯示。',
    references: [],
    timestamp: new Date().toISOString()
  }
};

// 模擬PDF文件相關數據
export const mockPdfData = {
  // 模擬PDF狀態
  viewerState: {
    isOpen: true,
    fileUuid: '123e4567-e89b-12d3-a456-426614174001',
    pageNumber: 5,
    totalPages: 25,
    highlightedSentenceUuid: '123e4567-e89b-12d3-a456-426614174000',
    fileName: 'concept-definitions.pdf'
  },
  
  // 模擬PDF文件URL
  fileUrls: {
    'concept-definitions.pdf': 'http://localhost:8000/files/123e4567-e89b-12d3-a456-426614174001/preview',
    'long-text-example.pdf': 'http://localhost:8000/files/123e4567-e89b-12d3-a456-426614174004/preview',
    'special-chars.pdf': 'http://localhost:8000/files/123e4567-e89b-12d3-a456-426614174006/preview',
    'another-research.pdf': 'http://localhost:8000/files/123e4567-e89b-12d3-a456-426614174008/preview'
  },
  
  // 模擬PDF加載錯誤
  errors: {
    notFound: {
      status: 404,
      message: '找不到請求的PDF文件'
    },
    loadError: {
      status: 500,
      message: '載入PDF文件時發生錯誤'
    },
    unauthorized: {
      status: 401,
      message: '未授權訪問此PDF文件'
    }
  }
};

// 測試輔助函數
export const testHelpers = {
  // 模擬引用點擊事件
  simulateReferenceClick: (reference) => {
    return {
      reference,
      event: {
        preventDefault: () => {},
        stopPropagation: () => {}
      }
    };
  },
  
  // 生成隨機引用數據
  generateRandomReference: () => {
    const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    return {
      sentence_uuid: uuid(),
      file_uuid: uuid(),
      original_name: `generated-${Math.floor(Math.random() * 1000)}.pdf`,
      sentence: `這是隨機生成的測試句子 ${Math.floor(Math.random() * 1000)}。`,
      page: Math.floor(Math.random() * 50) + 1,
      defining_type: Math.random() > 0.5 ? 'cd' : 'od'
    };
  },
  
  // 生成包含N個引用的消息
  generateMessageWithReferences: (count) => {
    const references = Array(count).fill(0).map(() => testHelpers.generateRandomReference());
    return {
      messageId: `msg-${Math.floor(Math.random() * 10000)}`,
      role: 'assistant',
      content: `這是一個包含${count}個引用的測試消息。`,
      references,
      timestamp: new Date().toISOString()
    };
  }
}; 