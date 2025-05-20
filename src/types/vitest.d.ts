import { Assertion, AsymmetricMatchersContaining } from 'vitest';

// 擴展Vitest斷言接口，添加React Testing Library的自定義匹配器
interface CustomMatchers<R = unknown> {
  // DOM節點可見性和存在
  toBeInTheDocument(): R;
  toBeVisible(): R;
  toBeEmpty(): R;

  // 類和樣式
  toHaveClass(className: string | string[], options?: { exact?: boolean }): R;
  toHaveStyle(css: string | Record<string, unknown>): R;

  // 屬性
  toHaveAttribute(attr: string, value?: string): R;
  toHaveValue(value?: string | string[] | number): R;
  toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;

  // 表單元素
  toBeChecked(): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toBeRequired(): R;
  toBeValid(): R;
  toBeInvalid(): R;

  // 焦點
  toHaveFocus(): R;

  // 文本內容
  toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace?: boolean }): R;
  toHaveFormValues(expectedValues: Record<string, unknown>): R;

  // 其他
  toBePartiallyChecked(): R;
  toBeEmptyDOMElement(): R;
  toContainElement(element: HTMLElement | null): R;
  toContainHTML(htmlText: string): R;
}

// 擴展Vitest的Assertion接口
declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
} 