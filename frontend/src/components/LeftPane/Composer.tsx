import { useState } from 'react';
import { Input } from 'antd';
import type { Phase } from '../../lib/types';
import { ArrowRightIcon } from '../icons';

interface Props {
  phase: Phase;
  onStart: (idea: string) => void;
  onReset: () => void;
}

function placeholder(phase: Phase): string {
  switch (phase) {
    case 'idle':
    case 'error':
      return 'Describe your product idea…';
    case 'done':
      return 'Start a new idea…';
    case 'awaiting_approval':
      return 'Waiting for your approval…';
    default:
      return 'Waiting for agents…';
  }
}

export function Composer({ phase, onStart, onReset }: Props) {
  const [idea, setIdea] = useState('');
  const running =
    phase !== 'idle' && phase !== 'done' && phase !== 'error';
  const canSend = !running && idea.trim().length > 0;

  function send() {
    if (!canSend) return;
    onStart(idea.trim());
    setIdea('');
  }

  return (
    <div className="composer">
      <div className="composer__frame">
        <Input.TextArea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder(phase)}
          disabled={running}
          autoSize={{ minRows: 2, maxRows: 6 }}
          style={{ paddingRight: 48, resize: 'none' }}
        />
        <button
          className="composer__send"
          onClick={send}
          disabled={!canSend}
          aria-label="Send idea"
        >
          <ArrowRightIcon size={16} />
        </button>
      </div>
      {phase === 'done' && (
        <button className="composer__restart" onClick={onReset}>
          ← Start over
        </button>
      )}
    </div>
  );
}
