import { useState, type ReactNode } from 'react';
import { FileIcon, FolderIcon, ChevronDownIcon, ChevronRightIcon } from '../../icons';
import type { FileEntry } from '../../../lib/types';

interface Props {
  files: FileEntry[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

/** Build a nested tree from flat file paths (e.g. `templates/index.html`). */
function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');
      let child = node.children.find((c) => c.name === part && c.isDir === !isLast);
      if (!child) {
        child = { name: part, path, isDir: !isLast, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  sortTree(root);
  return root.children;
}

/** Folders first, then files; alphabetical within each group. */
function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

export function FileTree({ files, selectedFile, onFileSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (files.length === 0) {
    return (
      <nav className="filetree" aria-label="Generated files">
        <div className="filetree__empty">
          <FileIcon
            size={24}
            color="var(--text-muted)"
            style={{ display: 'block', margin: '0 auto 12px' }}
          />
          No files generated yet
        </div>
      </nav>
    );
  }

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const pad = { paddingLeft: 10 + depth * 14 };

    if (node.isDir) {
      const open = !collapsed.has(node.path);
      return (
        <div key={node.path}>
          <button
            className="filerow filerow--dir"
            style={pad}
            onClick={() => toggle(node.path)}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDownIcon size={12} color="var(--text-muted)" />
            ) : (
              <ChevronRightIcon size={12} color="var(--text-muted)" />
            )}
            <FolderIcon size={14} color="var(--accent-blue)" />
            <span className="filerow__name">{node.name}</span>
          </button>
          {open && node.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        className={`filerow filerow--file ${selectedFile === node.path ? 'filerow--selected' : ''}`}
        style={pad}
        onClick={() => onFileSelect(node.path)}
        aria-selected={selectedFile === node.path}
        title={node.path}
      >
        <FileIcon size={14} color="var(--text-muted)" />
        <span className="filerow__name">{node.name}</span>
      </button>
    );
  };

  return (
    <nav className="filetree" aria-label="Generated files">
      {buildTree(files).map((node) => renderNode(node, 0))}
    </nav>
  );
}
