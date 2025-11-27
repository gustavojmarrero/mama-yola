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
        // Sombras suaves básicas
        'soft-sm': '0 1px 3px rgba(0,0,0,0.04)',
        'soft-md': '0 4px 12px rgba(0,0,0,0.06)',
        'soft-lg': '0 8px 24px rgba(0,0,0,0.08)',
        'soft-xl': '0 12px 32px rgba(0,0,0,0.10)',
        // Sombras premium para cards
        'card': '0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 12px -2px rgba(0,0,0,0.08), 0 8px 24px -4px rgba(0,0,0,0.08)',
        'card-elevated': '0 4px 16px -4px rgba(139,123,184,0.15)',
        // Sombras para botones
        'btn-primary': '0 4px 14px -3px rgba(139,123,184,0.5)',
        'btn-primary-hover': '0 6px 20px -3px rgba(139,123,184,0.6)',
        'btn-danger': '0 4px 14px -3px rgba(239,68,68,0.4)',
        // Sombra interna para inputs focus
        'input-focus': '0 0 0 4px rgba(139,123,184,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
}
