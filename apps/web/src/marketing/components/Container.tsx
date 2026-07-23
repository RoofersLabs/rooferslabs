import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The single horizontal measure for the whole page: 1280px, with gutters that
 * grow with the viewport. Every section uses this, which is what makes the page
 * read as one continuous column rather than a stack of unrelated blocks.
 */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-shell px-6 sm:px-8', className)}>{children}</div>;
}
