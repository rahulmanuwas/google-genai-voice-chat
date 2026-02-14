'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAnnotations, useConversations } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { NotebookPen, Download, ThumbsUp, ThumbsDown, ArrowUpDown } from 'lucide-react';
import { timeAgo, formatPercent } from '@/lib/utils';
import { FAILURE_MODES } from '@/types/api';

export default function AnnotationsPage() {
  const { ready } = useSession();
  const [tab, setTab] = useState('all');
  const { data, isLoading } = useAnnotations(tab === 'all' ? undefined : tab);
  const { data: convData } = useConversations();

  const annotations = useMemo(() => data?.annotations ?? [], [data?.annotations]);
  const conversations = useMemo(() => convData?.conversations ?? [], [convData?.conversations]);

  // Coverage stats
  const totalConversations = conversations.length;
  const annotatedCount = annotations.length;
  const coverageRate = totalConversations > 0 ? annotatedCount / totalConversations : 0;

  const qualityCounts = useMemo(() => {
    const counts = { good: 0, bad: 0, mixed: 0 };
    for (const a of annotations) {
      if (a.qualityRating in counts) {
        counts[a.qualityRating as keyof typeof counts]++;
      }
    }
    return counts;
  }, [annotations]);

  // Failure mode frequency
  const failureModeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of annotations) {
      for (const mode of a.failureModes) {
        counts[mode] = (counts[mode] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [annotations]);

  const maxFailureCount = failureModeCounts.length > 0 ? failureModeCounts[0][1] : 1;

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [annotations]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Annotations" count={annotatedCount}>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={annotations.length === 0}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export JSON
        </Button>
      </PageHeader>

      {/* Coverage Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Coverage</p>
            <p className="text-2xl font-semibold">{formatPercent(coverageRate)}</p>
            <p className="text-xs text-muted-foreground">{annotatedCount} / {totalConversations} conversations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ThumbsUp className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-semibold">{qualityCounts.good}</p>
              <p className="text-xs text-muted-foreground">Good</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ThumbsDown className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-semibold">{qualityCounts.bad}</p>
              <p className="text-xs text-muted-foreground">Bad</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ArrowUpDown className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-semibold">{qualityCounts.mixed}</p>
              <p className="text-xs text-muted-foreground">Mixed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failure Mode Frequency */}
      {failureModeCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Failure Mode Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {FAILURE_MODES.map((mode) => {
                const count = failureModeCounts.find(([m]) => m === mode)?.[1] ?? 0;
                if (count === 0) return null;
                const pct = (count / maxFailureCount) * 100;
                return (
                  <div key={mode} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{mode.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-red-500/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annotated Conversations */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="good">Good</TabsTrigger>
          <TabsTrigger value="bad">Bad</TabsTrigger>
          <TabsTrigger value="mixed">Mixed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {annotations.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No annotations yet"
              description="Annotate conversations from the conversation detail page to track quality and identify failure patterns."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">Session</th>
                        <th className="p-3 font-medium">App</th>
                        <th className="p-3 font-medium">Quality</th>
                        <th className="p-3 font-medium">Failure Modes</th>
                        <th className="p-3 font-medium">Notes</th>
                        <th className="p-3 font-medium">Annotated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annotations.map((a) => (
                        <tr key={a._id} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="p-3">
                            <Link href={`/conversations/${a.sessionId}`} className="text-blue-400 hover:underline font-mono text-xs">
                              {a.sessionId.slice(0, 16)}...
                            </Link>
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs">{a.appSlug}</Badge>
                          </td>
                          <td className="p-3">
                            <QualityBadge rating={a.qualityRating} />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {a.failureModes.map((mode) => (
                                <Badge key={mode} variant="outline" className="text-xs">
                                  {mode.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground max-w-xs truncate text-xs">
                            {a.notes || '—'}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{timeAgo(a.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-border md:hidden">
                  {annotations.map((a) => (
                    <div key={a._id} className="space-y-1.5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/conversations/${a.sessionId}`} className="text-blue-400 hover:underline font-mono text-xs">
                          {a.sessionId.slice(0, 16)}...
                        </Link>
                        <QualityBadge rating={a.qualityRating} />
                      </div>
                      {a.failureModes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {a.failureModes.map((mode) => (
                            <Badge key={mode} variant="outline" className="text-xs">
                              {mode.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {a.notes && <p className="text-xs text-muted-foreground truncate">{a.notes}</p>}
                      <div className="text-xs text-muted-foreground">
                        {a.appSlug} &middot; {timeAgo(a.updatedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QualityBadge({ rating }: { rating: string }) {
  const config: Record<string, string> = {
    good: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    bad: 'bg-red-500/15 text-red-400 border-red-500/25',
    mixed: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  return (
    <Badge variant="outline" className={`text-xs ${config[rating] ?? ''}`}>
      {rating}
    </Badge>
  );
}
