import { Alert, Button, Card, Input, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { usePipeline } from './hooks/usePipeline';
import { PipelineViz } from './components/PipelineViz';
import { TerminalPanel } from './components/TerminalPanel';
import { PRDPanel } from './components/PRDPanel';
import { CodePanel } from './components/CodePanel';
import { ReviewPanel } from './components/ReviewPanel';

const EXAMPLE_IDEA = 'A pomodoro timer with task tracking and configurable work/break intervals.';

export default function App() {
  const [idea, setIdea] = useState(EXAMPLE_IDEA);
  const { state, start, resume, reset } = usePipeline();

  const running = state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error';
  const canStart = !running && idea.trim().length > 0;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 64px' }}>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>
        Atoms Demo — Multi-Agent Pipeline
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Researcher → Human Gate → Engineer ↔ Reviewer. Live streaming via FastAPI + LangGraph.
      </Typography.Paragraph>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            rows={2}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe a product idea…"
            disabled={running}
          />
          <Space>
            <Button type="primary" onClick={() => start(idea.trim())} disabled={!canStart} loading={running}>
              Run Pipeline
            </Button>
            <Button onClick={reset} disabled={running}>
              Reset
            </Button>
            {state.phase === 'done' && state.elapsed !== null && (
              <Tag color="blue">{`Done in ${state.elapsed}s · ${state.attempts} attempt${state.attempts === 1 ? '' : 's'}`}</Tag>
            )}
          </Space>
        </Space>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <PipelineViz phase={state.phase} activeNode={state.activeNode} loopCount={state.loopCount} />
      </Card>

      {state.phase === 'error' && state.error && (
        <Alert type="error" message="Pipeline error" description={state.error} style={{ marginBottom: 12 }} showIcon />
      )}

      <TerminalPanel
        title="Researcher"
        text={state.researcherText}
        active={state.activeNode === 'researcher'}
        empty="Researcher output will stream here."
      />

      {(state.prd || state.phase === 'awaiting_approval') && (
        <PRDPanel
          prd={state.prd}
          awaitingApproval={state.phase === 'awaiting_approval'}
          onDecision={resume}
        />
      )}

      {(state.engineerText || state.code || state.phase === 'engineering') && (
        <CodePanel
          text={state.engineerText}
          finalCode={state.code}
          active={state.activeNode === 'engineer'}
        />
      )}

      <ReviewPanel score={state.score} issues={state.issues} />
    </div>
  );
}
