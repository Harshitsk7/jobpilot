/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jp: {
          bg: '#0c0c0c',
          surface: '#161616',
          'surface-2': '#1e1e1e',
          'surface-3': '#262626',
          border: '#2a2a2a',
          'border-subtle': '#1f1f1f',
          accent: '#c4f042',
          'accent-dim': '#a8cc38',
          'accent-glow': 'rgba(196, 240, 66, 0.08)',
          'accent-glow-strong': 'rgba(196, 240, 66, 0.15)',
          orange: '#ff8a3d',
          cyan: '#42d4f0',
          rose: '#f0426e',
          violet: '#a78bfa',
          text: '#e8e8e8',
          'text-secondary': '#888888',
          'text-muted': '#555555',
          success: '#c4f042',
          warning: '#ff8a3d',
          danger: '#f0426e',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        jp: '14px',
        'jp-sm': '8px',
      },
    },
  },
  plugins: [],
};
