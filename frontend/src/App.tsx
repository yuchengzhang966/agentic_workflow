import { useCallback, useState } from 'react';
import { usePipeline } from './hooks/usePipeline';
import { AppHeader } from './components/AppHeader';
import { LeftPane } from './components/LeftPane';
import { RightPane } from './components/RightPane';
import { Onboarding } from './components/Onboarding';

const MIN_LEFT = 280;
const MAX_LEFT = 680;

export default function App() {
  const { state, start, resume, reset, setRightTab, selectFile } = usePipeline();
  const [leftWidth, setLeftWidth] = useState(360);

  const canReset =
    state.phase !== 'idle' && state.phase !== 'researching' && state.phase !== 'engineering';

  // Drag the divider to resize the chat sidebar.
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      setLeftWidth(Math.min(MAX_LEFT, Math.max(MIN_LEFT, ev.clientX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.classList.add('resizing');
  }, []);

  // First run: full-screen onboarding prompt until the first idea is submitted.
  if (state.phase === 'idle' && state.thread.length === 0) {
    return <Onboarding onStart={start} />;
  }

  return (
    <div className="app">
      <AppHeader
        rightTab={state.rightTab}
        onTabChange={setRightTab}
        onReset={reset}
        canReset={canReset}
        phase={state.phase}
      />
      <div className="app-body" style={{ '--left-w': `${leftWidth}px` } as React.CSSProperties}>
        <LeftPane state={state} onStart={start} onDecision={resume} onReset={reset} />
        <div
          className="resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat sidebar"
          onMouseDown={startResize}
        />
        <RightPane state={state} onReset={reset} onFileSelect={selectFile} />
      </div>
    </div>
  );
}
