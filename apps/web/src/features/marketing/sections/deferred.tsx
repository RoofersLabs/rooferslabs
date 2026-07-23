/**
 * Everything below the second viewport, bundled into one lazy chunk.
 *
 * Splitting each section individually would mean a dozen round trips for
 * content that is always scrolled to in the same order. One chunk, requested
 * after the hero has painted, is the better trade.
 */
export { HowItWorks } from './HowItWorks';
export { Metrics } from './Metrics';
export { Intelligence } from './Intelligence';
export { Testimonials } from './Testimonials';
export { Pricing } from './Pricing';
export { Faq } from './Faq';
export { FinalCta } from './FinalCta';
