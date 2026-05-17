import { useEffect, useState } from 'react';
import type { Phase } from '../../lib/types';
import { BrowserChrome } from './BrowserChrome';
import { AlertIcon, BracketsIcon, LoaderIcon } from '../icons';

interface Props {
  phase: Phase;
  previewUrl: string | null;
  previewExpired: boolean;
  error: string | null;
  onReset: () => void;
}

type PreviewState = 'idle' | 'deploying' | 'live' | 'error' | 'expired';

function resolveState(
  phase: Phase,
  previewUrl: string | null,
  previewExpired: boolean,
): PreviewState {
  if (phase === 'error') return 'error';
  if (previewExpired) return 'expired';
  if (previewUrl) return 'live';
  if (phase === 'deploying') return 'deploying';
  return 'idle';
}

export function PreviewTab({ phase, previewUrl, previewExpired, error, onReset }: Props) {
  const view = resolveState(phase, previewUrl, previewExpired);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!previewUrl) setLoaded(false);
  }, [previewUrl]);

  return (
    <div className="tab-content">
      <BrowserChrome url={view === 'expired' ? null : previewUrl} />
      <div className={`preview ${view === 'error' ? 'preview__placeholder--error' : ''}`}>
        {view === 'live' && previewUrl && (
          <iframe
            className={`preview__iframe ${loaded ? 'preview__iframe--loaded' : ''}`}
            src={previewUrl}
            title="App preview"
            allow="cross-origin-isolated"
            onLoad={() => setLoaded(true)}
          />
        )}

        {view === 'idle' && (
          <div className="preview__placeholder">
            <BracketsIcon size={64} color="var(--text-muted)" />
            <span className="preview__ph-label">Your app will appear here</span>
          </div>
        )}

        {view === 'deploying' && (
          <div className="preview__placeholder">
            <LoaderIcon size={32} color="var(--accent-amber)" className="spinner" />
            <span className="preview__ph-label">Deploying your app…</span>
            <span className="preview__ph-sublabel">pip install + uvicorn starting</span>
          </div>
        )}

        {view === 'expired' && (
          <div className="preview__placeholder">
            <BracketsIcon size={48} color="var(--text-muted)" />
            <span className="preview__ph-label">Preview sandbox closed</span>
            <span className="preview__ph-sublabel">
              Live previews run in a temporary sandbox that shuts down after
              ~10 minutes. Your generated code is saved in the Code tab — press
              Reset to build and preview again.
            </span>
            <button className="ghost-btn" onClick={onReset}>
              Reset
            </button>
          </div>
        )}

        {view === 'error' && (
          <div className="preview__placeholder preview__placeholder--error">
            <AlertIcon size={40} color="var(--accent-red)" />
            <span className="preview__error-msg">
              {error ?? 'Something went wrong while deploying your app.'}
            </span>
            <button className="ghost-btn" onClick={onReset}>
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
