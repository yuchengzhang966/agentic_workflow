import { FileIcon } from '../../icons';
import type { FileEntry } from '../../../lib/types';

interface Props {
  files: FileEntry[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}

export function FileTree({ files, selectedFile, onFileSelect }: Props) {
  if (files.length === 0) {
    return (
      <nav className="filetree" aria-label="Generated files">
        <div className="filetree__empty">
          <FileIcon size={24} color="var(--text-muted)" style={{ display: 'block', margin: '0 auto 12px' }} />
          No files generated yet
        </div>
      </nav>
    );
  }

  return (
    <nav className="filetree" aria-label="Generated files">
      {files
        .slice()
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((file) => (
          <button
            key={file.path}
            className={`filerow filerow--file ${selectedFile === file.path ? 'filerow--selected' : ''}`}
            onClick={() => onFileSelect(file.path)}
            aria-selected={selectedFile === file.path}
            title={file.path}
          >
            <FileIcon size={14} color="var(--text-muted)" />
            <span className="filerow__name">{getFileName(file.path)}</span>
          </button>
        ))}
    </nav>
  );
}

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}