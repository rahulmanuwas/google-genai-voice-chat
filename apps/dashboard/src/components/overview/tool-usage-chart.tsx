'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ToolUsageChartProps {
  toolUsage: Record<string, number>;
}

export function ToolUsageChart({ toolUsage }: ToolUsageChartProps) {
  const data = Object.entries(toolUsage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tool Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No tool executions yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tool Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" stroke="hsl(0 0% 63.9%)" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="hsl(0 0% 63.9%)" fontSize={12} width={100} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0 0% 3.9%)',
                border: '1px solid hsl(0 0% 14.9%)',
                borderRadius: '0.5rem',
                color: 'hsl(0 0% 98%)',
              }}
            />
            <Bar dataKey="count" fill="hsl(220 70% 50%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
