import { Alert, Button, Card, Input, Space } from 'antd';
import { useState } from 'react';

interface Props {
  prd: string;
  awaitingApproval: boolean;
  onDecision: (decision: 'approve' | 'reject', feedback?: string) => void;
}

export function PRDPanel({ prd, awaitingApproval, onDecision }: Props) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = (decision: 'approve' | 'reject') => {
    if (submitting) return;
    setSubmitting(true);
    onDecision(decision, decision === 'reject' ? feedback : undefined);
  };

  return (
    <Card
      size="small"
      title="Human Gate — PRD Review"
      style={{ marginBottom: 12 }}
      extra={
        awaitingApproval ? (
          <Alert type="warning" showIcon banner message="Waiting for your decision" style={{ padding: '2px 8px' }} />
        ) : null
      }
    >
      <pre className="prd-pre">{prd || 'PRD will appear here once researcher completes.'}</pre>
      {awaitingApproval && (
        <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
          <Input.TextArea
            rows={2}
            placeholder="Optional feedback for Request Changes…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <Space>
            <Button type="primary" onClick={() => submit('approve')} disabled={submitting}>
              Approve
            </Button>
            <Button onClick={() => submit('reject')} disabled={submitting}>
              Request Changes
            </Button>
          </Space>
        </Space>
      )}
    </Card>
  );
}
