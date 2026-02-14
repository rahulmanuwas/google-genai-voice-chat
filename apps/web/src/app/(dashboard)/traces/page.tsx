'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConversations } from '@/lib/hooks/use-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { ScanSearch } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { timeAgo } from '@/lib/utils';

export default function TracesPage() {
  const router = useRouter();
  const [traceId, setTraceId] = useState('');
  const { data: convData } = useConversations();

  // Extract unique traceIds from conversations (most recent first)
  const recentTraces = useMemo(() => {
    const conversations = convData?.conversations ?? [];
    const seen = new Set<string>();
    const traces: Array<{ traceId: string; sessionId: string; appSlug: string; startedAt: number }> = [];

    // Conversations are typically sorted by most recent first
    for (const c of conversations) {
      const tid = (c as unknown as Record<string, unknown>).traceId as string | undefined;
      if (tid && !seen.has(tid)) {
        seen.add(tid);
        traces.push({
          traceId: tid,
          sessionId: c.sessionId,
          appSlug: c.appSlug,
          startedAt: c.startedAt,
        });
      }
      if (traces.length >= 10) break;
    }

    return traces;
  }, [convData]);

  const handleLookup = () => {
    if (traceId.trim()) {
      router.push(`/traces/${traceId.trim()}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Traces">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter trace ID..."
            value={traceId}
            onChange={(e) => setTraceId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="h-8 w-48 text-xs sm:w-72"
          />
          <Button size="sm" variant="outline" onClick={handleLookup} className="h-8" disabled={!traceId.trim()}>
            <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            Lookup
          </Button>
        </div>
      </PageHeader>

      {recentTraces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Traces</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Trace ID</th>
                    <th className="p-3 font-medium">Session</th>
                    <th className="p-3 font-medium">App</th>
                    <th className="p-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTraces.map((t) => (
                    <tr key={t.traceId} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3">
                        <Link href={`/traces/${t.traceId}`} className="text-blue-400 hover:underline font-mono text-xs">
                          {t.traceId.slice(0, 16)}...
                        </Link>
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {t.sessionId.slice(0, 12)}...
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{t.appSlug}</td>
                      <td className="p-3 text-xs text-muted-foreground">{timeAgo(t.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <EmptyState
        icon={ScanSearch}
        title="Trace Timeline Viewer"
        description="Enter a trace ID to view a chronological timeline of all events — messages, tool executions, knowledge searches, guardrail checks, and handoffs — in a single conversation session."
      />
    </div>
  );
}
