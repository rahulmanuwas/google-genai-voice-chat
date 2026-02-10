'use client';

import { ArrowRightLeft, HelpCircle, Wrench, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OverviewData } from '@/types/api';

interface ActivityFeedProps {
  data: OverviewData;
}

export function ActivityFeed({ data }: ActivityFeedProps) {
  const items = [
    {
      icon: ArrowRightLeft,
      label: `${data.handoffsLast24h} handoffs in last 24h`,
      detail: `${data.pendingHandoffs} pending`,
    },
    {
      icon: Wrench,
      label: `${data.totalToolExecutions} tool executions`,
      detail: data.toolSuccessRate != null ? `${(data.toolSuccessRate * 100).toFixed(0)}% success rate` : '',
    },
    {
      icon: Shield,
      label: `${data.totalGuardrailViolations} guardrail violations`,
      detail: 'All time',
    },
    {
      icon: HelpCircle,
      label: `${data.unresolvedGaps} unresolved knowledge gaps`,
      detail: 'Needs attention',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Activity Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/[0.06]">
                <item.icon className="h-4 w-4 text-brand/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{item.label}</p>
                {item.detail && (
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
