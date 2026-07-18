import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Accessible modal dialog built on the native <dialog> element: focus trapping,
 * Escape-to-close, and backdrop dismissal come from the platform.
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
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Backdrop click closes (the dialog itself is the backdrop target).
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'w-full rounded-2xl border border-line-subtle bg-surface p-0 text-ink shadow-dialog backdrop:bg-black/50 open:animate-scale-in',
        wide ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      <div className="flex items-center justify-between border-b border-line-subtle px-6 py-4">
        <h2 className="text-h5 text-ink">{title}</h2>
        <button
          onClick={onClose}
          className="focus-ring rounded-md p-1 text-ink-faint transition-colors duration-fast hover:bg-surface-3 hover:text-ink"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
