/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Red taken from the school logo
        brand: { 50: '#fdeeee', 100: '#fad9da', 200: '#f3b3b5', 500: '#d8232a', 600: '#c81e25', 700: '#a5171d', 900: '#4a0b0e' },
        // Deep navy for text and structure; greys are tinted toward it
        ink: { 900: '#0e2238', 800: '#16314f', 700: '#33465c', 500: '#5b6a7c', 300: '#b8c1cc', 200: '#dce1e8', 100: '#edf0f4', 50: '#f5f7fa' },
        navy: { 900: '#0e2238', 800: '#16314f', 700: '#1f4166' },
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Newsreader Variable"', 'Georgia', 'Cambria', 'serif'],
      },
      borderRadius: { DEFAULT: '6px', md: '6px', lg: '8px', xl: '12px' },
    },
  },
  plugins: [],
};
