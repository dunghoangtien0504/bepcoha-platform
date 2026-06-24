/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#d97706',
          dark: '#b45309',
          light: '#fffbeb',
        },
      },
    },
  },
  plugins: [],
};
