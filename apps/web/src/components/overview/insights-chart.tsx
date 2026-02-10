'use client';

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Insight } from '@/types/api';

interface InsightsChartProps {
  insights: Insight[];
}

export function InsightsChart({ insights }: InsightsChartProps) {
  const data = [...insights]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((i) => ({
      period: i.period,
      conversations: i.totalConversations,
      resolutionRate: Math.round(i.resolutionRate * 100),
    }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Conversation Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No insight data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Conversation Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <XAxis dataKey="period" stroke="hsl(0 0% 63.9%)" fontSize={12} />
            <YAxis stroke="hsl(0 0% 63.9%)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0 0% 3.9%)',
                border: '1px solid hsl(0 0% 14.9%)',
                borderRadius: '0.5rem',
                color: 'hsl(0 0% 98%)',
              }}
            />
            <Area
              type="monotone"
              dataKey="conversations"
              stroke="hsl(38 92% 50%)"
              fill="hsl(38 92% 50% / 0.15)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
