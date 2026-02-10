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
        <div key={c.title} className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-brand/20">
          {/* Subtle brand gradient at top */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/25 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.title}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/[0.06]">
              <c.icon className="h-3.5 w-3.5 text-brand/70" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight">{c.value}</div>
          <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
