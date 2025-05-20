// 全局類型定義文件
import '@testing-library/jest-dom';

// 避免TS對SVG導入提示錯誤
declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.SFC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

// 為媒體查詢匹配器擴展Window接口
interface MediaQueryList {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  addListener(listener: MediaQueryListener): void;
  removeListener(listener: MediaQueryListener): void;
  matches: boolean;
  media: string;
  onchange: (ev: MediaQueryListEvent) => void;
}

interface MediaQueryListener {
  (evt: MediaQueryListEvent): void;
}

// 確保全局錯誤處理函數類型正確
interface Window {
  __TEST_ENV__?: boolean;
} 