import type { Phase } from '../../lib/types';
import { LoaderIcon, XIcon } from '../icons';

interface BadgeSpec {
  label: string;
  dot: string;
  cls: string;
  pulse: boolean;
  spinner?: boolean;
  error?: boolean;
}

const MAP: Record<Phase, BadgeSpec | null> = {
  idle: null,
  researching: { label: 'Researching', dot: 'var(--accent-purple)', cls: '', pulse: true },
  awaiting_approval: {
    label: 'Awaiting Approval',
    dot: 'var(--accent-amber)',
    cls: '',
    pulse: true,
  },
  engineering: { label: 'Building', dot: 'var(--accent-cyan)', cls: '', pulse: true },
  deploying: {
    label: 'Deploying…',
    dot: 'var(--accent-amber)',
    cls: '',
    pulse: false,
    spinner: true,
  },
  reviewing: { label: 'Live', dot: 'var(--accent-green)', cls: 'badge--live', pulse: false },
  done: { label: 'Live', dot: 'var(--accent-green)', cls: 'badge--live', pulse: false },
  error: { label: 'Error', dot: 'var(--accent-red)', cls: 'badge--error', pulse: false, error: true },
};

export function StatusBadge({ phase }: { phase: Phase }) {
  const spec = MAP[phase];
  if (!spec) return null;

  return (
    <span className={`badge ${spec.cls}`} aria-label={`Pipeline status: ${spec.label}`}>
      {spec.error ? (
        <XIcon size={11} color="var(--accent-red)" />
      ) : spec.spinner ? (
        <LoaderIcon size={12} color={spec.dot} className="spinner" />
      ) : (
        <span
          className={`badge__dot ${spec.pulse ? 'badge__dot--pulse' : ''}`}
          style={{ background: spec.dot }}
        />
      )}
      {spec.label}
    </span>
  );
}
