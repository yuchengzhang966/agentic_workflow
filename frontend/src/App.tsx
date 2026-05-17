import { usePipeline } from './hooks/usePipeline';
import { AppHeader } from './components/AppHeader';
import { LeftPane } from './components/LeftPane';
import { RightPane } from './components/RightPane';

export default function App() {
  const { state, start, resume, reset, setRightTab, selectFile } = usePipeline();

  const canReset =
    state.phase !== 'idle' && state.phase !== 'researching' && state.phase !== 'engineering';

  return (
    <div className="app">
      <AppHeader
        rightTab={state.rightTab}
        onTabChange={setRightTab}
        onReset={reset}
        canReset={canReset}
        phase={state.phase}
      />
      <div className="app-body">
        <LeftPane state={state} onStart={start} onDecision={resume} onReset={reset} />
        <RightPane state={state} onReset={reset} onFileSelect={selectFile} />
      </div>
    </div>
  );
}