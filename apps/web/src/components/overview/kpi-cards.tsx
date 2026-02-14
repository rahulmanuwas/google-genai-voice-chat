'use client';

import {
  MessageSquare,
  CheckCircle2,
  ArrowRightLeft,
  Star,
  Clock,
  Wrench,
  Shield,
} from 'lucide-react';
import { formatNumber, formatPercent, formatDuration } from '@/lib/utils';
import { HeroKPICard } from './hero-kpi-card';
import { CompactStatCard } from './compact-stat-card';
import type { OverviewData } from '@/types/api';

interface KPICardsProps {
  data: OverviewData;
}

export function KPICards({ data }: KPICardsProps) {
  const heroCards = [
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
      title: 'Avg CSAT',
      value: data.avgCSAT != null ? data.avgCSAT.toFixed(1) : '—',
      sub: 'Out of 5.0',
      icon: Star,
    },
  ];

  const compactCards = [
    {
      title: 'Handoff Rate',
      value: formatPercent(data.handoffRate),
      sub: `${data.pendingHandoffs} pending`,
      icon: ArrowRightLeft,
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
  ];

  return (
    <div className="space-y-4">
      {/* Hero metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {heroCards.map((c) => (
          <HeroKPICard key={c.title} {...c} />
        ))}
      </div>
      {/* Secondary metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {compactCards.map((c) => (
          <CompactStatCard key={c.title} {...c} />
        ))}
      </div>
    </div>
  );
}
