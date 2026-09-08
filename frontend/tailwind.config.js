/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Palette Talkio : vert #0CAE36 (primaire) + menthe #63E6BE (accent)
        brand: {
          50: '#e7fbef',
          100: '#c3f5da',
          200: '#8fecc3',
          300: '#63e6be',
          400: '#25cc76',
          500: '#12b84a',
          600: '#0cae36',
          700: '#0a8c2c',
          800: '#0c6d27',
          900: '#0b4c21',
        },
        mint: '#63e6be',
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '26px',
      },
      boxShadow: {
        'elevation-1': '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)',
        'elevation-2': '0 4px 8px -2px rgba(16,24,40,.10), 0 2px 4px -2px rgba(16,24,40,.06)',
        'elevation-3': '0 12px 24px -6px rgba(16,24,40,.12), 0 4px 8px -4px rgba(16,24,40,.08)',
      },
    },
  },
  plugins: [],
};
