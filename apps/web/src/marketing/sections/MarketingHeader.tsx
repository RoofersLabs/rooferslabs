import { AnnouncementBar } from '../components/AnnouncementBar';
import { Nav } from './Nav';

/**
 * The fixed chrome at the top of the page: announcement bar above navigation.
 *
 * The stack is what is pinned to the viewport, not the navigation itself, which
 * is how the bar can sit above it at rest and hand the top edge back once it
 * collapses. Nothing here uses a transform — a transformed ancestor would
 * become the backdrop root and the navigation's blur would stop sampling the
 * page behind it.
 */
export function MarketingHeader() {
  return (
    <div className="fixed inset-x-0 top-0 z-40">
      <AnnouncementBar />
      <Nav />
    </div>
  );
}
