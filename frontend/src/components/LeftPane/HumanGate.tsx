import { useState } from 'react';
import { Input } from 'antd';
import type { GateItem } from '../../lib/types';
import { CheckIcon, GearIcon, XIcon } from '../icons';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Common PRD-revision asks — one click fills the feedback box. */
const QUICK_FEEDBACK = [
  'Scope is too broad — simplify it',
  'Needs more detail on the core feature',
  'Wrong target user',
  'Focus on fewer features',
];

interface Props {
  gate: GateItem;
  onDecision: (gateId: string, decision: 'approve' | 'reject', feedback?: string) => void;
}

export function HumanGate({ gate, onDecision }: Props) {
  const [feedback, setFeedback] = useState('');
  const awaiting = gate.state === 'awaiting';

  return (
    <div className="msg">
      <div className="msg__avatar" style={{ background: 'rgba(139,148,158,0.2)' }}>
        <GearIcon size={14} color="var(--text-secondary)" />
      </div>
      <div className="msg__body">
        <div className="msg__head">
          <span className="msg__name" style={{ color: 'var(--text-secondary)' }}>
            SYSTEM
          </span>
          <span className="msg__time">{formatTime(gate.ts)}</span>
        </div>

        <div className={`gate gate--${gate.state}`} role="dialog" aria-label={gate.title}>
          <div className="gate__title">🔍 {gate.title}</div>
          <div className="gate__desc">{gate.description}</div>

          {awaiting ? (
            <>
              <div className="gate__quick">
                {QUICK_FEEDBACK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`gate__chip ${feedback === q ? 'gate__chip--active' : ''}`}
                    onClick={() => setFeedback(feedback === q ? '' : q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <Input.TextArea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Pick an option above, or write your own feedback…"
                autoSize={{ minRows: 2, maxRows: 5 }}
                style={{ background: 'var(--bg-base)' }}
              />
              <div className="gate__actions">
                <button
                  className="gate__btn gate__btn--approve"
                  onClick={() => onDecision(gate.id, 'approve', feedback.trim() || undefined)}
                >
                  <CheckIcon size={15} />
                  Approve
                </button>
                <button
                  className="gate__btn gate__btn--reject"
                  onClick={() => onDecision(gate.id, 'reject', feedback.trim() || undefined)}
                >
                  <XIcon size={15} />
                  Request Changes
                </button>
              </div>
            </>
          ) : (
            <div
              className={`gate__status gate__status--${gate.state}`}
              aria-live="polite"
            >
              {gate.state === 'approved' ? '✓ Approved by you' : '✗ Changes requested'}
              {gate.decidedAt ? ` — ${formatTime(gate.decidedAt)}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
