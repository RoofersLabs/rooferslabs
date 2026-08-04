import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { ICON_SIZE } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import {
  ArrowDownTrayIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EllipsisVerticalIcon,
  PlusCircleIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';

/**
 * "Add to Home Screen" button for the top navigation (MVP requirement).
 *
 * Rendered on every platform and hidden only once the app is installed. The
 * label is what adapts to width — the button itself is never conditionally
 * removed, because a phone is precisely where installing matters most.
 *
 * Behaviour comes from `strategy` (see `usePwaInstall`):
 *   native      → Android Chrome/Edge/Samsung: the OS prompt, no modal
 *   ios         → iOS/iPadOS: share-sheet steps, since Safari has no prompt
 *   mobile-help → handheld without a prompt: browser-menu steps
 *   desktop     → the unchanged QR flow, plus native install when offered
 *
 * A handheld can never reach `desktop`, so the QR code — which exists to move
 * the user from a computer to their phone — is never shown on the phone.
 */
export function InstallPwaButton({ className }: { className?: string }) {
  const { canPrompt, promptInstall, strategy } = usePwaInstall();
  const [showModal, setShowModal] = useState(false);

  if (strategy === 'hidden') return null;

  const onClick = () => {
    if (strategy === 'native') {
      void promptInstall();
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={onClick}
        aria-label="Add rooferslabs to your Home Screen"
      >
        <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Add to Home Screen</span>
        <span className="sm:hidden">Install</span>
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Install rooferslabs">
        {strategy === 'ios' ? (
          <IosInstructions />
        ) : strategy === 'mobile-help' ? (
          <MobileInstructions />
        ) : (
          <DesktopInstall canPrompt={canPrompt} onInstall={promptInstall} />
        )}
      </Modal>
    </>
  );
}

/** Step row shared by the two instruction lists. */
function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 pt-0.5 text-accent">{icon}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

/**
 * Android and other handhelds whose browser offered no prompt — Firefox, or
 * Chrome before `beforeinstallprompt` has fired. Every such browser still
 * installs from its own menu, so this is guidance rather than a dead end.
 */
function MobileInstructions() {
  return (
    <ol className="space-y-4 text-body text-ink">
      <Step icon={<EllipsisVerticalIcon className="h-4 w-4" aria-hidden />}>
        Open your browser’s menu — the <strong>⋮</strong> or <strong>≡</strong> button.
      </Step>
      <Step icon={<PlusCircleIcon className="h-4 w-4" aria-hidden />}>
        Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
      </Step>
      <Step icon={<ArrowDownTrayIcon className="h-4 w-4" aria-hidden />}>
        Confirm. rooferslabs will open full-screen from your Home Screen, and you’ll stay signed in.
      </Step>
    </ol>
  );
}

/** iOS/iPadOS: Safari has never implemented `beforeinstallprompt`. */
function IosInstructions() {
  return (
    <ol className="space-y-4 text-body text-ink">
      <Step icon={<ShareIcon className="h-4 w-4" aria-hidden />}>
        Tap the <strong>Share</strong> button in Safari’s toolbar.
      </Step>
      <Step icon={<PlusCircleIcon className="h-4 w-4" aria-hidden />}>
        Scroll down and tap <strong>Add to Home Screen</strong>.
      </Step>
      <Step icon={<ArrowDownTrayIcon className="h-4 w-4" aria-hidden />}>
        Tap <strong>Add</strong>. rooferslabs will appear on your Home Screen like a native app.
      </Step>
    </ol>
  );
}

/** Desktop path: QR code for the phone + native install when available. */
function DesktopInstall({
  canPrompt,
  onInstall,
}: {
  canPrompt: boolean;
  onInstall: () => Promise<boolean>;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(window.location.origin, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <DevicePhoneMobileIcon
          className={cn('shrink-0 text-accent', ICON_SIZE.metric)}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-ink">On your phone (recommended)</p>
          <p className="mt-0.5 text-small text-ink-muted">
            Scan this code with your phone’s camera, sign in, then add rooferslabs to your Home
            Screen. You’ll get lead alerts wherever you are — even on the roof.
          </p>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR code that opens rooferslabs on your phone"
              className="mt-3 h-40 w-40 border border-line-subtle"
            />
          )}
        </div>
      </div>

      {canPrompt && (
        <div className="flex items-start gap-4 border-t border-line-subtle pt-5">
          <ComputerDesktopIcon
            className={cn('shrink-0 text-accent', ICON_SIZE.metric)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-ink">On this computer</p>
            <p className="mt-0.5 text-small text-ink-muted">
              Install rooferslabs as a desktop app for quick access from your dock or taskbar.
            </p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void onInstall()}>
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
              Install on this computer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
