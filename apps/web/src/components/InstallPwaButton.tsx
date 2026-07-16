import { useState } from 'react';
import { Download, Share, PlusSquare } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/**
 * "Add to Home Screen" button for the top navigation (MVP requirement).
 * Hidden entirely once the app is installed. On iOS (no native prompt) it
 * opens step-by-step Safari instructions instead.
 */
export function InstallPwaButton() {
  const { canPrompt, installed, promptInstall, isIos } = usePwaInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (installed) return null;
  if (!canPrompt && !isIos) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => (canPrompt ? void promptInstall() : setShowIosHelp(true))}
        aria-label="Add RoofersLabs to your Home Screen"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Add to Home Screen</span>
        <span className="sm:hidden">Install</span>
      </Button>

      <Modal open={showIosHelp} onClose={() => setShowIosHelp(false)} title="Install RoofersLabs">
        <ol className="space-y-4 text-sm text-slate-700">
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
              Tap <strong>Add</strong>. RoofersLabs will appear on your Home Screen like a native
              app.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
