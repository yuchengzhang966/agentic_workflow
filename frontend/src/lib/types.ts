/** Shared types for the workspace pipeline state. */

export type AgentId = 'researcher' | 'engineer' | 'reviewer' | 'system';

export type Phase =
  | 'idle'
  | 'researching'
  | 'awaiting_approval'
  | 'engineering'
  | 'deploying'
  | 'reviewing'
  | 'done'
  | 'error';

export type RightTab = 'preview' | 'code';
export type GateState = 'awaiting' | 'approved' | 'rejected';

export interface ChatMessage {
  id: string;
  kind: 'message';
  agent: AgentId;
  text: string;
  ts: number;
  streaming: boolean;
}

export interface GateItem {
  id: string;
  kind: 'gate';
  title: string;
  description: string;
  prd: string;
  state: GateState;
  ts: number;
  decidedAt: number | null;
}

export type ThreadItem = ChatMessage | GateItem;

export interface FileEntry {
  path: string;
  content: string;
  ts: number;
}

export interface PipelineState {
  phase: Phase;
  /** stage that failed, set only when phase === 'error' */
  errorStage: AgentId | 'gate' | null;
  thread: ThreadItem[];
  files: FileEntry[];
  selectedFile: string | null;
  previewUrl: string | null;
  score: number | null;
  issues: string[];
  error: string | null;
  threadId: string | null;
  rightTab: RightTab;
}

/** SSE event shapes emitted by the backend pipeline. */
export type PipelineEvent =
  | { type: 'status'; node: string }
  | { type: 'chunk'; node: string; text: string }
  | { type: 'file'; path: string; content: string }
  | { type: 'preview'; url: string }
  | { type: 'deploy_status'; message?: string; status?: string }
  | { type: 'interrupt'; prd: string }
  | { type: 'score'; score: number; issues?: string[]; feedback?: string }
  | { type: 'done'; [k: string]: unknown }
  | { type: 'error'; message: string };
