import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        // The scrim fades out as well as in. Radix keeps an element mounted for
        // as long as it has a running exit animation, so without the second
        // half the scrim vanished on the first frame of a dismissal while the
        // panel was still travelling — the panel appeared to slide away over
        // nothing. Every sheet in the app closes this way, which is the point:
        // the mobile navigation drawer had the same seam.
        'fixed inset-0 z-50 bg-black/50 supports-[backdrop-filter]:backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'fixed z-50 flex flex-col gap-4 border-line-subtle bg-surface-overlay bg-clip-padding text-body text-ink shadow-dialog data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-[state=open]:animate-fade-in',
          // The bottom side, as a bottom sheet.
          //
          // Only this side gets it, and only this side had no consumer before —
          // the navigation drawer is `left`/`right` — so nothing existing moves.
          //
          // It arrives by travelling up from the edge it is anchored to rather
          // than fading in place: on a phone the panel is a surface being drawn
          // over the page, and the direction is what says which edge it came
          // from and which way to flick it away. The stacked `data-` variants
          // are two attribute selectors against the base rule's one, so these
          // win on specificity without `!important`.
          //
          // `max-h-[85dvh]` leaves a strip of the dashboard visible, which is
          // the whole reason for a sheet rather than a page: the reader keeps
          // their place. `dvh` rather than `vh` because mobile browser chrome
          // retracts on scroll, and `vh` measures the tall state — a sheet
          // sized to it is cut off by the address bar on arrival. `min-h-0` on
          // the body is what actually lets the content scroll inside a flex
          // column instead of overflowing the panel.
          'data-[side=bottom]:max-h-[85dvh]',
          'data-[side=bottom]:data-[state=open]:animate-sheet-in data-[side=bottom]:data-[state=closed]:animate-sheet-out',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-0.5 px-6 py-5', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-3 px-6 py-4', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-h5 text-ink', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-small text-ink-muted', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
