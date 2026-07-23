/**
 * RoofersLabs application design tokens.
 *
 * The application UI is built on Tailwind's stock neutral ramp; the only
 * extension it needs is the system font stack, which keeps the critical path
 * free of font requests and eliminates FOUT-driven layout shift.
 *
 * The `mk-*` scale below is the marketing site's black-canvas surface, scoped
 * to `src/marketing/`. It is deliberately separate from the application ramp:
 * the app is a light-mode operations tool, the marketing site is a dark
 * editorial canvas, and merging the two would force one to compromise.
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
        // Marketing-only. Loaded from Google Fonts in index.html, applied by the
        // marketing root so the application keeps its request-free system stack.
        display: ['"Inter var"', 'Inter', 'system-ui', 'sans-serif'],
        num: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        mk: {
          // Surface
          bg: '#000000',
          card: 'rgba(255,255,255,0.03)',
          'card-hover': 'rgba(255,255,255,0.05)',
          line: 'rgba(255,255,255,0.08)',
          'line-strong': 'rgba(255,255,255,0.14)',
          // Text — `muted` measures 4.43:1 on black, marginally under the AA
          // body threshold, so it is reserved for micro-labels and timestamps.
          // All running copy uses `secondary` (10.02:1).
          fg: '#FFFFFF',
          secondary: 'rgba(255,255,255,0.70)',
          muted: 'rgba(255,255,255,0.45)',
          // Accent — the RoofersLabs blue ramp, tuned for a black canvas.
          // 600 carries white text at 5.56:1; 400 reads 7.80:1 as link text.
          'accent-700': '#0E3996',
          accent: '#2B5CE6',
          'accent-hover': '#3B6BF0',
          'accent-ring': '#4F7DFF',
          'accent-fg': '#6E9BFF',
        },
      },
      maxWidth: {
        shell: '1280px',
      },
      transitionTimingFunction: {
        // Linear-style exponential ease-out. No overshoot, no bounce.
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
