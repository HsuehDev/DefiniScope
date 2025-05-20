/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'tech': {
            100: '#f0f4f8',
            200: '#d9e2ec',
            500: '#5a7fa4',
            600: '#4a6990',
            700: '#3a5a80',
            800: '#2d4a70',
            900: '#1e3a5f',
            950: '#152d4a',
        }
      },
      boxShadow: {
        'tech': '0 4px 10px -2px rgba(58, 90, 128, 0.1)',
        'tech-lg': '0 10px 20px -5px rgba(58, 90, 128, 0.2)',
      }
    },
  },
  plugins: [],
  safelist: [
    'bg-tech-100',
    'bg-tech-200',
    'bg-tech-500',
    'bg-tech-600',
    'bg-tech-700',
    'bg-tech-800',
    'bg-tech-900',
    'bg-tech-950',
    'text-tech-100',
    'text-tech-200',
    'text-tech-500',
    'text-tech-600',
    'text-tech-700',
    'text-tech-800',
    'text-tech-900',
    'text-tech-950',
    'border-tech-500',
    'border-tech-700',
    'shadow-tech',
    'shadow-tech-lg',
  ],
} 