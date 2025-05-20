module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    '@typescript-eslint',
    'vitest'
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // 基本規則
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    
    // React規則
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    
    // Vitest規則
    'vitest/expect-expect': 'warn',
    'vitest/no-disabled-tests': 'warn',
    'vitest/no-focused-tests': 'error',
    'vitest/no-identical-title': 'error',
  },
  overrides: [
    {
      // 測試文件的特殊規則
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        'vitest/globals': true,
      },
      rules: {
        // 測試文件中允許更寬鬆的規則
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
}; 