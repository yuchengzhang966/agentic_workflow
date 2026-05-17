import type { FileEntry } from '../../../lib/types';
import { tokenizeLine } from '../../../lib/highlight';

interface Props {
  file: FileEntry | null;
}

export function FileViewer({ file }: Props) {
  if (!file) {
    return (
      <div className="fileviewer">
        <div className="fileviewer__empty">Select a file to view its content</div>
      </div>
    );
  }

  const lines = file.content.split('\n');

  return (
    <div className="fileviewer">
      <div className="fileviewer__head">
        <span className="filerow__name">{file.path}</span>
      </div>
      <div className="fileviewer__body">
        {lines.map((line, i) => (
          <div key={i} className="codeline">
            <span className="codeline__num">{i + 1}</span>
            <span className="codeline__code">
              {tokenizeLine(line).map((t, j) => (
                <span key={j} className={t.cls}>
                  {t.text}
                </span>
              ))}
              {line === '' ? '​' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
