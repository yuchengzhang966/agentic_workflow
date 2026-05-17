import type { FileEntry } from '../../../lib/types';

interface Props {
  file: FileEntry | null;
}

const KEYWORDS = [
  'import',
  'from',
  'as',
  'def',
  'class',
  'return',
  'if',
  'else',
  'elif',
  'for',
  'in',
  'while',
  'try',
  'except',
  'finally',
  'with',
  'async',
  'await',
  'lambda',
  'yield',
  'pass',
  'break',
  'continue',
  'raise',
  'True',
  'False',
  'None',
  'and',
  'or',
  'not',
  'is',
  'in',
  'self',
  'super',
  'global',
  'nonlocal',
  'assert',
  'del',
  'type',
  'interface',
  'const',
  'let',
  'var',
  'function',
  'export',
  'default',
];

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
            <span className="codeline__code" dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightLine(line: string): string {
  const escaped = escapeHtml(line);
  // Highlight keywords
  const keywordRegex = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'g');
  const withKeywords = escaped.replace(keywordRegex, '<span class="tok-kw">$1</span>');
  // Highlight strings
  const withStrings = withKeywords.replace(
    /(["'])(?:(?=(\\?))\2.)*?\1/g,
    '<span class="tok-str">$&</span>',
  );
  // Highlight comments (Python-style and JS-style)
  const withComments = withStrings.replace(/(#.*$|\/\/.*$)/gm, '<span class="tok-cm">$1</span>');
  return withComments;
}