import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentId,
  ChatMessage,
  FileEntry,
  GateItem,
  Phase,
  PipelineEvent,
  PipelineState,
  RightTab,
  ThreadItem,
} from '../lib/types';
import { getFixture, mockResume, mockStart } from '../lib/demo';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const initialState: PipelineState = {
  phase: 'idle',
  errorStage: null,
  thread: [],
  files: [],
  selectedFile: null,
  previewUrl: null,
  previewExpired: false,
  score: null,
  issues: [],
  error: null,
  threadId: null,
  rightTab: 'preview',
};

/** localStorage key for the persisted workspace — survives a browser refresh. */
const STORAGE_KEY = 'atoms-pipeline-state';

/** Map a backend node name onto a chat agent identity. */
function nodeToAgent(node: string): AgentId {
  if (node === 'researcher' || node === 'engineer' || node === 'reviewer') return node;
  return 'system';
}

function phaseForNode(node: string): Phase | null {
  switch (node) {
    case 'researcher':
      return 'researching';
    case 'engineer':
      return 'engineering';
    case 'runner':
      return 'deploying';
    case 'reviewer':
      return 'reviewing';
    default:
      return null; // human_gate is driven by the `interrupt` event
  }
}

function stageForPhase(phase: Phase): AgentId | 'gate' | null {
  switch (phase) {
    case 'researching':
      return 'researcher';
    case 'awaiting_approval':
      return 'gate';
    case 'engineering':
    case 'deploying':
      return 'engineer';
    case 'reviewing':
      return 'reviewer';
    default:
      return null;
  }
}

/** Stop the blinking cursor on any in-flight message. */
function finalizeStreaming(thread: ThreadItem[]): ThreadItem[] {
  return thread.map((item) =>
    item.kind === 'message' && item.streaming ? { ...item, streaming: false } : item,
  );
}

/** Append a token to the current streaming message, or open a new one. */
function appendChunk(thread: ThreadItem[], agent: AgentId, text: string): ThreadItem[] {
  const last = thread[thread.length - 1];
  if (last && last.kind === 'message' && last.agent === agent && last.streaming) {
    return [...thread.slice(0, -1), { ...last, text: last.text + text }];
  }
  const msg: ChatMessage = {
    id: uid('m'),
    kind: 'message',
    agent,
    text,
    ts: Date.now(),
    streaming: true,
  };
  return [...thread, msg];
}

/** Post (or update the last) SYSTEM status message. */
function pushOrUpdateSystem(thread: ThreadItem[], text: string): ThreadItem[] {
  const last = thread[thread.length - 1];
  if (last && last.kind === 'message' && last.agent === 'system' && !last.streaming) {
    return [...thread.slice(0, -1), { ...last, text }];
  }
  const msg: ChatMessage = {
    id: uid('m'),
    kind: 'message',
    agent: 'system',
    text,
    ts: Date.now(),
    streaming: false,
  };
  return [...thread, msg];
}

/** Add or replace a generated file (dedup by path). */
function upsertFile(files: FileEntry[], path: string, content: string): FileEntry[] {
  const idx = files.findIndex((f) => f.path === path);
  if (idx >= 0) {
    const next = files.slice();
    next[idx] = { path, content, ts: Date.now() };
    return next;
  }
  return [...files, { path, content, ts: Date.now() }];
}

function reduce(s: PipelineState, ev: PipelineEvent): PipelineState {
  switch (ev.type) {
    case 'status': {
      const phase = phaseForNode(ev.node);
      return { ...s, thread: finalizeStreaming(s.thread), phase: phase ?? s.phase };
    }
    case 'chunk':
      return { ...s, thread: appendChunk(s.thread, nodeToAgent(ev.node), ev.text) };
    case 'interrupt': {
      const gate: GateItem = {
        id: uid('gate'),
        kind: 'gate',
        title: 'PRD Review',
        description:
          'The researcher has completed the PRD. Review it before the engineer begins building.',
        prd: ev.prd,
        state: 'awaiting',
        ts: Date.now(),
        decidedAt: null,
      };
      return { ...s, thread: [...finalizeStreaming(s.thread), gate], phase: 'awaiting_approval' };
    }
    case 'file': {
      return {
        ...s,
        files: upsertFile(s.files, ev.path, ev.content),
        selectedFile: ev.path,
        rightTab: 'code',
      };
    }
    case 'preview':
      return { ...s, previewUrl: ev.url, previewExpired: false, rightTab: 'preview' };
    case 'deploy_status': {
      const text = ev.message ?? ev.status ?? 'Deploying to sandbox…';
      return { ...s, phase: 'deploying', thread: pushOrUpdateSystem(s.thread, text) };
    }
    case 'score':
      return { ...s, score: ev.score, issues: ev.issues ?? [] };
    case 'done':
      return { ...s, phase: 'done', thread: finalizeStreaming(s.thread) };
    case 'error': {
      const errMsg: ChatMessage = {
        id: uid('m'),
        kind: 'message',
        agent: 'system',
        text: `Pipeline error — ${ev.message}`,
        ts: Date.now(),
        streaming: false,
      };
      return {
        ...s,
        phase: 'error',
        error: ev.message,
        errorStage: stageForPhase(s.phase),
        thread: [...finalizeStreaming(s.thread), errMsg],
      };
    }
    default:
      return s;
  }
}

/**
 * Consume a Server-Sent-Events stream. sse-starlette separates frames with
 * CRLF (`\r\n\r\n`), so we match any spec-valid blank-line separator and keep
 * raw bytes buffered in case a separator straddles a network-chunk boundary.
 */
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
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
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
          try {
            onEvent(JSON.parse(line.slice(6)) as PipelineEvent);
          } catch {
            // ignore malformed frame
          }
        }
      }
    }
  }
}

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const MOCK = params?.has('mock') ?? false;
const FIXTURE = getFixture(params?.get('state'));

/** Restore the workspace saved before a refresh. Any run that was streaming
 * when the page reloaded is no longer live, so its blinking cursors are
 * finalized — the generated code, PRD and preview are what we want back. */
function loadPersisted(): PipelineState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PipelineState;
    return {
      ...saved,
      thread: finalizeStreaming(saved.thread),
      // a restored preview points at an ephemeral sandbox that has almost
      // certainly been torn down — flag it so the UI says so honestly
      previewExpired: !!saved.previewUrl,
    };
  } catch {
    return null;
  }
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>(
    FIXTURE ?? (MOCK ? initialState : loadPersisted() ?? initialState),
  );
  const abortRef = useRef<AbortController | null>(null);
  const decisionLock = useRef(false);

  // Persist the workspace so a browser refresh restores it. Debounced so a
  // burst of streaming tokens doesn't thrash localStorage.
  useEffect(() => {
    if (MOCK || FIXTURE) return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // storage full or unavailable — non-fatal
      }
    }, 400);
    return () => clearTimeout(id);
  }, [state]);

  const handleEvent = useCallback((ev: PipelineEvent) => {
    setState((s) => reduce(s, ev));
  }, []);

  const start = useCallback(
    async (idea: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      decisionLock.current = false;

      const threadId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userMsg: ChatMessage = {
        id: uid('m'),
        kind: 'message',
        agent: 'user',
        text: idea,
        ts: Date.now(),
        streaming: false,
      };
      setState({ ...initialState, phase: 'researching', threadId, thread: [userMsg] });

      try {
        if (MOCK) {
          await mockStart(idea, handleEvent, ctrl.signal);
        } else {
          await consumeSSE('/pipeline/start', { idea, thread_id: threadId }, handleEvent, ctrl.signal);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          handleEvent({ type: 'error', message: (err as Error).message });
        }
      }
    },
    [handleEvent],
  );

  const resume = useCallback(
    async (gateId: string, decision: 'approve' | 'reject', feedback?: string) => {
      if (decisionLock.current) return;
      decisionLock.current = true;

      // record the decision on the gate card immediately (optimistic UI)
      setState((s) => ({
        ...s,
        phase: decision === 'approve' ? 'engineering' : 'idle',
        thread: s.thread.map((item) =>
          item.kind === 'gate' && item.id === gateId
            ? { ...item, state: decision === 'approve' ? 'approved' : 'rejected', decidedAt: Date.now() }
            : item,
        ),
      }));

      if (decision === 'reject') {
        decisionLock.current = false;
        return;
      }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const threadId = state.threadId;

      try {
        if (MOCK) {
          await mockResume(handleEvent, ctrl.signal);
        } else {
          await consumeSSE(
            '/pipeline/resume',
            { thread_id: threadId, decision, feedback },
            handleEvent,
            ctrl.signal,
          );
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          handleEvent({ type: 'error', message: (err as Error).message });
        }
      }
    },
    [handleEvent, state.threadId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    decisionLock.current = false;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(initialState);
  }, []);

  const setRightTab = useCallback((tab: RightTab) => {
    setState((s) => ({ ...s, rightTab: tab }));
  }, []);

  const selectFile = useCallback((path: string) => {
    setState((s) => ({ ...s, selectedFile: path }));
  }, []);

  return { state, start, resume, reset, setRightTab, selectFile };
}
