import { useCallback, useRef, useState } from 'react';

export type NodeName = 'researcher' | 'human_gate' | 'engineer' | 'reviewer';

export type PipelineEvent =
  | { type: 'status'; node: NodeName }
  | { type: 'chunk'; node: NodeName; text: string }
  | { type: 'interrupt'; prd: string }
  | { type: 'score'; score: number; issues: string[] }
  | { type: 'loop'; attempt: number }
  | { type: 'done'; code: string; score: number; issues: string[]; attempts: number; elapsed: number }
  | { type: 'error'; message: string };

export type Phase =
  | 'idle'
  | 'researching'
  | 'awaiting_approval'
  | 'engineering'
  | 'reviewing'
  | 'done'
  | 'error';

export interface PipelineState {
  phase: Phase;
  activeNode: NodeName | null;
  researcherText: string;
  prd: string;
  engineerText: string;
  code: string;
  score: number | null;
  issues: string[];
  attempts: number;
  loopCount: number;
  elapsed: number | null;
  error: string | null;
  threadId: string | null;
}

const initialState: PipelineState = {
  phase: 'idle',
  activeNode: null,
  researcherText: '',
  prd: '',
  engineerText: '',
  code: '',
  score: null,
  issues: [],
  attempts: 0,
  loopCount: 0,
  elapsed: null,
  error: null,
  threadId: null,
};

async function consumeSSE(
  url: string,
  body: unknown,
  onEvent: (ev: PipelineEvent) => void,
  abortSignal: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  // sse-starlette (the backend) separates SSE frames with CRLF — a frame ends
  // with \r\n\r\n, not \n\n. Match any spec-valid blank-line separator so the
  // parser works regardless of line endings, and keep raw bytes buffered so a
  // separator split across network chunk boundaries is still reassembled.
  const FRAME_SEP = /\r\n\r\n|\r\r|\n\n/;
  const LINE_SEP = /\r\n|\r|\n/;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let match: RegExpExecArray | null;
    while ((match = FRAME_SEP.exec(buf)) !== null) {
      const frame = buf.slice(0, match.index);
      buf = buf.slice(match.index + match[0].length);
      for (const line of frame.split(LINE_SEP)) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          try {
            onEvent(JSON.parse(payload) as PipelineEvent);
          } catch {
            // ignore malformed
          }
        }
      }
    }
  }
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const approveLockRef = useRef(false);

  const handleEvent = useCallback((ev: PipelineEvent) => {
    setState((s) => {
      switch (ev.type) {
        case 'status': {
          const phase: Phase =
            ev.node === 'researcher'
              ? 'researching'
              : ev.node === 'human_gate'
              ? s.prd
                ? 'awaiting_approval'
                : 'researching'
              : ev.node === 'engineer'
              ? 'engineering'
              : 'reviewing';
          return { ...s, activeNode: ev.node, phase };
        }
        case 'chunk':
          if (ev.node === 'researcher') {
            return { ...s, researcherText: s.researcherText + ev.text };
          }
          if (ev.node === 'engineer') {
            return { ...s, engineerText: s.engineerText + ev.text };
          }
          return s;
        case 'interrupt':
          return { ...s, prd: ev.prd, phase: 'awaiting_approval', activeNode: 'human_gate' };
        case 'score':
          return { ...s, score: ev.score, issues: ev.issues };
        case 'loop':
          return { ...s, loopCount: s.loopCount + 1, engineerText: '' };
        case 'done':
          return {
            ...s,
            phase: 'done',
            activeNode: null,
            code: ev.code,
            score: ev.score,
            issues: ev.issues,
            attempts: ev.attempts,
            elapsed: ev.elapsed,
          };
        case 'error':
          return { ...s, phase: 'error', error: ev.message, activeNode: null };
        default:
          return s;
      }
    });
  }, []);

  const start = useCallback(
    async (idea: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      approveLockRef.current = false;

      const threadId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setState({ ...initialState, phase: 'researching', activeNode: 'researcher', threadId });

      try {
        await consumeSSE('/pipeline/start', { idea, thread_id: threadId }, handleEvent, ctrl.signal);
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setState((s) => ({ ...s, phase: 'error', error: (err as Error).message }));
        }
      }
    },
    [handleEvent],
  );

  const resume = useCallback(
    async (decision: 'approve' | 'reject', feedback?: string) => {
      if (approveLockRef.current) return;
      approveLockRef.current = true;
      const threadId = state.threadId;
      if (!threadId) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setState((s) => ({ ...s, phase: 'engineering', activeNode: 'engineer', engineerText: '' }));

      try {
        await consumeSSE(
          '/pipeline/resume',
          { thread_id: threadId, decision, feedback },
          handleEvent,
          ctrl.signal,
        );
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setState((s) => ({ ...s, phase: 'error', error: (err as Error).message }));
        }
      }
    },
    [handleEvent, state.threadId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    approveLockRef.current = false;
    setState(initialState);
  }, []);

  return { state, start, resume, reset };
}
