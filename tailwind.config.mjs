/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        surface: '#FAF9F6',
        'surface-card': '#FFFFFF',
        ink: '#1A1A1A',
        'ink-muted': '#6B6B6B',
        'ink-faint': '#9B9B9B',
        accent: '#0D9488',
        'accent-light': '#CCFBF1',
        'accent-dark': '#0F766E',
        'band-optimal': '#0D9488',
        'band-borderline': '#D97706',
        'band-high': '#DC2626',
        border: '#E5E5E5',
        'border-hover': '#D4D4D4',
      },
      fontFamily: {
        heading: ['Sora', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
