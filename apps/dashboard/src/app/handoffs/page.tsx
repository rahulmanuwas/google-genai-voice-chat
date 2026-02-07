'use client';

import { useCallback, useState } from 'react';
import { useHandoffs } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { HandoffCard } from '@/components/handoffs/handoff-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="claimed">Claimed</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {handoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No handoffs found.</p>
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
