'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ToolUsageChartProps {
  toolUsage: Record<string, number>;
}

export function ToolUsageChart({ toolUsage }: ToolUsageChartProps) {
  const data = Object.entries(toolUsage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const max = data.length > 0 ? data[0].count : 0;

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
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="w-[45%] truncate text-sm text-muted-foreground" title={d.name}>
                {d.name}
              </span>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${max > 0 ? (d.count / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="w-8 text-right text-sm font-medium tabular-nums">
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
