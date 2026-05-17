import { type PipelineState } from '../../lib/types';
import { PreviewTab } from './PreviewTab';
import { CodeTab } from './CodeTab';

interface Props {
  state: PipelineState;
  onReset: () => void;
  onFileSelect: (path: string) => void;
}

export function RightPane({ state, onReset, onFileSelect }: Props) {
  const { phase, previewHtml, error, files, selectedFile, rightTab } = state;

  return (
    <section className="right-pane" aria-label="Preview and code">
      <div className="right-pane__content">
        {rightTab === 'preview' ? (
          <PreviewTab phase={phase} previewHtml={previewHtml} error={error} onReset={onReset} />
        ) : (
          <CodeTab files={files} selectedFile={selectedFile} onFileSelect={onFileSelect} />
        )}
      </div>
    </section>
  );
}