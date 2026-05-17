import { Steps } from 'antd';
import type { NodeName, Phase } from '../hooks/usePipeline';

interface Props {
  phase: Phase;
  activeNode: NodeName | null;
  loopCount: number;
}

const NODES: { key: NodeName | 'done'; title: string }[] = [
  { key: 'researcher', title: 'Researcher' },
  { key: 'human_gate', title: 'Human Gate' },
  { key: 'engineer', title: 'Engineer' },
  { key: 'reviewer', title: 'Reviewer' },
  { key: 'done', title: 'Done' },
];

function currentIndex(phase: Phase, activeNode: NodeName | null): number {
  if (phase === 'done') return 4;
  if (phase === 'error') return -1;
  if (activeNode === 'researcher') return 0;
  if (activeNode === 'human_gate' || phase === 'awaiting_approval') return 1;
  if (activeNode === 'engineer') return 2;
  if (activeNode === 'reviewer') return 3;
  return 0;
}

export function PipelineViz({ phase, activeNode, loopCount }: Props) {
  const current = currentIndex(phase, activeNode);
  const items = NODES.map((n, i) => ({
    title: n.title,
    description:
      n.key === 'engineer' && loopCount > 0
        ? `loop ×${loopCount + 1}`
        : i === current && phase !== 'done' && phase !== 'error'
        ? 'running…'
        : undefined,
  }));

  return (
    <Steps
      current={current < 0 ? 0 : current}
      status={phase === 'error' ? 'error' : phase === 'done' ? 'finish' : 'process'}
      items={items}
      size="small"
    />
  );
}
