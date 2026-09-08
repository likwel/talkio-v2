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
      // Echelle typographique unique (taille / interlignage). Sert de reference a
      // tout le projet : plus de tailles arbitraires `text-[13px]` etc.
      fontSize: {
        '2xs': ['12px', '16px'], // micro-meta : heures, compteurs
        xs: ['13px', '18px'], // meta secondaire, chips, labels
        sm: ['14px', '20px'], // texte UI par defaut (boutons, listes, nav, inputs)
        base: ['15px', '23px'], // corps de texte, messages
        md: ['16px', '24px'], // item accentue, sous-titre
        lg: ['18px', '26px'], // titres de modale / sous-sections
        xl: ['22px', '30px'], // titre de page (mobile)
        '2xl': ['26px', '34px'], // titre de page (desktop) / hero
        '3xl': ['32px', '38px'],
        '4xl': ['38px', '42px'],
      },
      colors: {
        // Palette Talkio : bleu Telegram #3390EC (primaire) + violet #8774E1 (accent secondaire)
        brand: {
          50: '#eaf3fd',
          100: '#d1e6fb',
          200: '#a7cef6',
          300: '#6fb0f0',
          400: '#3390ec',
          500: '#2f86dc',
          600: '#2b7cd4',
          700: '#2265b0',
          800: '#1d5390',
          900: '#1a4676',
        },
        mint: '#8774e1',
      },
      maxWidth: {
        '8xl': '90rem',
        '9xl': '100rem',
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
