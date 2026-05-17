import { Card, List, Tag } from 'antd';

interface Props {
  score: number | null;
  issues: string[];
}

export function ReviewPanel({ score, issues }: Props) {
  if (score === null) return null;
  const color = score >= 8 ? 'green' : score >= 5 ? 'gold' : 'red';
  return (
    <Card
      size="small"
      title="Reviewer"
      extra={<Tag color={color} style={{ fontSize: 14 }}>{`Score: ${score}/10`}</Tag>}
      style={{ marginBottom: 12 }}
    >
      {issues.length === 0 ? (
        <span style={{ color: '#52c41a' }}>No issues raised.</span>
      ) : (
        <List
          size="small"
          dataSource={issues}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      )}
    </Card>
  );
}
