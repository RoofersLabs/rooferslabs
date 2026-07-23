import { useCallback, useRef, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { observeReveal } from '../lib/reveal';

/**
 * The reveal variants available to sections.
 *
 * Deliberately several: an entire page where everything fades up the same way
 * announces itself as a template. Neighbouring sections should never share one.
 */
export type RevealVariant = 'fade' | 'up' | 'blur' | 'mask' | 'wipe' | 'scale' | 'left' | 'right';

type RevealProps = {
  children: ReactNode;
  /** How the element enters. Defaults to a plain fade-up. */
  variant?: RevealVariant;
  /** Position within a staggered group; multiplied by the global stagger step. */
  index?: number;
  /** Rendered element. Use a semantic tag rather than wrapping in extra divs. */
  as?: ElementType;
  className?: string;
  id?: string;
  'aria-hidden'?: boolean;
};

/**
 * Declarative wrapper over the shared IntersectionObserver.
 *
 * All of the animation lives in CSS (see `styles/index.css`), so reveals keep
 * running smoothly while React is still busy mounting the rest of the page.
 *
 * Above-the-fold content needs no special case: the observer's first callback
 * lands after the initial paint, so hero elements transition in on load exactly
 * the way lower sections do when scrolled to.
 */
export function Reveal({
  children,
  variant = 'up',
  index = 0,
  as = 'div',
  className,
  id,
  'aria-hidden': ariaHidden,
}: RevealProps) {
  const stopObserving = useRef<(() => void) | null>(null);

  /**
   * A callback ref rather than an effect, so an element is registered the
   * instant it is attached — including elements rendered inside a lazy chunk
   * that resolves while the user is already scrolling past it.
   */
  const attach = useCallback((element: HTMLElement | null) => {
    stopObserving.current?.();
    stopObserving.current = element ? observeReveal(element) : null;
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={attach}
      id={id}
      className={cn(className)}
      data-reveal={variant}
      aria-hidden={ariaHidden}
      style={index ? ({ '--reveal-index': index } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
