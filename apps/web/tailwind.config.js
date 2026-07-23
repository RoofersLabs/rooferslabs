/**
 * Minimal Tailwind configuration.
 *
 * The previous design system (custom tokens, themes, animations) was removed
 * ahead of a full product redesign. Until that lands, the temporary UI uses
 * stock Tailwind defaults only — deliberately no theme extensions.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
