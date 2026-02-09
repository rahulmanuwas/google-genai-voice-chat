'use client';

import { useState, useMemo } from 'react';
import { useOverview, useInsights } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { KPICards } from '@/components/overview/kpi-cards';
import { ToolUsageChart } from '@/components/overview/tool-usage-chart';
import { InsightsChart } from '@/components/overview/insights-chart';
import { ActivityFeed } from '@/components/overview/activity-feed';
import { PageHeader } from '@/components/layout/page-header';

const TIME_RANGES = [
  { label: '1h', ms: 3_600_000 },
  { label: '1d', ms: 86_400_000 },
  { label: '1w', ms: 604_800_000 },
  { label: 'All', ms: 0 },
] as const;

export default function OverviewPage() {
  const { ready } = useSession();
  const [rangeMs, setRangeMs] = useState(0);

  const since = useMemo(
    () => (rangeMs > 0 ? Date.now() - rangeMs : undefined),
    [rangeMs],
  );

  const { data: overview, isLoading: overviewLoading } = useOverview(since);
  const { data: insightsData } = useInsights();

  if (!ready || overviewLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Failed to load overview data. Check your environment variables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Overview">
        <div className="inline-flex items-center rounded-lg border bg-muted p-0.5 text-sm">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeMs(r.ms)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                rangeMs === r.ms
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <KPICards data={overview} />
      <div className="grid gap-6 lg:grid-cols-2">
        <InsightsChart insights={insightsData?.insights ?? []} />
        <ToolUsageChart toolUsage={overview.toolUsage} />
      </div>
      <ActivityFeed data={overview} />
    </div>
  );
}
