import { Fragment } from 'react';
import type { Phase, PipelineState } from '../../lib/types';

const STAGES = ['researcher', 'gate', 'engineer', 'reviewer', 'done'] as const;
const LABELS = ['Researcher', 'Gate', 'Engineer', 'Reviewer', 'Done'];

type DotState = 'done' | 'active' | 'pending' | 'error';

/** completed-stage count + currently-active stage index for a phase. */
function progress(phase: Phase): { completed: number; active: number } {
  switch (phase) {
    case 'researching':
      return { completed: 0, active: 0 };
    case 'awaiting_approval':
      return { completed: 1, active: 1 };
    case 'engineering':
      return { completed: 2, active: 2 };
    case 'deploying':
      return { completed: 3, active: -1 }; // runner is a sub-step — no dot
    case 'reviewing':
      return { completed: 3, active: 3 };
    case 'done':
      return { completed: 5, active: -1 };
    default:
      return { completed: 0, active: -1 };
  }
}

const ERROR_INDEX: Record<string, number> = {
  researcher: 0,
  gate: 1,
  engineer: 2,
  reviewer: 3,
};

export function PipelineIndicator({ state }: { state: PipelineState }) {
  const errorIdx =
    state.phase === 'error' && state.errorStage ? ERROR_INDEX[state.errorStage] ?? -1 : -1;
  const { completed, active } =
    state.phase === 'error' ? { completed: errorIdx, active: -1 } : progress(state.phase);

  function dotState(i: number): DotState {
    if (i === errorIdx) return 'error';
    if (i < completed) return 'done';
    if (i === active) return 'active';
    return 'pending';
  }

  return (
    <div className="pipeline">
      <div className="pipeline__rail">
        {STAGES.map((stage, i) => {
          const ds = dotState(i);
          return (
            <Fragment key={stage}>
              <div className="pipeline__stage">
                <span
                  className={[
                    'pipeline__dot',
                    `pipeline__dot--${ds}`,
                    stage === 'gate' ? 'pipeline__dot--gate' : '',
                  ].join(' ')}
                />
                <span
                  className={`pipeline__label ${
                    ds === 'active' || ds === 'done' ? 'pipeline__label--active' : ''
                  }`}
                >
                  {LABELS[i]}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span className={`pipeline__line ${i < completed ? 'pipeline__line--done' : ''}`} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
