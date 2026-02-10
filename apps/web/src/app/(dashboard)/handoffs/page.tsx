'use client';

import { useCallback, useState } from 'react';
import { useHandoffs } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { ArrowRightLeft } from 'lucide-react';
import { HandoffCard } from '@/components/handoffs/handoff-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function HandoffsPage() {
  const { api, ready } = useSession();
  const [tab, setTab] = useState('pending');
  const { data, isLoading, mutate } = useHandoffs(tab === 'all' ? undefined : tab);

  const handleClaim = useCallback(async (id: string) => {
    if (!api) return;
    await api.patch('/api/handoffs', { handoffId: id, status: 'claimed', assignedAgent: 'dashboard-user' });
    mutate();
  }, [api, mutate]);

  const handleResolve = useCallback(async (id: string) => {
    if (!api) return;
    await api.patch('/api/handoffs', { handoffId: id, status: 'resolved' });
    mutate();
  }, [api, mutate]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const handoffs = data?.handoffs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Handoffs" count={handoffs.length} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="claimed">Claimed</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {handoffs.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title="No handoffs yet"
              description="When your agent detects it can't resolve an issue, it will escalate here for a human to pick up. Handoffs appear automatically during live conversations."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {handoffs.map((h) => (
                <HandoffCard
                  key={h._id}
                  handoff={h}
                  onClaim={handleClaim}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
