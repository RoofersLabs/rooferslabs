/**
 * Scroll-reveal plumbing.
 *
 * Every revealed element on the page shares ONE IntersectionObserver. A page
 * this long has well over a hundred revealed nodes; giving each its own
 * observer is measurable overhead for no benefit.
 *
 * The observer only ever adds `data-visible`, never removes it — content that
 * re-animates when you scroll back up feels like a toy, not a product.
 */

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.visible = 'true';
        // Reveals are one-shot, so stop paying for the element immediately.
        self.unobserve(entry.target);
      }
    },
    {
      // Fire slightly before the element reaches the bottom edge, so the
      // motion has finished by the time it is comfortably in view rather than
      // starting the instant it clips the fold.
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.08,
    },
  );
  return observer;
}

/** Observe `element`; returns a cleanup that stops observing it. */
export function observeReveal(element: HTMLElement): () => void {
  const io = getObserver();
  io.observe(element);
  return () => io.unobserve(element);
}
