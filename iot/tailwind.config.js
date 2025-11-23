/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: 'var(--color-orange)',
        red: 'var(--color-red)',
        gray1: 'var(--color-gray1)',
        gray2: 'var(--color-gray2)',
        gray3: 'var(--color-gray3)',
        gray4: 'var(--color-gray4)',
        gray5: 'var(--color-gray5)',
        gray6: 'var(--color-gray6)',
        gray7: 'var(--color-gray7)',
        gray8: 'var(--color-gray8)',
        gray9: 'var(--color-gray9)',
        gray10: 'var(--color-gray10)',
        gray11: 'var(--color-gray11)',
        gray12: 'var(--color-gray12)',
      },
      borderRadius: {
        '12': 'var(--radius-12)',
        'full': 'var(--radius-full)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      transitionTimingFunction: {
        'swift': 'var(--ease-swift)',
      },
    },
  },
  plugins: [],
}

