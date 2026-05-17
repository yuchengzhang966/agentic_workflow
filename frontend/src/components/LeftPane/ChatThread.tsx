import { useEffect, useRef, useState } from 'react';
import type { ThreadItem } from '../../lib/types';
import { AgentMessage } from './AgentMessage';
import { HumanGate } from './HumanGate';
import { BracketsIcon } from '../icons';

interface Props {
  thread: ThreadItem[];
  onDecision: (gateId: string, decision: 'approve' | 'reject', feedback?: string) => void;
}

export function ChatThread({ thread, onDecision }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showChip, setShowChip] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinned.current) {
      el.scrollTop = el.scrollHeight;
      setShowChip(false);
    } else {
      setShowChip(true);
    }
  }, [thread]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinned.current = distance < 80;
    if (pinned.current) setShowChip(false);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    pinned.current = true;
    setShowChip(false);
  }

  return (
    <div className="thread" ref={scrollRef} onScroll={handleScroll} aria-live="polite">
      {thread.length === 0 ? (
        <div className="thread__empty">
          <BracketsIcon size={40} className="thread__empty-icon" />
          Enter an idea below and watch your agent team build it live.
        </div>
      ) : (
        thread.map((item, i) => {
          if (item.kind === 'gate') {
            return <HumanGate key={item.id} gate={item} onDecision={onDecision} />;
          }
          const prev = thread[i - 1];
          const compact =
            !!prev && prev.kind === 'message' && prev.agent === item.agent;
          return <AgentMessage key={item.id} message={item} compact={compact} />;
        })
      )}

      {showChip && (
        <button className="new-msg-chip" onClick={jumpToBottom}>
          ↓ New messages
        </button>
      )}
    </div>
  );
}
