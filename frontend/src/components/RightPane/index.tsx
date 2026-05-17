import { type RightTab, type PipelineState } from '../../lib/types';
import { PreviewTab } from './PreviewTab';
import { CodeTab } from './CodeTab';

interface Props {
  state: PipelineState;
  onReset: () => void;
  onTabChange: (tab: RightTab) => void;
  onFileSelect: (path: string) => void;
}

export function RightPane({ state, onReset, onTabChange, onFileSelect }: Props) {
  const { phase, previewUrl, error, files, selectedFile, rightTab } = state;

  return (
    <section className="right-pane" aria-label="Preview and code">
      <div className="right-pane__tabs">
        <button
          className={`right-pane__tab ${rightTab === 'preview' ? 'right-pane__tab--active' : ''}`}
          onClick={() => onTabChange('preview')}
          aria-pressed={rightTab === 'preview'}
        >
          Preview
        </button>
        <button
          className={`right-pane__tab ${rightTab === 'code' ? 'right-pane__tab--active' : ''}`}
          onClick={() => onTabChange('code')}
          aria-pressed={rightTab === 'code'}
        >
          Code
        </button>
      </div>

      <div className="right-pane__content">
        {rightTab === 'preview' ? (
          <PreviewTab phase={phase} previewUrl={previewUrl} error={error} onReset={onReset} />
        ) : (
          <CodeTab files={files} selectedFile={selectedFile} onFileSelect={onFileSelect} />
        )}
      </div>
    </section>
  );
}