/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#03224d',
        'primary-container': '#1f3864',
        secondary: '#006972',
        'secondary-container': '#96eef9',
        'on-secondary-container': '#006d77',
        'on-secondary': '#ffffff',
        tertiary: '#1b2336',
        'surface': '#f8f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#44474f',
        'on-primary': '#ffffff',
        'secondary-fixed': '#98f0fb',
        'tertiary-container': '#30384d',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        outline: '#747780',
        'outline-variant': '#c4c6d0',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 8px rgba(0,0,0,.04)',
        elevated: '0 20px 25px -5px rgba(15,23,42,.12), 0 8px 10px -6px rgba(15,23,42,.06)',
      },
      borderRadius: { '2xl': '0.75rem' },
    },
  },
  plugins: [],
};
