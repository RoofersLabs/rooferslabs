import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * Accessible modal dialog built on Radix Dialog (via shadcn): focus trapping,
 * portal rendering, Escape-to-close, and backdrop dismissal come from Radix.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'gap-0 rounded-2xl border border-line-subtle bg-surface p-0 text-ink ring-0 shadow-dialog',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-4">
          <DialogTitle className="text-h5 font-semibold text-ink">{title}</DialogTitle>
          <button
            onClick={onClose}
            className="focus-ring rounded-md p-1 text-ink-faint transition-colors duration-fast hover:bg-surface-3 hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
