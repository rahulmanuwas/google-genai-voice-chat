'use client';

import { use } from 'react';
import { useTraceTimeline } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { timeAgo, formatDuration } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import {
  MessageSquare,
  Wrench,
  BookOpen,
  Shield,
  ArrowRightLeft,
  Zap,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import type { TraceTimelineEvent } from '@/types/api';

const EVENT_CONFIG: Record<string, { icon: typeof MessageSquare; color: string; bgColor: string; label: string }> = {
  message: { icon: MessageSquare, color: 'text-blue-400', bgColor: 'bg-blue-500/15 border-blue-500/25', label: 'Message' },
  tool_execution: { icon: Wrench, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15 border-emerald-500/25', label: 'Tool' },
  knowledge_search: { icon: BookOpen, color: 'text-purple-400', bgColor: 'bg-purple-500/15 border-purple-500/25', label: 'Knowledge' },
  guardrail_violation: { icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/15 border-red-500/25', label: 'Guardrail' },
  handoff: { icon: ArrowRightLeft, color: 'text-orange-400', bgColor: 'bg-orange-500/15 border-orange-500/25', label: 'Handoff' },
  event: { icon: Zap, color: 'text-zinc-400', bgColor: 'bg-zinc-500/15 border-zinc-500/25', label: 'Event' },
};

function EventCard({ event }: { event: TraceTimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.event;
  const Icon = config.icon;

  const toggle = useCallback(() => setExpanded((p) => !p), []);

  const renderSummary = () => {
    const d = event.data;
    switch (event.type) {
      case 'message':
        return (
          <span className="text-sm">
            <Badge variant="outline" className="mr-1.5 text-xs">{d.role as string}</Badge>
            {(d.content as string)?.slice(0, 120)}{(d.content as string)?.length > 120 ? '...' : ''}
          </span>
        );
      case 'tool_execution':
        return (
          <span className="text-sm">
            <code className="text-xs text-muted-foreground">{d.toolName as string}</code>
            <Badge
              variant={d.status === 'success' ? 'secondary' : 'destructive'}
              className="ml-2 text-xs"
            >
              {d.status as string}
            </Badge>
            {d.durationMs != null && (
              <span className="ml-2 text-xs text-muted-foreground">{formatDuration(d.durationMs as number)}</span>
            )}
          </span>
        );
      case 'knowledge_search':
        return (
          <span className="text-sm">
            &ldquo;{(d.query as string)?.slice(0, 80)}&rdquo;
            <span className="ml-2 text-xs text-muted-foreground">
              score: {(d.topScore as number)?.toFixed(2)} ({d.resultCount as number} results)
            </span>
            {Boolean(d.gapDetected) && <Badge variant="destructive" className="ml-2 text-xs">Gap</Badge>}
          </span>
        );
      case 'guardrail_violation':
        return (
          <span className="text-sm">
            <Badge variant="destructive" className="mr-1.5 text-xs">{d.action as string}</Badge>
            {d.violationType as string} ({d.direction as string})
          </span>
        );
      case 'handoff':
        return (
          <span className="text-sm">
            {d.reason as string}
            <Badge variant="outline" className="ml-2 text-xs">{d.status as string}</Badge>
            <Badge variant="outline" className="ml-1 text-xs">{d.priority as string}</Badge>
          </span>
        );
      case 'event':
        return (
          <span className="text-sm text-muted-foreground">{d.eventType as string}</span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${config.bgColor}`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{config.label}</Badge>
          <span className="text-xs text-muted-foreground">{timeAgo(event.timestamp)}</span>
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
          <button
            onClick={toggle}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-1">{renderSummary()}</div>
        {expanded && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function TraceTimelinePage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = use(params);
  const { ready } = useSession();

  // Get sessionId from URL search params (passed from conversation detail)
  const [sessionId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('sessionId') ?? undefined;
    }
    return undefined;
  });

  const { data, isLoading } = useTraceTimeline(ready ? traceId : null, sessionId);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const timeline = data?.timeline ?? [];

  // Compute type counts for description
  const typeCounts = timeline.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  const description = Object.entries(typeCounts)
    .map(([type, count]) => `${count} ${(EVENT_CONFIG[type]?.label ?? type).toLowerCase()}${count > 1 ? 's' : ''}`)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trace Timeline"
        count={timeline.length}
        description={description || `Trace ${traceId.slice(0, 12)}...`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Trace: <code className="text-xs text-muted-foreground">{traceId}</code>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events found for this trace.</p>
          ) : (
            <div className="space-y-0">
              {timeline.map((event, idx) => (
                <EventCard key={`${event.type}-${event.timestamp}-${idx}`} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
