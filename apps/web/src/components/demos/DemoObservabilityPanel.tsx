'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Scenario } from '@/lib/scenarios';
import {
  getGuidedDemoSteps,
  type DemoTimelineEvent,
  type ScenarioStateChange,
  type DemoSubsystem,
} from '@/lib/demo-observability';
import { timeAgo } from '@/lib/utils';
import {
  Wrench,
  ShieldCheck,
  BookOpen,
  ArrowRightLeft,
  Users,
  MessageCircle,
  Monitor,
  Play,
  Eye,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

// ── Icon + color mapping ──────────────────────────────────────────

const SUBSYSTEM_CONFIG: Record<DemoSubsystem, { Icon: LucideIcon; color: string; dotColor: string; label: string }> = {
  tool:         { Icon: Wrench,         color: 'text-emerald-400', dotColor: 'bg-emerald-400', label: 'Action' },
  guardrail:    { Icon: ShieldCheck,    color: 'text-amber-400',   dotColor: 'bg-amber-400',   label: 'Safety' },
  knowledge:    { Icon: BookOpen,       color: 'text-blue-400',    dotColor: 'bg-blue-400',    label: 'Knowledge' },
  state:        { Icon: ArrowRightLeft, color: 'text-violet-400',  dotColor: 'bg-violet-400',  label: 'Data change' },
  handoff:      { Icon: Users,          color: 'text-orange-400',  dotColor: 'bg-orange-400',  label: 'Escalation' },
  conversation: { Icon: MessageCircle,  color: 'text-cyan-400',    dotColor: 'bg-cyan-400',    label: 'Conversation' },
  system:       { Icon: Monitor,        color: 'text-zinc-400',    dotColor: 'bg-zinc-400',    label: 'System' },
};

// ── New item detection hook ───────────────────────────────────────

function useNewItemIds(ids: string[]): Set<string> {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevIdsRef.current;
    const fresh = new Set<string>();
    for (const id of ids) {
      if (!prev.has(id)) fresh.add(id);
    }

    if (fresh.size > 0) {
      setNewIds(fresh);
      const timer = setTimeout(() => setNewIds(new Set()), 400);
      prevIdsRef.current = new Set(ids);
      return () => clearTimeout(timer);
    }

    prevIdsRef.current = new Set(ids);
  }, [ids]);

  return newIds;
}

// ── Component ─────────────────────────────────────────────────────

interface DemoObservabilityPanelProps {
  scenario: Scenario;
  timeline: DemoTimelineEvent[];
  stateChanges?: ScenarioStateChange[];
  onRunPrompt?: (prompt: string) => void;
  /** Hide action buttons (e.g. for voice-only landing page demo) */
  hideActions?: boolean;
}

export function DemoObservabilityPanel({
  scenario,
  timeline,
  stateChanges = [],
  onRunPrompt,
  hideActions = false,
}: DemoObservabilityPanelProps) {
  const steps = useMemo(() => getGuidedDemoSteps(scenario), [scenario]);

  const hasActivity = timeline.length > 0;
  const hasStateChanges = stateChanges.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Demo walkthrough ── */}
      <div>
        <p className="mb-3 text-[13px] font-medium text-muted-foreground">
          Demo Walkthrough
        </p>
        <div className="space-y-2.5">
          {steps.map((step, index) => {
            const { Icon, color } = SUBSYSTEM_CONFIG[step.subsystem];

            return (
              <div
                key={step.id}
                className="group rounded-xl border border-border bg-card/50 px-4 py-3.5 transition-colors hover:border-muted-foreground/25"
              >
                {/* Header row: number + icon + title */}
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  <span className="text-sm font-medium">{step.title}</span>
                </div>

                {/* What to say */}
                <div className="mb-2 rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-[13px] leading-relaxed">
                    &ldquo;{step.prompt}&rdquo;
                  </p>
                </div>

                {/* What to watch for */}
                <div className="mb-2.5 flex items-start gap-1.5">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.expected}
                  </p>
                </div>

                {/* Actions */}
                {!hideActions && onRunPrompt && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRunPrompt(step.prompt)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand/90 px-3 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand"
                    >
                      <Play className="h-3 w-3" />
                      Send to agent
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Live activity feed ── */}
      {hasActivity && (
        <ActivitySection timeline={timeline} />
      )}

      {/* ── Data changes ── */}
      {hasStateChanges && (
        <DataChangesSection stateChanges={stateChanges} />
      )}
    </div>
  );
}

// ── Activity feed — vertical timeline ─────────────────────────────

function ActivitySection({ timeline }: { timeline: DemoTimelineEvent[] }) {
  const [open, setOpen] = useState(true);
  const eventIds = useMemo(() => timeline.slice(0, 10).map((e) => e.id), [timeline]);
  const newIds = useNewItemIds(eventIds);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[13px] font-medium text-muted-foreground">Activity</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{timeline.length}</Badge>
        <div className="ml-2 h-px flex-1 bg-border" />
      </button>
      {open && (
        <div className="relative ml-[7px] border-l border-border pl-4 pt-1">
          {timeline.slice(0, 10).map((event) => {
            const subsystem = SUBSYSTEM_CONFIG[event.subsystem];
            const isNew = newIds.has(event.id);

            return (
              <div
                key={event.id}
                className={`relative mb-2.5 flex items-start gap-2.5 last:mb-0 ${isNew ? 'animate-slide-in-left' : ''}`}
              >
                {/* Timeline dot */}
                <span
                  className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${subsystem.dotColor}`}
                />
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <subsystem.Icon className={`h-3 w-3 shrink-0 ${subsystem.color}`} />
                    <span className="text-xs font-medium">{event.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(event.ts)}</span>
                  </div>
                  {event.detail && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-1">{event.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Data changes — compact inline diffs ───────────────────────────

function DataChangesSection({ stateChanges }: { stateChanges: ScenarioStateChange[] }) {
  const [open, setOpen] = useState(true);
  const changeIds = useMemo(() => stateChanges.slice(0, 6).map((c) => c.id), [stateChanges]);
  const newIds = useNewItemIds(changeIds);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[13px] font-medium text-muted-foreground">Data Changes</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{stateChanges.length}</Badge>
        <div className="ml-2 h-px flex-1 bg-border" />
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {stateChanges.slice(0, 6).map((change) => {
            const isNew = newIds.has(change.id);

            return (
              <div
                key={change.id}
                className={`rounded-lg border border-border bg-card/50 px-3 py-2.5 ${isNew ? 'animate-scale-in' : ''}`}
              >
                {/* Header: title + tool chip */}
                <div className="mb-1.5 flex items-center gap-2">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-xs font-medium">{change.title}</span>
                  {change.inferredTool && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <Wrench className="h-2.5 w-2.5" />
                      {change.inferredTool}
                    </span>
                  )}
                </div>
                {/* Inline diff: old → new */}
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-muted-foreground/60 line-through">{change.before}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={`font-medium text-emerald-400 ${isNew ? 'animate-highlight-flash' : ''}`}>
                    {change.after}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
