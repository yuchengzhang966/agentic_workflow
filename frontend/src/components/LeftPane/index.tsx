import type { PipelineState } from '../../lib/types';
import { PipelineIndicator } from './PipelineIndicator';
import { ChatThread } from './ChatThread';
import { Composer } from './Composer';

interface Props {
  state: PipelineState;
  onStart: (idea: string) => void;
  onDecision: (gateId: string, decision: 'approve' | 'reject', feedback?: string) => void;
  onReset: () => void;
}

export function LeftPane({ state, onStart, onDecision, onReset }: Props) {
  return (
    <section className="left-pane" aria-label="Agent conversation">
      <PipelineIndicator state={state} />
      <ChatThread thread={state.thread} onDecision={onDecision} />
      <Composer phase={state.phase} onStart={onStart} onReset={onReset} />
    </section>
  );
}
