/** @type {import('tailwindcss').Config} */
// Utilities map onto the design tokens in src/styles/tokens.css. Prefer the
// semantic names (bg-surface, text-ink, border-line, bg-accent, text-emergency)
// so light/dark theming and re-brands flow from the tokens, never hardcoded.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Primitive RoofersLabs blue scale — also re-themes legacy `brand-*`.
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

        // ── Marketing palette (landing page ONLY) ──────────────────────────
        // Backed by src/features/landing/styles/marketing.css, where every
        // variable is scoped under `.mkt`. Namespaced so it can never collide
        // with a product token: `bg-mkt-surface`, `text-mkt-ink`, etc.
        // Outside a `.mkt` subtree these variables are undefined — which is
        // the point. Do not use them in the dashboard.
        mkt: {
          bg: 'var(--mkt-bg)',
          'bg-subtle': 'var(--mkt-bg-subtle)',
          'bg-inset': 'var(--mkt-bg-inset)',
          surface: 'var(--mkt-surface)',
          'surface-2': 'var(--mkt-surface-2)',
          'surface-raised': 'var(--mkt-surface-raised)',
          line: {
            DEFAULT: 'var(--mkt-line)',
            subtle: 'var(--mkt-line-subtle)',
            strong: 'var(--mkt-line-strong)',
          },
          ink: {
            DEFAULT: 'var(--mkt-ink)',
            body: 'var(--mkt-ink-body)',
            muted: 'var(--mkt-ink-muted)',
            faint: 'var(--mkt-ink-faint)',
            inverse: 'var(--mkt-ink-inverse)',
          },
          accent: {
            DEFAULT: 'var(--mkt-accent)',
            hover: 'var(--mkt-accent-hover)',
            active: 'var(--mkt-accent-active)',
            soft: 'var(--mkt-accent-soft)',
            border: 'var(--mkt-accent-border)',
            ink: 'var(--mkt-accent-ink)',
          },
          accent2: {
            DEFAULT: 'var(--mkt-accent-2)',
            soft: 'var(--mkt-accent-2-soft)',
          },
          success: {
            DEFAULT: 'var(--mkt-success)',
            soft: 'var(--mkt-success-soft)',
          },
          warn: {
            DEFAULT: 'var(--mkt-warn)',
            soft: 'var(--mkt-warn-soft)',
          },
          focus: 'var(--mkt-focus)',
          // Primary CTA fill: a solid neutral that inverts with the theme
          // (near-black on light, white on dark). Not part of the blue family.
          solid: {
            DEFAULT: 'var(--mkt-solid)',
            hover: 'var(--mkt-solid-hover)',
            ink: 'var(--mkt-solid-ink)',
          },
          // Raw ramps, for gradient stops and glows that need a specific step.
          blue: {
            50: 'var(--mkt-blue-50)',
            100: 'var(--mkt-blue-100)',
            200: 'var(--mkt-blue-200)',
            300: 'var(--mkt-blue-300)',
            400: 'var(--mkt-blue-400)',
            500: 'var(--mkt-blue-500)',
            600: 'var(--mkt-blue-600)',
            700: 'var(--mkt-blue-700)',
            800: 'var(--mkt-blue-800)',
            900: 'var(--mkt-blue-900)',
          },
          indigo: {
            100: 'var(--mkt-indigo-100)',
            200: 'var(--mkt-indigo-200)',
            300: 'var(--mkt-indigo-300)',
            400: 'var(--mkt-indigo-400)',
            500: 'var(--mkt-indigo-500)',
            600: 'var(--mkt-indigo-600)',
            700: 'var(--mkt-indigo-700)',
          },
          emerald: {
            100: 'var(--mkt-emerald-100)',
            300: 'var(--mkt-emerald-300)',
            500: 'var(--mkt-emerald-500)',
            600: 'var(--mkt-emerald-600)',
            700: 'var(--mkt-emerald-700)',
          },
          gray: {
            0: 'var(--mkt-gray-0)',
            25: 'var(--mkt-gray-25)',
            50: 'var(--mkt-gray-50)',
            100: 'var(--mkt-gray-100)',
            200: 'var(--mkt-gray-200)',
            300: 'var(--mkt-gray-300)',
            400: 'var(--mkt-gray-400)',
            500: 'var(--mkt-gray-500)',
            600: 'var(--mkt-gray-600)',
            700: 'var(--mkt-gray-700)',
            800: 'var(--mkt-gray-800)',
            900: 'var(--mkt-gray-900)',
          },
        },
      },
      // Marketing-only gradients — `bg-mkt-hero`, `bg-mkt-cta`, etc.
      backgroundImage: {
        'mkt-hero': 'var(--mkt-grad-hero)',
        'mkt-vignette': 'var(--mkt-grad-vignette)',
        'mkt-cta': 'var(--mkt-grad-cta)',
        'mkt-card-hover': 'var(--mkt-grad-card-hover)',
        'mkt-headline': 'var(--mkt-grad-headline)',
        'mkt-rule': 'var(--mkt-grad-rule)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
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

        // ── Marketing display scale (landing page ONLY) ────────────────────
        // Three deliberate steps, not a fluid clamp: each one is composed for
        // its breakpoint so the headline breaks lines where it should. Weight
        // is 600 at every step — a display headline set in 700 reads as loud
        // rather than large. Tracking tightens as size grows, which is what
        // keeps 88px from looking like a stretched 48px.
        'mkt-display': [
          '5.5rem',
          { lineHeight: '1.02', letterSpacing: '-0.032em', fontWeight: '600' },
        ],
        'mkt-display-md': [
          '4rem',
          { lineHeight: '1.05', letterSpacing: '-0.028em', fontWeight: '600' },
        ],
        'mkt-display-sm': [
          '2.75rem',
          { lineHeight: '1.08', letterSpacing: '-0.024em', fontWeight: '600' },
        ],
        // Hero supporting paragraph. Larger and looser than body copy — it has
        // to survive being read from across the room at the top of the page.
        'mkt-lede': ['1.25rem', { lineHeight: '1.6', letterSpacing: '-0.008em' }],
        'mkt-lede-sm': ['1.0625rem', { lineHeight: '1.6', letterSpacing: '-0.006em' }],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
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
        // Marketing-only elevation. Warm-tinted in light, near-invisible in
        // dark (where depth comes from surface luminance and glow instead).
        'mkt-xs': 'var(--mkt-shadow-xs)',
        'mkt-sm': 'var(--mkt-shadow-sm)',
        'mkt-md': 'var(--mkt-shadow-md)',
        'mkt-lg': 'var(--mkt-shadow-lg)',
        'mkt-xl': 'var(--mkt-shadow-xl)',
        'mkt-mockup': 'var(--mkt-shadow-mockup)',
        'mkt-solid': 'var(--mkt-shadow-solid)',
      },
      ringColor: {
        focus: 'var(--focus-ring)',
      },
      maxWidth: {
        narrow: 'var(--container-narrow)',
        marketing: 'var(--container-marketing)',
        dashboard: 'var(--container-dashboard)',
      },
      transitionTimingFunction: {
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
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-base) var(--ease-standard)',
        'scale-in': 'scale-in var(--duration-base) var(--ease-decelerate)',
      },
    },
  },
  plugins: [],
};
