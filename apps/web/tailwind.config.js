/**
 * RoofersLabs design tokens.
 *
 * The palette is deliberately tiny: pure black, a four-step neutral ramp, and
 * one accent. Anything that needs to stand out earns it through spacing and
 * type scale, not through colour.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds. `void` is the page — near-black rather than pure #000,
        // which keeps raised surfaces legible as depth instead of forcing them
        // to out-brighten an absolute floor. The rest sit within a few points
        // of it so panels read as planes, not as colour.
        void: '#050505',
        surface: {
          DEFAULT: '#0A0B0D',
          raised: '#0F1114',
          hover: '#16181C',
        },
        // Text ramp. Four steps is enough hierarchy for the whole site, and
        // every one of them clears WCAG AA (4.5:1) against pure black — the
        // quietest step is still text, so "subtle" is not allowed to mean
        // "unreadable".
        ink: {
          DEFAULT: '#FFFFFF',
          secondary: '#B4B7BD', // 10.3:1
          tertiary: '#8B9099', //  6.5:1
          quaternary: '#757A83', //  4.9:1
        },
        accent: {
          DEFAULT: '#2563EB',
          hover: '#3B76F0',
          press: '#1D53CC',
        },
        subtle: 'rgba(255,255,255,0.07)',
        strong: 'rgba(255,255,255,0.13)',
      },
      fontFamily: {
        // Self-hosting nothing keeps the critical path free of font requests
        // and eliminates FOUT-driven layout shift. On the audience's machines
        // this resolves to SF Pro or Segoe UI Variable, both of which carry a
        // premium product site perfectly well.
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
      fontSize: {
        // Display sizes carry negative tracking; at 60px+ default tracking
        // reads loose and amateurish.
        display: [
          'clamp(2.75rem, 6.2vw, 5.25rem)',
          { lineHeight: '1.02', letterSpacing: '-0.04em' },
        ],
        headline: [
          'clamp(2.125rem, 4.4vw, 3.5rem)',
          { lineHeight: '1.06', letterSpacing: '-0.035em' },
        ],
        title: ['clamp(1.5rem, 2.4vw, 2rem)', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        lead: [
          'clamp(1.0625rem, 1.35vw, 1.25rem)',
          { lineHeight: '1.55', letterSpacing: '-0.011em' },
        ],
        eyebrow: ['0.75rem', { lineHeight: '1', letterSpacing: '0.1em' }],
      },
      maxWidth: {
        shell: '1200px',
        prose: '34rem',
      },
      transitionTimingFunction: {
        // Stock CSS easings are too weak to read as intentional.
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
    },
  },
  plugins: [],
};
