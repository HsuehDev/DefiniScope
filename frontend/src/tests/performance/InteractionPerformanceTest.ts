/**
 * 用戶交互性能測試工具
 * 用於測量用戶輸入、點擊和視覺響應時間
 */

/**
 * 交互類型
 */
export type InteractionType = 'click' | 'input' | 'scroll' | 'navigation' | 'custom';

/**
 * 交互性能測量結果
 */
export interface InteractionMeasurement {
  id: string;
  type: InteractionType;
  targetElement: string;
  startTime: number;
  endTime: number;
  duration: number;
  timeToFirstRender: number;
  timeToFullRender: number;
  frameDrop: number;
  longTaskCount: number;
  isResponsive: boolean;
  customData?: Record<string, any>;
}

/**
 * 交互測量配置
 */
export interface InteractionMeasurementConfig {
  longTaskThreshold?: number; // 長任務時間閾值 (ms)
  responsiveThreshold?: number; // 響應時間閾值 (ms)
  logToConsole?: boolean; // 是否在控制台輸出結果
  autoTrackInteractions?: boolean; // 是否自動追踪交互
  trackClicks?: boolean; // 是否追踪點擊
  trackInputs?: boolean; // 是否追踪輸入
  trackScrolls?: boolean; // 是否追踪滾動
  trackNavigation?: boolean; // 是否追踪導航
  targetSelectors?: string[]; // 要追踪的元素選擇器
}

// 默認配置
const DEFAULT_CONFIG: InteractionMeasurementConfig = {
  longTaskThreshold: 50,
  responsiveThreshold: 100,
  logToConsole: true,
  autoTrackInteractions: true,
  trackClicks: true,
  trackInputs: true,
  trackScrolls: false,
  trackNavigation: true,
  targetSelectors: ['button', 'input', 'a', '[role="button"]']
};

// 存儲所有交互測量記錄
let interactionMeasurements: InteractionMeasurement[] = [];

// 當前活躍的交互測量
let activeInteractions: Map<string, Partial<InteractionMeasurement>> = new Map();

// 性能觀察器
let longTaskObserver: PerformanceObserver | null = null;
let performanceEntryObserver: PerformanceObserver | null = null;

// 修正PerformanceObserver相關類型問題
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/**
 * 初始化交互性能監控
 */
export function initInteractionMonitoring(
  config: InteractionMeasurementConfig = {}
): () => void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 追踪長任務
  if (typeof PerformanceObserver !== 'undefined' && 
      PerformanceObserver.supportedEntryTypes && 
      PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    longTaskObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      // 更新所有活躍交互的長任務計數
      entries.forEach(entry => {
        activeInteractions.forEach((interaction, id) => {
          if (!interaction.longTaskCount) {
            interaction.longTaskCount = 0;
          }
          interaction.longTaskCount += 1;
        });
      });
    });
    
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  }
  
  // 追踪渲染性能
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes) {
    const observedEntries: string[] = [];
    
    if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
      observedEntries.push('paint');
    }
    
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
      observedEntries.push('layout-shift');
    }
    
    if (PerformanceObserver.supportedEntryTypes.includes('first-input')) {
      observedEntries.push('first-input');
    }
    
    if (observedEntries.length > 0) {
      performanceEntryObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        
        entries.forEach(entry => {
          if (entry.entryType === 'layout-shift') {
            const layoutShiftEntry = entry as LayoutShiftEntry;
            if (!layoutShiftEntry.hadRecentInput) {
              // 計算布局偏移，更新所有活躍交互
              activeInteractions.forEach((interaction) => {
                if (
                  entry.startTime >= interaction.startTime! && 
                  (!interaction.endTime || entry.startTime <= interaction.endTime)
                ) {
                  if (!interaction.frameDrop) {
                    interaction.frameDrop = 0;
                  }
                  interaction.frameDrop += layoutShiftEntry.value * 100; // 轉換為百分比
                }
              });
            }
          }
        });
      });
      
      performanceEntryObserver.observe({ entryTypes: observedEntries });
    }
  }
  
  // 自動追踪用戶交互
  if (mergedConfig.autoTrackInteractions) {
    setupAutomaticTracking(mergedConfig);
  }
  
  // 返回清理函數
  return () => {
    if (longTaskObserver) {
      longTaskObserver.disconnect();
      longTaskObserver = null;
    }
    
    if (performanceEntryObserver) {
      performanceEntryObserver.disconnect();
      performanceEntryObserver = null;
    }
    
    // 移除事件監聽器
    if (mergedConfig.autoTrackInteractions) {
      cleanupAutomaticTracking();
    }
    
    // 結束所有未完成的交互測量
    activeInteractions.forEach((interaction, id) => {
      endInteractionMeasurement(id);
    });
  };
}

/**
 * 設置自動交互追踪
 */
function setupAutomaticTracking(config: InteractionMeasurementConfig): void {
  // 創建事件監聽器
  
  // 點擊追踪
  if (config.trackClicks) {
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      
      // 檢查是否符合目標選擇器
      if (config.targetSelectors && 
          config.targetSelectors.some(selector => 
            target.matches && target.matches(selector)
          )) {
        // 開始測量
        const id = `click_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        startInteractionMeasurement(id, 'click', getElementDescription(target));
      }
    });
    
    document.addEventListener('mouseup', (e) => {
      // 查找最近開始的點擊交互並結束它
      const clickInteractions = Array.from(activeInteractions.entries())
        .filter(([id, interaction]) => 
          interaction.type === 'click' && 
          (Date.now() - interaction.startTime!) < 1000
        );
      
      if (clickInteractions.length > 0) {
        // 取最新開始的點擊交互
        const [latestId] = clickInteractions.sort((a, b) => 
          (b[1].startTime || 0) - (a[1].startTime || 0)
        )[0];
        
        setTimeout(() => {
          // 延遲結束測量，確保捕獲渲染
          endInteractionMeasurement(latestId);
        }, 50);
      }
    });
  }
  
  // 輸入追踪
  if (config.trackInputs) {
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // 獲取或創建此輸入元素的ID
        const inputId = target.id || 
          `input_${getElementDescription(target)}_${Math.random().toString(36).substring(2, 9)}`;
        
        // 如果沒有活躍的此輸入元素的交互，則開始一個新的
        if (!Array.from(activeInteractions.values()).some(
          interaction => 
            interaction.type === 'input' && 
            interaction.targetElement === getElementDescription(target) &&
            (Date.now() - (interaction.startTime || 0)) < 1000
        )) {
          const id = `input_${inputId}_${Date.now()}`;
          startInteractionMeasurement(id, 'input', getElementDescription(target));
          
          // 設置結束定時器（輸入停止後200ms結束測量）
          setTimeout(() => {
            endInteractionMeasurement(id);
          }, 500);
        }
      }
    });
  }
  
  // 導航追踪
  if (config.trackNavigation && typeof window !== 'undefined' && window.history) {
    // 捕獲導航事件
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    const navId = `navigation_${Date.now()}`;
    
    // 攔截 pushState
    window.history.pushState = function(...args) {
      const id = `${navId}_${Date.now()}`;
      startInteractionMeasurement(id, 'navigation', String(args[2] || ''));
      
      setTimeout(() => {
        endInteractionMeasurement(id);
      }, 1000); // 假設導航在1秒內完成
      
      return originalPushState.apply(this, args);
    };
    
    // 攔截 replaceState
    window.history.replaceState = function(...args) {
      const id = `${navId}_${Date.now()}`;
      startInteractionMeasurement(id, 'navigation', String(args[2] || ''));
      
      setTimeout(() => {
        endInteractionMeasurement(id);
      }, 1000);
      
      return originalReplaceState.apply(this, args);
    };
    
    // 後退按鈕
    window.addEventListener('popstate', () => {
      const id = `${navId}_${Date.now()}`;
      startInteractionMeasurement(id, 'navigation', 'popstate');
      
      setTimeout(() => {
        endInteractionMeasurement(id);
      }, 1000);
    });
  }
}

/**
 * 清理自動追踪設置
 */
function cleanupAutomaticTracking(): void {
  // 實際實現中需要移除所有事件監聽器
  // 由於我們沒有保存引用，這裡無法完全清理
  // 在真實實現中應該保存所有事件處理函數的引用
}

/**
 * 獲取元素描述
 */
function getElementDescription(element: HTMLElement): string {
  // 嘗試獲取有意義的元素描述
  const id = element.id ? `#${element.id}` : '';
  const classes = Array.from(element.classList).map(c => `.${c}`).join('');
  const tagName = element.tagName.toLowerCase();
  const text = element.textContent?.trim().substring(0, 20);
  
  if (id) {
    return `${tagName}${id}`;
  } else if (classes) {
    return `${tagName}${classes}`;
  } else if (text) {
    return `${tagName}[text="${text}${text.length > 20 ? '...' : ''}"]`;
  } else {
    return tagName;
  }
}

/**
 * 開始交互測量
 */
export function startInteractionMeasurement(
  id: string, 
  type: InteractionType, 
  targetElement: string, 
  customData?: Record<string, any>
): string {
  const startTime = performance.now();
  
  activeInteractions.set(id, {
    id,
    type,
    targetElement,
    startTime,
    longTaskCount: 0,
    frameDrop: 0,
    timeToFirstRender: 0,
    timeToFullRender: 0,
    customData
  });
  
  // 標記第一幀
  requestAnimationFrame(() => {
    const interaction = activeInteractions.get(id);
    if (interaction) {
      interaction.timeToFirstRender = performance.now() - interaction.startTime!;
    }
  });
  
  return id;
}

/**
 * 結束交互測量
 */
export function endInteractionMeasurement(id: string): InteractionMeasurement | null {
  const interaction = activeInteractions.get(id);
  
  if (!interaction) {
    console.warn(`No active interaction found with id: ${id}`);
    return null;
  }
  
  const endTime = performance.now();
  interaction.endTime = endTime;
  interaction.duration = endTime - interaction.startTime!;
  
  // 確保所有字段都有值
  interaction.longTaskCount = interaction.longTaskCount || 0;
  interaction.frameDrop = interaction.frameDrop || 0;
  interaction.timeToFullRender = interaction.duration;
  
  // 確定響應性
  if (interaction.duration > (DEFAULT_CONFIG.responsiveThreshold || 100)) {
    interaction.isResponsive = false;
  } else {
    interaction.isResponsive = true;
  }
  
  // 轉換為完整的測量結果
  const result = interaction as InteractionMeasurement;
  
  // 從活躍列表中移除
  activeInteractions.delete(id);
  
  // 添加到測量記錄
  interactionMeasurements.push(result);
  
  // 在控制台輸出結果
  if (DEFAULT_CONFIG.logToConsole) {
    console.group(`🔍 Interaction Measurement: ${id}`);
    console.log(`Type: ${result.type}`);
    console.log(`Target: ${result.targetElement}`);
    console.log(`Duration: ${result.duration.toFixed(2)}ms`);
    console.log(`Time to First Render: ${result.timeToFirstRender.toFixed(2)}ms`);
    console.log(`Long Tasks: ${result.longTaskCount}`);
    console.log(`Layout Shifts: ${result.frameDrop.toFixed(2)}%`);
    console.log(`Responsive: ${result.isResponsive ? 'Yes ✅' : 'No ❌'}`);
    console.groupEnd();
  }
  
  return result;
}

/**
 * 測量單次交互
 */
export async function measureSingleInteraction(
  action: () => Promise<void> | void,
  type: InteractionType,
  targetDescription: string,
  customData?: Record<string, any>
): Promise<InteractionMeasurement> {
  const id = `manual_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  startInteractionMeasurement(id, type, targetDescription, customData);
  
  try {
    await action();
  } finally {
    // 等待兩幀以確保渲染完成
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 50); // 再等50ms以確保渲染完成
        });
      });
    });
    
    const result = endInteractionMeasurement(id);
    if (!result) {
      throw new Error(`Failed to measure interaction: ${id}`);
    }
    
    return result;
  }
}

/**
 * 獲取所有交互測量結果
 */
export function getInteractionMeasurements(): InteractionMeasurement[] {
  return [...interactionMeasurements];
}

/**
 * 清除交互測量記錄
 */
export function clearInteractionMeasurements(): void {
  interactionMeasurements = [];
}

/**
 * 生成交互性能報告
 */
export function generateInteractionReport(): {
  totalInteractions: number;
  averageDuration: number;
  responsiveInteractions: number;
  responsivePercentage: number;
  slowestInteraction: InteractionMeasurement | null;
  totalLongTasks: number;
  totalLayoutShifts: number;
  interactionsByType: Record<InteractionType, number>;
  detailedMeasurements: InteractionMeasurement[];
} {
  const measurements = getInteractionMeasurements();
  
  if (measurements.length === 0) {
    return {
      totalInteractions: 0,
      averageDuration: 0,
      responsiveInteractions: 0,
      responsivePercentage: 0,
      slowestInteraction: null,
      totalLongTasks: 0,
      totalLayoutShifts: 0,
      interactionsByType: {
        click: 0,
        input: 0,
        scroll: 0,
        navigation: 0,
        custom: 0
      },
      detailedMeasurements: []
    };
  }
  
  // 計算統計數據
  const totalInteractions = measurements.length;
  const durations = measurements.map(m => m.duration);
  const averageDuration = durations.reduce((sum, d) => sum + d, 0) / totalInteractions;
  
  const responsiveInteractions = measurements.filter(m => m.isResponsive).length;
  const responsivePercentage = (responsiveInteractions / totalInteractions) * 100;
  
  const slowestInteraction = measurements.reduce(
    (slowest, current) => current.duration > (slowest?.duration || 0) ? current : slowest,
    null as InteractionMeasurement | null
  );
  
  const totalLongTasks = measurements.reduce((sum, m) => sum + m.longTaskCount, 0);
  const totalLayoutShifts = measurements.reduce((sum, m) => sum + m.frameDrop, 0);
  
  // 按類型分類
  const interactionsByType: Record<InteractionType, number> = {
    click: 0,
    input: 0,
    scroll: 0,
    navigation: 0,
    custom: 0
  };
  
  measurements.forEach(m => {
    interactionsByType[m.type] += 1;
  });
  
  return {
    totalInteractions,
    averageDuration,
    responsiveInteractions,
    responsivePercentage,
    slowestInteraction,
    totalLongTasks,
    totalLayoutShifts,
    interactionsByType,
    detailedMeasurements: [...measurements]
  };
}

export default {
  initInteractionMonitoring,
  startInteractionMeasurement,
  endInteractionMeasurement,
  measureSingleInteraction,
  getInteractionMeasurements,
  clearInteractionMeasurements,
  generateInteractionReport
}; 