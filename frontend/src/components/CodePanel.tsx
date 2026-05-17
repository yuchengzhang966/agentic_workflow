import { Button, Card, Space, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  finalCode: string;
  active: boolean;
}

function stripFence(code: string): string {
  let s = code.trim();
  s = s.replace(/^```(?:html)?\s*/i, '');
  s = s.replace(/```$/i, '');
  return s.trim();
}

export function CodePanel({ text, finalCode, active }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [text]);

  const display = finalCode || text;
  const previewable = !!finalCode;
  const cleanCode = stripFence(display);

  return (
    <Card
      size="small"
      title="Engineer"
      extra={
        <Space>
          {active && <Spin size="small" />}
          {previewable && (
            <Button size="small" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? 'Show Code' : 'Preview App'}
            </Button>
          )}
        </Space>
      }
      style={{ marginBottom: 12 }}
    >
      {showPreview && previewable ? (
        <iframe
          title="Generated app preview"
          srcDoc={cleanCode}
          sandbox="allow-scripts"
          style={{ width: '100%', height: 480, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}
        />
      ) : (
        <pre ref={preRef} className="stream-pre">
          {display || '—'}
        </pre>
      )}
    </Card>
  );
}
