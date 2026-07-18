import { useEffect, useState } from 'react';
import { Download, Mic } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Plays a call recording through the authenticated API proxy (Twilio
 * recordings require account credentials, so the browser can't load them
 * directly). Native controls give play/pause/seek; download saves the mp3.
 */
export function RecordingPlayer({ callId }: { callId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .getBlob(`/calls/${callId}/recording`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId]);

  const download = () => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `call-${callId}.mp3`;
    link.click();
  };

  if (error) return null;

  return (
    <div className="mt-4">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Mic className="h-3.5 w-3.5" aria-hidden />
        Recording
      </p>
      {src ? (
        <div className="flex items-center gap-2">
          <audio controls src={src} className="h-9 w-full" preload="metadata" />
          <Button variant="ghost" size="sm" onClick={download} aria-label="Download the recording">
            <Download className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2 text-xs text-ink-faint">
          <Spinner className="h-4 w-4" />
          Loading recording…
        </div>
      )}
    </div>
  );
}
