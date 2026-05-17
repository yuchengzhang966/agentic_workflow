import { Card, Spin } from 'antd';
import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  text: string;
  active: boolean;
  empty?: string;
}

export function TerminalPanel({ title, text, active, empty }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);

  return (
    <Card
      size="small"
      title={title}
      extra={active ? <Spin size="small" /> : null}
      style={{ marginBottom: 12 }}
    >
      <pre ref={ref} className="stream-pre">
        {text || empty || '—'}
      </pre>
    </Card>
  );
}
