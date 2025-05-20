import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // 基本配置
  testDir: './src/__tests__/e2e',
  timeout: 30000, // 每個測試的超時時間（毫秒）
  fullyParallel: true, // 是否併行執行測試
  forbidOnly: !!process.env.CI, // 在CI環境中禁止僅運行特定測試
  retries: process.env.CI ? 2 : 0, // 失敗重試次數（CI環境中更多）
  workers: process.env.CI ? 2 : undefined, // 在CI環境中限制工作進程數
  reporter: [
    ['html'], // 生成HTML報告
    ['list'] // 控制台輸出
  ],
  
  // 全局設置
  use: {
    // 追踪和截圖配置
    trace: 'on-first-retry', // 第一次重試時收集追踪
    screenshot: 'only-on-failure', // 僅在失敗時截圖
    
    // 基本瀏覽器配置
    baseURL: 'http://localhost:3000',
    actionTimeout: 10000, // 操作超時
    navigationTimeout: 15000, // 導航超時
    
    // 視頻記錄
    video: 'on-first-retry',
    
    // 額外環境變量
    launchOptions: {
      slowMo: process.env.CI ? 0 : 100, // 非CI環境下增加操作之間的延遲，便於調試
    }
  },
  
  // 配置不同的測試項目
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  
  // 在實際運行前註解掉自動啟動Web服務器的配置
  // 假設應用已經在另一個終端中運行
  /* webServer: {
    command: 'npm run start',
    port: 3000,
    reuseExistingServer: !process.env.CI, // 在開發環境中重用現有服務器
    timeout: 60 * 1000, // 啟動超時時間（毫秒）
  } */
};

export default config; 