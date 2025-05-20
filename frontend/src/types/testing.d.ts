import '@testing-library/jest-dom';

declare global {
  namespace Vi {
    interface JestAssertion {
      toBeInTheDocument(): void;
      toBeDisabled(): void;
      toBeEnabled(): void;
      toBeEmpty(): void;
      toBeEmptyDOMElement(): void;
      toBeInvalid(): void;
      toBeRequired(): void;
      toBeValid(): void;
      toBeVisible(): void;
      toContainElement(element: HTMLElement | null): void;
      toContainHTML(html: string): void;
      toHaveAttribute(attr: string, value?: string): void;
      toHaveClass(...classNames: string[]): void;
      toHaveFocus(): void;
      toHaveFormValues(expectedValues: Record<string, any>): void;
      toHaveStyle(css: string | Record<string, any>): void;
      toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void;
      toHaveValue(value?: string | string[] | number): void;
      toBeChecked(): void;
      toBePartiallyChecked(): void;
      toHaveDescription(text?: string | RegExp): void;
    }
  }
} 