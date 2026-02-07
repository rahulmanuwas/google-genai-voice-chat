'use client';

import { useOverview, useInsights } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { KPICards } from '@/components/overview/kpi-cards';
import { ToolUsageChart } from '@/components/overview/tool-usage-chart';
import { InsightsChart } from '@/components/overview/insights-chart';
import { ActivityFeed } from '@/components/overview/activity-feed';

export default function OverviewPage() {
  const { ready } = useSession();
  const { data: overview, isLoading: overviewLoading } = useOverview();
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
      <KPICards data={overview} />
      <div className="grid gap-6 lg:grid-cols-2">
        <InsightsChart insights={insightsData?.insights ?? []} />
        <ToolUsageChart toolUsage={overview.toolUsage} />
      </div>
      <ActivityFeed data={overview} />
    </div>
  );
}
