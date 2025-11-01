/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'Inter', 'sans-serif'],
      },
      colors: {
        // TailAdmin Primary Colors
        primary: {
          DEFAULT: '#3C50E0',
          50: '#EEF0FF',
          100: '#E0E4FF',
          200: '#C7CDFF',
          300: '#A5AEFF',
          400: '#8188FF',
          500: '#3C50E0',
          600: '#3744D0',
          700: '#2E37A4',
          800: '#252E83',
          900: '#1C2434',
        },
        // TailAdmin Status Colors
        success: {
          DEFAULT: '#219653',
          light: '#DEF7EC',
          dark: '#03543F',
        },
        warning: {
          DEFAULT: '#FFA70B',
          light: '#FDF6B2',
          dark: '#723B13',
        },
        danger: {
          DEFAULT: '#D34053',
          light: '#FDE8E8',
          dark: '#9B1C1C',
        },
        // TailAdmin Neutral Colors
        dark: {
          DEFAULT: '#1C2434',
          2: '#1A222C',
          3: '#313D4A',
          4: '#24303F',
          5: '#2E3A47',
          6: '#475569',
          7: '#64748B',
        },
        gray: {
          DEFAULT: '#EFF4FB',
          2: '#F7F9FC',
          3: '#E2E8F0',
          dark: '#1A222C',
        },
        stroke: {
          DEFAULT: '#E2E8F0',
          dark: '#2E3A47',
        },
        body: {
          DEFAULT: '#64748B',
          dark: '#AEB7C0',
        },
        // Broadcast-Specific Colors (preserved)
        broadcast: {
          live: '#ef4444',
          queue: '#f59e0b',
          screening: '#3b82f6',
        }
      },
      boxShadow: {
        'default': '0px 8px 13px -3px rgba(0, 0, 0, 0.07)',
        'card': '0px 1px 3px rgba(0, 0, 0, 0.12)',
        'card-2': '0px 1px 2px rgba(0, 0, 0, 0.05)',
        '1': '0px 1px 3px 0px rgba(0, 0, 0, 0.08)',
        '2': '0px 1px 4px 0px rgba(0, 0, 0, 0.12)',
        '3': '0px 0px 4px 0px rgba(0, 0, 0, 0.08)',
        '4': '0px 2px 10px 0px rgba(0, 0, 0, 0.08)',
        '5': '0px 0px 15px 0px rgba(0, 0, 0, 0.10)',
        '6': '0px 0px 30px 0px rgba(0, 0, 0, 0.08)',
        '7': '0px 0px 50px 0px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        '10': '10px',
        '7': '7px',
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '7.5': '1.875rem',
        '8.5': '2.125rem',
        '10.5': '2.625rem',
        '11.5': '2.875rem',
        '12.5': '3.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '17.5': '4.375rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '25': '6.25rem',
        '30': '7.5rem',
        '35': '8.75rem',
        '37.5': '9.375rem',
        '50': '12.5rem',
        '67.5': '16.875rem',
        '142.5': '35.625rem',
        '180': '45rem',
        '192.5': '48.125rem',
      },
      maxWidth: {
        '142.5': '35.625rem',
        '180': '45rem',
        '192.5': '48.125rem',
      },
      zIndex: {
        '999': '999',
        '9999': '9999',
      },
    },
  },
  plugins: [],
}

