import { useEffect, useState } from 'react';
import type { Phase } from '../../lib/types';
import { BrowserChrome } from './BrowserChrome';
import { AlertIcon, BracketsIcon, LoaderIcon } from '../icons';

interface Props {
  phase: Phase;
  previewUrl: string | null;
  error: string | null;
  onReset: () => void;
}

type PreviewState = 'idle' | 'deploying' | 'live' | 'error';

function resolveState(phase: Phase, previewUrl: string | null): PreviewState {
  if (phase === 'error') return 'error';
  if (previewUrl) return 'live';
  if (phase === 'deploying') return 'deploying';
  return 'idle';
}

export function PreviewTab({ phase, previewUrl, error, onReset }: Props) {
  const view = resolveState(phase, previewUrl);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!previewUrl) setLoaded(false);
  }, [previewUrl]);

  return (
    <div className="tab-content">
      <BrowserChrome url={previewUrl} />
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
