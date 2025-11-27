/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Paleta Lavanda - Color Principal
        lavender: {
          50: '#F8F7FC',
          100: '#EFEDF8',
          200: '#DCD8F0',
          300: '#C4BCE6',
          400: '#A89BD8',
          500: '#8B7BB8',
          600: '#7565A3',
          700: '#5F4F8E',
          800: '#493B6E',
          900: '#362A50',
        },
        // Neutros Cálidos
        warm: {
          50: '#FAFAF9',
          100: '#F5F4F2',
          200: '#E8E6E3',
          300: '#D4D1CC',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        // Estados
        success: {
          light: '#ECFDF5',
          DEFAULT: '#10B981',
          dark: '#059669',
        },
        warning: {
          light: '#FFFBEB',
          DEFAULT: '#F59E0B',
          dark: '#D97706',
        },
        error: {
          light: '#FEF2F2',
          DEFAULT: '#EF4444',
          dark: '#DC2626',
        },
        info: {
          light: '#EFF6FF',
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
        },
        // Mantener primary como alias de lavender para compatibilidad
        primary: {
          50: '#F8F7FC',
          100: '#EFEDF8',
          200: '#DCD8F0',
          300: '#C4BCE6',
          400: '#A89BD8',
          500: '#8B7BB8',
          600: '#7565A3',
          700: '#5F4F8E',
          800: '#493B6E',
          900: '#362A50',
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(0,0,0,0.04)',
        'soft-md': '0 4px 12px rgba(0,0,0,0.06)',
        'soft-lg': '0 8px 24px rgba(0,0,0,0.08)',
        'soft-xl': '0 12px 32px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
