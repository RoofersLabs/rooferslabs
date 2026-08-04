import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

/**
 * Downloads a call recording through the authenticated API proxy — Twilio
 * recordings require account credentials, so the browser cannot fetch them
 * directly.
 *
 * The request is made on click, not on mount. The player this replaced pulled
 * the entire mp3 down as soon as the page opened, which on a job site meant
 * paying for an audio file nobody had asked to hear. Nothing is preloaded and
 * nothing plays inline.
 */
export function RecordingDownload({ callId }: { callId: string }) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const blob = await api.getBlob(`/calls/${callId}/recording`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `call-${callId}.mp3`;
      link.click();
      // Revoked on a later tick: revoking synchronously can cancel the download
      // before the browser has finished reading the blob.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-line-subtle pt-4">
      <Button variant="secondary" size="sm" loading={loading} onClick={() => void download()}>
        {/* The button supplies its own spinner while loading, so the icon would
            otherwise sit beside it. */}
        {!loading && <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />}
        Download call recording
      </Button>
      {failed && (
        <p className="mt-2 text-caption text-emergency">
          That recording couldn’t be downloaded. Please try again.
        </p>
      )}
    </div>
  );
}
