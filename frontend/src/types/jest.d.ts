// 在測試環境中提供全局jest對象
declare const jest: {
  fn: () => {
    mockImplementation: <T, R>(implementation: (token: T) => R) => (token: T) => R;
  };
}; 