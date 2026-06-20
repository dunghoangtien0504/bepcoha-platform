/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f46e5',
          dark: '#4338ca',
          light: '#eef2ff',
        },
      },
    },
  },
  plugins: [],
};
