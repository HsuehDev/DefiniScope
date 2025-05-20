import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setupTests.ts'],
    include: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.{js,ts}'
      ]
    },
    testTimeout: 20000, // 20秒
    hookTimeout: 10000,  // 10秒
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}); 