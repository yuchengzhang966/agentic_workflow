import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import type { FileEntry } from '../../../lib/types';

interface Props {
  files: FileEntry[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}

export function CodeTab({ files, selectedFile, onFileSelect }: Props) {
  const selected = files.find((f) => f.path === selectedFile) ?? null;

  return (
    <div className="codetab">
      <FileTree files={files} selectedFile={selectedFile} onFileSelect={onFileSelect} />
      <FileViewer file={selected} />
    </div>
  );
}