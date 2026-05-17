import { useState } from 'react';
import type { AgentId, ChatMessage } from '../../lib/types';
import { parseSegments, tokenizeLine } from '../../lib/highlight';
import { CheckIcon, CopyIcon, GearIcon } from '../icons';

interface Identity {
  label: string;
  color: string;
  initial: string;
}

const IDENTITY: Record<AgentId, Identity> = {
  researcher: { label: 'RESEARCHER', color: 'var(--accent-purple)', initial: 'R' },
  engineer: { label: 'ENGINEER', color: 'var(--accent-cyan)', initial: 'E' },
  reviewer: { label: 'REVIEWER', color: 'var(--accent-orange)', initial: 'V' },
  system: { label: 'SYSTEM', color: 'var(--text-secondary)', initial: '' },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="icon-btn"
      aria-label="Copy to clipboard"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <CheckIcon size={14} color="var(--accent-green)" /> : <CopyIcon size={14} />}
    </button>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="codeblock">
      <div className="codeblock__head">
        <span>{lang || 'code'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="codeblock__body">
        {code.split('\n').map((line, i) => (
          <div key={i}>
            {tokenizeLine(line).map((t, j) => (
              <span key={j} className={t.cls}>
                {t.text}
              </span>
            ))}
            {line === '' ? '​' : ''}
          </div>
        ))}
      </pre>
    </div>
  );
}

interface Props {
  message: ChatMessage;
  compact: boolean;
}

export function AgentMessage({ message, compact }: Props) {
  const id = IDENTITY[message.agent];
  const segments = parseSegments(message.text);

  return (
    <div className={`msg ${compact ? 'msg--compact' : ''}`}>
      {compact ? (
        <div className="msg__avatar msg__avatar--spacer" />
      ) : (
        <div
          className="msg__avatar"
          style={{
            background: `color-mix(in srgb, ${id.color} 20%, transparent)`,
            color: id.color,
          }}
        >
          {message.agent === 'system' ? <GearIcon size={14} color={id.color} /> : id.initial}
        </div>
      )}

      <div className="msg__body">
        {!compact && (
          <div className="msg__head">
            <span className="msg__name" style={{ color: id.color }}>
              {id.label}
            </span>
            <span className="msg__time">{formatTime(message.ts)}</span>
          </div>
        )}
        <div className="msg__bubble">
          {segments.map((seg, i) =>
            seg.kind === 'code' ? (
              <CodeBlock key={i} lang={seg.lang} code={seg.code} />
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
          {message.streaming && <span className="streaming-cursor" />}
        </div>
      </div>
    </div>
  );
}
