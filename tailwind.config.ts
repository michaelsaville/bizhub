import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // BizHub accent palette — deep teal signals "enterprise / sales-side"
        // and keeps it visually distinct from DocHub (slate) + TicketHub (amber).
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          300: '#5eead4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
