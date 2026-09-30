/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        secondary: '#64748B',
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#0F172A',
        muted: '#94A3B8',
        danger: '#EF4444',
        success: '#10B981',
      },
    },
  },
  plugins: [],
};
