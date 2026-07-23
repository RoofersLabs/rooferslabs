/**
 * RoofersLabs application design tokens.
 *
 * The application UI is built on Tailwind's stock neutral ramp; the only
 * extension it needs is the system font stack, which keeps the critical path
 * free of font requests and eliminates FOUT-driven layout shift.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'Inter',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
