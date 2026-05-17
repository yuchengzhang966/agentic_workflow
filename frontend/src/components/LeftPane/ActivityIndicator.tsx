import { useEffect, useState } from 'react';
import type { Phase } from '../../lib/types';
import { LoaderIcon } from '../icons';

/** Labels for the phases where an agent is actively working. */
const ACTIVE: Partial<Record<Phase, string>> = {
  researching: 'Researcher is analyzing the idea',
  engineering: 'Engineer is writing the code',
  deploying: 'Deploying to a live sandbox',
  reviewing: 'Reviewer is checking the build',
};

/**
 * A persistent "working…" row with a live elapsed timer, shown while an agent
 * is running — so the UI never looks frozen during a quiet stretch.
 */
export function ActivityIndicator({ phase }: { phase: Phase }) {
  const label = ACTIVE[phase];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!ACTIVE[phase]) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (!label) return null;

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="activity" aria-live="polite">
      <LoaderIcon size={14} color="var(--accent-blue)" className="spinner" />
      <span className="activity__label">{label}…</span>
      <span className="activity__time">{`${mm}:${ss}`}</span>
    </div>
  );
}
