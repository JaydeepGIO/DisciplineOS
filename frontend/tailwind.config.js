/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0f1e',
        surface: '#111827',
        card: '#1f2937',
        border: '#374151',
        primary: '#6366f1',
        accent: '#f59e0b',
        success: '#10b981',
        danger: '#ef4444',
        textPrimary: '#f1f5f9',
        textMuted: '#94a3b8',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
