/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Courier New', 'monospace'],
      },
      colors: {
        brand: {
          orange: '#E8613A',
          'orange-hover': '#D4562F',
          dark: '#0F0F0F',
          grid: '#1A1A1A',
        },
        cream: '#F5F0E8',
        ink: '#1A1A1A',
      },
    },
  },
  plugins: [],
};
