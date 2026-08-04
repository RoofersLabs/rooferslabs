/**
 * rooferslabs Tailwind theme.
 *
 * Two palettes live here on purpose, and they must not be mixed:
 *
 *   Product tokens (`surface`, `ink`, `line`, `accent`, `emergency`, the shadcn
 *   aliases, `sidebar-*`) map onto the CSS variables in src/styles/tokens.css.
 *   The authenticated application and the shadcn/Radix primitives in
 *   src/components/ui are built on these, so light/dark theming and a re-brand
 *   flow from the tokens rather than from hardcoded hex.
 *
 *   Marketing scale (`mk-*`) is the public site's black editorial canvas,
 *   scoped to src/marketing/. It is deliberately separate: the app is a
 *   light-mode operations tool, and merging the two would force one to
 *   compromise.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Primitive rooferslabs blue scale — also re-themes legacy `brand-*`.
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          950: 'var(--brand-950)',
        },
        // Teal — the brand's secondary accent.
        teal: {
          DEFAULT: 'var(--brand-teal)',
          dark: 'var(--brand-teal-dark)',
          subtle: 'var(--brand-teal-subtle)',
        },
        // Transitional: cool neutrals mapped onto the token gray scale so any
        // legacy `slate-*` reads on-brand. New code should use ink/surface/line.
        slate: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
          950: 'var(--n-950)',
        },
        // Theme-aware semantic surfaces & text.
        canvas: 'var(--bg-canvas)',
        base: 'var(--bg-base)',
        surface: {
          DEFAULT: 'var(--surface-1)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          overlay: 'var(--surface-overlay)',
          disabled: 'var(--bg-disabled)',
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          muted: 'var(--text-secondary)',
          faint: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          'on-brand': 'var(--text-on-primary)',
          'on-emergency': 'var(--text-on-emergency)',
        },
        accent: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          subtle: 'var(--color-primary-subtle)',
          border: 'var(--color-primary-border)',
        },
        emergency: {
          DEFAULT: 'var(--color-emergency)',
          hover: 'var(--color-emergency-hover)',
          active: 'var(--color-emergency-active)',
          subtle: 'var(--color-emergency-subtle)',
          border: 'var(--color-emergency-border)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          subtle: 'var(--color-warning-subtle)',
          border: 'var(--color-warning-border)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          subtle: 'var(--color-success-subtle)',
          border: 'var(--color-success-border)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          subtle: 'var(--color-info-subtle)',
          border: 'var(--color-info-border)',
        },

        // ── shadcn/ui compatibility aliases ────────────────────────────────
        // shadcn-generated components read these exact utility names. They're
        // mapped onto our existing tokens above (never shadcn's stock palette)
        // so new components render on-brand immediately. `accent` is
        // deliberately NOT aliased here — it already means "solid brand blue"
        // in this codebase (Button primary, active nav, etc.), which conflicts
        // with shadcn's convention of `accent` as a subtle hover/selected
        // highlight. Any shadcn component using bare `bg-accent` /
        // `text-accent-foreground` for a hover state must be hand-patched to
        // `bg-surface-3` / `text-ink` when it's added.
        background: 'var(--bg-canvas)',
        foreground: 'var(--text-primary)',
        card: {
          DEFAULT: 'var(--surface-1)',
          foreground: 'var(--text-primary)',
        },
        popover: {
          DEFAULT: 'var(--surface-overlay)',
          foreground: 'var(--text-primary)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--text-on-primary)',
        },
        // Neutral bordered surface — matches the existing hand-rolled
        // Button's "secondary" variant (bg-surface-2/text-ink), not a brand hue.
        secondary: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--text-primary)',
          hover: 'var(--surface-3)',
        },
        muted: {
          DEFAULT: 'var(--surface-3)',
          foreground: 'var(--text-tertiary)',
        },
        destructive: {
          DEFAULT: 'var(--color-emergency)',
          foreground: 'var(--text-on-emergency)',
        },
        border: 'var(--border-default)',
        input: 'var(--border-default)',
        ring: 'var(--focus-ring)',
        // ── Marketing palette (src/marketing/ ONLY) ────────────────────────
        // The public site's black canvas. Never use these in the application.
        mk: {
          bg: '#000000',
          card: 'rgba(255,255,255,0.03)',
          'card-hover': 'rgba(255,255,255,0.05)',
          line: 'rgba(255,255,255,0.11)',
          'line-strong': 'rgba(255,255,255,0.16)',
          // `muted` measures 4.43:1 on black, marginally under the AA body
          // threshold, so it is reserved for micro-labels and timestamps. All
          // running copy uses `secondary` (10.02:1).
          fg: '#FFFFFF',
          secondary: 'rgba(255,255,255,0.70)',
          muted: 'rgba(255,255,255,0.45)',
          // The rooferslabs blue ramp, tuned for a black canvas. 600 carries
          // white text at 5.56:1; 400 reads 7.80:1 as link text.
          'accent-700': '#0E3996',
          accent: '#2B5CE6',
          'accent-hover': '#3B6BF0',
          'accent-ring': '#4F7DFF',
          'accent-fg': '#6E9BFF',
        },

        sidebar: {
          DEFAULT: 'var(--surface-1)',
          foreground: 'var(--text-primary)',
          primary: 'var(--color-primary)',
          'primary-foreground': 'var(--text-on-primary)',
          accent: 'var(--color-primary-subtle)',
          'accent-foreground': 'var(--color-primary)',
          border: 'var(--border-subtle)',
          ring: 'var(--focus-ring)',
        },
      },
      fontFamily: {
        // The application's stack is request-free: no webfont on the critical
        // path, so no FOUT-driven layout shift. Inter leads because the
        // marketing site already loads it, but nothing here waits on it.
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Menlo',
          'monospace',
        ],
        // Marketing-only, loaded from Google Fonts in index.html.
        display: ['"Inter var"', 'Inter', 'system-ui', 'sans-serif'],
        num: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        display: ['4.5rem', { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '700' }],
        hero: ['3.5rem', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' }],
        h2: ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['1.625rem', { lineHeight: '1.25', letterSpacing: '-0.005em', fontWeight: '600' }],
        h4: ['1.3125rem', { lineHeight: '1.3', fontWeight: '600' }],
        h5: ['1.0625rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        body: ['0.9375rem', { lineHeight: '1.6' }],
        small: ['0.8125rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        label: ['0.8125rem', { lineHeight: '1.3', letterSpacing: '0.01em', fontWeight: '600' }],
        button: ['0.875rem', { lineHeight: '1', letterSpacing: '0.01em', fontWeight: '600' }],
        metric: ['2rem', { lineHeight: '1.1', fontWeight: '600' }],
        'table-header': [
          '0.75rem',
          { lineHeight: '1.2', letterSpacing: '0.03em', fontWeight: '600' },
        ],
        'table-cell': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'form-label': ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }],
        'form-input': ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      // Every key Tailwind ships with is redeclared here, not just the ones the
      // product happens to use. This block lives under `extend`, so any key left
      // out would keep Tailwind's stock value — the bare `rounded` utility
      // (0.25rem) and `rounded-3xl` (1.5rem) were exactly that gap, reachable
      // from any new component and invisible in a token audit. Naming all of
      // them means there is no `rounded-*` class in the framework that escapes
      // this theme. Structure is square; only `full` and `focus` curve. See the
      // radius block in styles/tokens.css.
      borderRadius: {
        none: 'var(--radius-structural)',
        DEFAULT: 'var(--radius-structural)',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-structural)',
        '4xl': 'var(--radius-structural)',
        panel: 'var(--radius-panel)',
        field: 'var(--radius-field)',
        full: 'var(--radius-full)',
        focus: 'var(--radius-focus)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        card: 'var(--elevation-card)',
        'card-hover': 'var(--elevation-card-hover)',
        nav: 'var(--elevation-nav)',
        dropdown: 'var(--elevation-dropdown)',
        dialog: 'var(--elevation-dialog)',
        tooltip: 'var(--elevation-tooltip)',
        button: 'var(--elevation-button)',
      },
      ringColor: {
        focus: 'var(--focus-ring)',
      },
      maxWidth: {
        narrow: 'var(--container-narrow)',
        // Marketing shell.
        shell: '1280px',
        dashboard: 'var(--container-dashboard)',
      },
      transitionTimingFunction: {
        // Marketing: linear-style exponential ease-out, no overshoot.
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
        standard: 'var(--ease-standard)',
        decelerate: 'var(--ease-decelerate)',
        accelerate: 'var(--ease-accelerate)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        instant: '100ms',
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        slower: '450ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        // A bottom sheet arriving from and leaving toward the edge it is
        // anchored to. `translate3d` keeps the panel on the compositor, so a
        // full-width surface animates without laying out or painting a frame.
        'sheet-in': {
          from: { transform: 'translate3d(0, 100%, 0)' },
          to: { transform: 'translate3d(0, 0, 0)' },
        },
        'sheet-out': {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(0, 100%, 0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Content settling into place. `translate3d` keeps it on the compositor,
        // so a step entrance costs no layout and no paint.
        'rise-in': {
          from: { opacity: '0', transform: 'translate3d(0, 10px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-base) var(--ease-standard)',
        'fade-out': 'fade-out var(--duration-base) var(--ease-standard)',
        // Decelerate in, accelerate out — the panel settles as it arrives and
        // gets out of the way as it leaves, which is what makes a dismissal
        // read as quick without being abrupt.
        'sheet-in': 'sheet-in var(--duration-base) var(--ease-decelerate)',
        'sheet-out': 'sheet-out var(--duration-base) var(--ease-accelerate)',
        'scale-in': 'scale-in var(--duration-base) var(--ease-decelerate)',
        // `both` so a delayed element holds at opacity 0 rather than flashing in
        // at full opacity before its turn.
        'rise-in': 'rise-in var(--duration-slow) var(--ease-decelerate) both',
      },
    },
  },
  plugins: [],
};
