import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * Accessible modal dialog built on Radix Dialog (via shadcn): focus trapping,
 * portal rendering, Escape-to-close, and backdrop dismissal come from Radix.
 *
 * The header and body use the same 24px gutter and vertical rhythm as
 * CardHeader/CardContent, so a form reads identically whether it is shown in a
 * dialog or inline on a page.
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
          'gap-0 rounded-panel border border-line-subtle bg-surface-overlay p-0 text-ink ring-0 shadow-dialog',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1.5 shrink-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
