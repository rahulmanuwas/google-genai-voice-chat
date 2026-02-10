'use client';

import {
  MessageSquare,
  CheckCircle2,
  ArrowRightLeft,
  Star,
  Clock,
  Wrench,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatPercent, formatDuration } from '@/lib/utils';
import type { OverviewData } from '@/types/api';

interface KPICardsProps {
  data: OverviewData;
}

export function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      title: 'Total Conversations',
      value: formatNumber(data.totalConversations),
      sub: `${data.conversationsLast24h} last 24h`,
      icon: MessageSquare,
    },
    {
      title: 'Resolution Rate',
      value: formatPercent(data.resolutionRate),
      sub: 'Auto-resolved',
      icon: CheckCircle2,
    },
    {
      title: 'Handoff Rate',
      value: formatPercent(data.handoffRate),
      sub: `${data.pendingHandoffs} pending`,
      icon: ArrowRightLeft,
    },
    {
      title: 'Avg CSAT',
      value: data.avgCSAT != null ? data.avgCSAT.toFixed(1) : '—',
      sub: 'Out of 5.0',
      icon: Star,
    },
    {
      title: 'Avg Duration',
      value: formatDuration(data.avgDurationMs),
      sub: 'Per conversation',
      icon: Clock,
    },
    {
      title: 'Tool Executions',
      value: formatNumber(data.totalToolExecutions),
      sub: data.toolSuccessRate != null ? `${formatPercent(data.toolSuccessRate)} success` : 'No data',
      icon: Wrench,
    },
    {
      title: 'Guardrail Violations',
      value: formatNumber(data.totalGuardrailViolations),
      sub: 'Total flagged',
      icon: Shield,
    },
    {
      title: 'Knowledge Gaps',
      value: formatNumber(data.unresolvedGaps),
      sub: 'Unresolved queries',
      icon: HelpCircle,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            <c.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
