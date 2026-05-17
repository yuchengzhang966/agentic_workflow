/**
 * Minimal single-pass tokenizer for the file viewer + in-message code blocks.
 * Not a full syntax theme — just strings / comments / keywords, per design.md.
 */
export type Token = { text: string; cls: 'tok-cm' | 'tok-str' | 'tok-kw' | 'tok-pl' };

const RULES: { re: RegExp; cls: Token['cls'] }[] = [
  { re: /^#[^\n]*/, cls: 'tok-cm' },
  { re: /^\/\/[^\n]*/, cls: 'tok-cm' },
  { re: /^"(?:[^"\\]|\\.)*"?/, cls: 'tok-str' },
  { re: /^'(?:[^'\\]|\\.)*'?/, cls: 'tok-str' },
  { re: /^`(?:[^`\\]|\\.)*`?/, cls: 'tok-str' },
  {
    re: /^\b(?:from|import|def|class|return|if|elif|else|for|while|async|await|with|as|in|not|and|or|is|lambda|try|except|finally|raise|const|let|var|function|export|default|new|typeof|true|false|null|True|False|None)\b/,
    cls: 'tok-kw',
  },
];

/** Tokenize a single line of code into colored spans. */
export function tokenizeLine(line: string): Token[] {
  const out: Token[] = [];
  let plain = '';
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    let hit: Token | null = null;
    for (const { re, cls } of RULES) {
      const m = re.exec(rest);
      if (m && m[0].length > 0) {
        hit = { text: m[0], cls };
        break;
      }
    }
    if (hit) {
      if (plain) {
        out.push({ text: plain, cls: 'tok-pl' });
        plain = '';
      }
      out.push(hit);
      i += hit.text.length;
    } else {
      plain += line[i];
      i += 1;
    }
  }
  if (plain) out.push({ text: plain, cls: 'tok-pl' });
  return out;
}

/** Split message text into plain segments and fenced ``` code blocks. */
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'code'; lang: string; code: string };

export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ kind: 'text', text: text.slice(last, m.index) });
    }
    segments.push({ kind: 'code', lang: m[1].trim(), code: m[2].replace(/\n$/, '') });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: 'text', text: text.slice(last) });
  }
  return segments;
}
