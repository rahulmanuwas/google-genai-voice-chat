'use client';

import { useCallback, useMemo, useState } from 'react';
import { useHandoffs } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { ArrowRightLeft, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HandoffCard } from '@/components/handoffs/handoff-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDuration, timeAgo } from '@/lib/utils';

export default function HandoffsPage() {
  const { api, ready } = useSession();
  const [tab, setTab] = useState('all');
  const { data, isLoading, mutate } = useHandoffs(tab === 'all' ? undefined : tab);
  // Fetch all handoffs separately for time metrics (always across all data)
  const { data: allData } = useHandoffs();

  const [resolveDialogId, setResolveDialogId] = useState<string | null>(null);
  const [resolutionQuality, setResolutionQuality] = useState<string>('good');
  const [agentFeedback, setAgentFeedback] = useState('');
  const [necessityScore, setNecessityScore] = useState<string>('1');

  const handleClaim = useCallback(async (id: string) => {
    if (!api) return;
    await api.patch('/api/handoffs', { handoffId: id, status: 'claimed', assignedAgent: 'dashboard-user' });
    mutate();
  }, [api, mutate]);

  const openResolveDialog = useCallback((id: string) => {
    setResolveDialogId(id);
    setResolutionQuality('good');
    setAgentFeedback('');
    setNecessityScore('1');
  }, []);

  const handleResolve = useCallback(async () => {
    if (!api || !resolveDialogId) return;
    await api.patch('/api/handoffs', {
      handoffId: resolveDialogId,
      status: 'resolved',
      resolutionQuality,
      agentFeedback: agentFeedback.trim() || undefined,
      necessityScore: parseFloat(necessityScore),
    });
    setResolveDialogId(null);
    mutate();
  }, [api, resolveDialogId, resolutionQuality, agentFeedback, necessityScore, mutate]);

  const handoffs = data?.handoffs ?? [];

  // Compute time metrics from ALL resolved handoffs (not just current tab)
  const timeMetrics = useMemo(() => {
    const allHandoffs = allData?.handoffs ?? [];
    const resolved = allHandoffs.filter((h) => h.status === 'resolved' && h.resolvedAt);
    if (resolved.length === 0) return null;

    const claimTimes = resolved
      .filter((h) => h.claimedAt)
      .map((h) => h.claimedAt! - h.createdAt);
    const resolveTimes = resolved.map((h) => h.resolvedAt! - h.createdAt);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const qualityCounts = { excellent: 0, good: 0, poor: 0 };
    for (const h of resolved) {
      if (h.resolutionQuality && h.resolutionQuality in qualityCounts) {
        qualityCounts[h.resolutionQuality as keyof typeof qualityCounts]++;
      }
    }

    return {
      avgTimeToClaim: avg(claimTimes),
      avgTimeToResolve: avg(resolveTimes),
      resolvedCount: resolved.length,
      qualityCounts,
    };
  }, [allData]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Handoffs" count={handoffs.length} />

      {/* Time Metrics — always visible, computed from ALL resolved handoffs */}
      {timeMetrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-semibold">{formatDuration(timeMetrics.avgTimeToClaim)}</p>
                <p className="text-xs text-muted-foreground">Avg time to claim</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Clock className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold">{formatDuration(timeMetrics.avgTimeToResolve)}</p>
                <p className="text-xs text-muted-foreground">Avg time to resolve</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                {timeMetrics.qualityCounts.excellent > 0 && (
                  <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/25">
                    {timeMetrics.qualityCounts.excellent} excellent
                  </Badge>
                )}
                {timeMetrics.qualityCounts.good > 0 && (
                  <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/25">
                    {timeMetrics.qualityCounts.good} good
                  </Badge>
                )}
                {timeMetrics.qualityCounts.poor > 0 && (
                  <Badge variant="outline" className="text-xs text-red-400 border-red-500/25">
                    {timeMetrics.qualityCounts.poor} poor
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Resolution quality</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-semibold">{timeMetrics.resolvedCount}</p>
              <p className="text-xs text-muted-foreground">Resolved handoffs</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="claimed">Claimed</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {handoffs.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title="No handoffs yet"
              description="When your agent detects it can't resolve an issue, it will escalate here for a human to pick up. Handoffs appear automatically during live conversations."
            />
          ) : tab === 'resolved' ? (
            /* Table layout for resolved tab */
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">Reason</th>
                        <th className="p-3 font-medium">Priority</th>
                        <th className="p-3 font-medium">Quality</th>
                        <th className="p-3 font-medium">Time to Resolve</th>
                        <th className="p-3 font-medium">Resolved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {handoffs.map((h) => (
                        <tr key={h._id} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="p-3 max-w-xs truncate">{h.reason}</td>
                          <td className="p-3">
                            <StatusBadge value={h.priority} type="priority" />
                          </td>
                          <td className="p-3">
                            {h.resolutionQuality ? (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  h.resolutionQuality === 'excellent' ? 'text-emerald-400 border-emerald-500/25' :
                                  h.resolutionQuality === 'good' ? 'text-blue-400 border-blue-500/25' :
                                  'text-red-400 border-red-500/25'
                                }`}
                              >
                                {h.resolutionQuality}
                              </Badge>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {h.resolvedAt ? formatDuration(h.resolvedAt - h.createdAt) : '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">{h.resolvedAt ? timeAgo(h.resolvedAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {handoffs.map((h) => (
                <HandoffCard
                  key={h._id}
                  handoff={h}
                  onClaim={handleClaim}
                  onResolve={openResolveDialog}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog with Quality Feedback */}
      <Dialog open={!!resolveDialogId} onOpenChange={(open) => { if (!open) setResolveDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Handoff</DialogTitle>
            <DialogDescription>Provide feedback on this handoff to improve quality tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Quality</Label>
              <Select value={resolutionQuality} onValueChange={setResolutionQuality}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Handoff Necessity (0 = unnecessary, 1 = necessary)</Label>
              <Select value={necessityScore} onValueChange={setNecessityScore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Definitely needed</SelectItem>
                  <SelectItem value="0.75">0.75 - Probably needed</SelectItem>
                  <SelectItem value="0.5">0.5 - Maybe needed</SelectItem>
                  <SelectItem value="0.25">0.25 - Probably unnecessary</SelectItem>
                  <SelectItem value="0">0 - Completely unnecessary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Feedback (optional)</Label>
              <Textarea
                value={agentFeedback}
                onChange={(e) => setAgentFeedback(e.target.value)}
                placeholder="Notes on the handoff — could the AI have handled this better?"
                rows={3}
              />
            </div>
            <Button onClick={() => void handleResolve()} className="w-full">
              Resolve with Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
