'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useOverview, useInsights, useAnnotations, useConversations } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { useAppFilter } from '@/lib/context/app-filter-context';
import { KPICards } from '@/components/overview/kpi-cards';
import { ToolUsageChart } from '@/components/overview/tool-usage-chart';
import { InsightsChart } from '@/components/overview/insights-chart';
import { NeedsAttention } from '@/components/overview/needs-attention';
import { PageHeader } from '@/components/layout/page-header';

const TIME_RANGES = [
  { label: '1h', ms: 3_600_000 },
  { label: '1d', ms: 86_400_000 },
  { label: '1w', ms: 604_800_000 },
  { label: 'All', ms: 0 },
] as const;

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-lg shimmer" />
        <div className="h-9 w-48 rounded-lg shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded shimmer" />
              <div className="h-10 w-10 rounded-lg shimmer" />
            </div>
            <div className="h-8 w-16 rounded shimmer" />
            <div className="h-3 w-20 rounded shimmer" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="h-5 w-32 rounded shimmer" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-4 w-36 rounded shimmer" />
          <div className="h-[300px] rounded-lg shimmer" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-4 w-24 rounded shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-5 rounded shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { ready } = useSession();
  const [rangeMs, setRangeMs] = useState(0);
  const [since, setSince] = useState<number | undefined>(undefined);

  const selectRange = useCallback((ms: number) => {
    setRangeMs(ms);
    setSince(ms > 0 ? Date.now() - ms : undefined);
  }, []);

  const { selectedApp, setAvailableApps } = useAppFilter();
  const { data: overview, isLoading: overviewLoading } = useOverview(since, selectedApp);
  const { data: insightsData } = useInsights(selectedApp);
  const { data: annotationsData } = useAnnotations(undefined, selectedApp);
  const { data: conversationsData } = useConversations(undefined, selectedApp);
  // Always fetch all conversations (unfiltered) to populate available apps
  const { data: allConversationsData } = useConversations();

  // Populate available apps from all conversations
  useEffect(() => {
    const conversations = allConversationsData?.conversations ?? [];
    const apps = [...new Set(conversations.map((c) => c.appSlug).filter(Boolean))].sort();
    if (apps.length > 0) setAvailableApps(apps);
  }, [allConversationsData, setAvailableApps]);

  const unannotatedCount = useMemo(() => {
    const conversations = conversationsData?.conversations ?? [];
    const annotations = annotationsData?.annotations ?? [];
    const annotatedSessionIds = new Set(annotations.map((a) => a.sessionId));
    return conversations.filter((c) => !annotatedSessionIds.has(c.sessionId)).length;
  }, [conversationsData, annotationsData]);

  if (!ready || overviewLoading) {
    return <LoadingSkeleton />;
  }

  if (!overview) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/[0.06]">
          <svg className="h-5 w-5 text-brand/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">Failed to load overview data. Check your environment variables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" showAppFilter>
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-sm">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => selectRange(r.ms)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-all duration-150 ${
                rangeMs === r.ms
                  ? 'bg-brand/10 text-brand shadow-sm'
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
        <NeedsAttention
          pendingHandoffs={overview.pendingHandoffs}
          unannotatedConversations={unannotatedCount}
          unresolvedGaps={overview.unresolvedGaps}
        />
      </div>

      <ToolUsageChart toolUsage={overview.toolUsage} />
    </div>
  );
}
