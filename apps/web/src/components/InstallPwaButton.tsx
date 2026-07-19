import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share, PlusSquare, Smartphone, Monitor } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';

/**
 * "Add to Home Screen" button for the top navigation (MVP requirement).
 * Hidden entirely once the app is installed.
 *
 * - Android/Chrome mobile: triggers the native install prompt.
 * - iOS Safari (no native prompt): step-by-step instructions.
 * - Desktop: a QR code that opens the app on the owner's phone, plus the
 *   native desktop install when the browser offers one.
 */
export function InstallPwaButton() {
  const { canPrompt, installed, promptInstall, isIos, isMobile } = usePwaInstall();
  const [showModal, setShowModal] = useState(false);

  if (installed) return null;
  if (isMobile && !canPrompt && !isIos) return null;

  const onClick = () => {
    if (isMobile && canPrompt) {
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
        onClick={onClick}
        aria-label="Add RoofersLabs to your Home Screen"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Add to Home Screen</span>
        <span className="sm:hidden">Install</span>
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Install RoofersLabs">
        {isMobile && isIos ? (
          <IosInstructions />
        ) : (
          <DesktopInstall canPrompt={canPrompt} onInstall={promptInstall} />
        )}
      </Modal>
    </>
  );
}

function IosInstructions() {
  return (
    <ol className="space-y-4 text-sm text-ink">
      <li className="flex items-start gap-3">
        <Share className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <span>
          Tap the <strong>Share</strong> button in Safari’s toolbar.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <PlusSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <span>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <span>
          Tap <strong>Add</strong>. RoofersLabs will appear on your Home Screen like a native app.
        </span>
      </li>
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
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">On your phone (recommended)</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Scan this code with your phone’s camera, sign in, then add RoofersLabs to your Home
            Screen. You’ll get lead alerts wherever you are — even on the roof.
          </p>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR code that opens RoofersLabs on your phone"
              className="mt-3 h-40 w-40 rounded-lg border border-line-subtle"
            />
          )}
        </div>
      </div>

      {canPrompt && (
        <div className="flex items-start gap-4 border-t border-line-subtle pt-5">
          <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">On this computer</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Install RoofersLabs as a desktop app for quick access from your dock or taskbar.
            </p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void onInstall()}>
              <Download className="h-4 w-4" aria-hidden />
              Install on this computer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
