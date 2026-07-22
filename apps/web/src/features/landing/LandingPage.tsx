import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import './styles/marketing.css';

import { useMarketingTheme } from './useMarketingTheme';
import { Seo } from './components/Seo';
import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';
import { TradeShowcase } from './sections/TradeShowcase';
import { FeatureHighlight } from './sections/FeatureHighlight';
import { Problem } from './sections/Problem';
import { Timeline } from './sections/Timeline';
import { DashboardShowcase } from './sections/DashboardShowcase';
import { ConversationDemo } from './sections/ConversationDemo';
import { FeatureGrid } from './sections/FeatureGrid';
import { Integrations } from './sections/Integrations';
import { HowItWorks } from './sections/HowItWorks';
import { Comparison } from './sections/Comparison';
import { Pricing } from './sections/Pricing';
import { Faq } from './sections/Faq';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';

/**
 * Public marketing site.
 *
 * The `mkt` class is the root of the marketing design system — every token in
 * styles/marketing.css is scoped to this subtree, so nothing here can reach the
 * authenticated app, and none of the app's tokens apply inside it.
 */
export function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { theme, toggle, animated } = useMarketingTheme();

  if (isLoaded && isSignedIn) return <Navigate to="/dashboard" replace />;

  return (
    <div
      className="mkt min-h-screen bg-mkt-bg font-sans text-mkt-ink antialiased"
      data-mkt-theme={theme}
      // Enabled one frame after mount so a stored dark preference doesn't
      // visibly animate from light on first paint.
      data-mkt-animate={animated ? '' : undefined}
    >
      <Seo />

      <a
        href="#main"
        className="mkt-focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-mkt-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-mkt-ink focus:shadow-mkt-md"
      >
        Skip to content
      </a>

      <Navbar theme={theme} onToggleTheme={toggle} />

      <main id="main">
        <Hero />
        <TradeShowcase />
        <FeatureHighlight />
        <Problem />
        <Timeline />
        <DashboardShowcase />
        <ConversationDemo />
        <FeatureGrid />
        <Integrations />
        <HowItWorks />
        <Comparison />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
