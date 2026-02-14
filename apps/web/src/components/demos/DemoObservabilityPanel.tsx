'use client';

import { useMemo, useState } from 'react';
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
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  Info,
  CircleX,
  type LucideIcon,
} from 'lucide-react';

// ── Icon + color mapping ──────────────────────────────────────────

const SUBSYSTEM_CONFIG: Record<DemoSubsystem, { Icon: LucideIcon; color: string; label: string }> = {
  tool:         { Icon: Wrench,         color: 'text-emerald-400', label: 'Action' },
  guardrail:    { Icon: ShieldCheck,    color: 'text-amber-400',   label: 'Safety' },
  knowledge:    { Icon: BookOpen,       color: 'text-blue-400',    label: 'Knowledge' },
  state:        { Icon: ArrowRightLeft, color: 'text-violet-400',  label: 'Data change' },
  handoff:      { Icon: Users,          color: 'text-orange-400',  label: 'Escalation' },
  conversation: { Icon: MessageCircle,  color: 'text-cyan-400',    label: 'Conversation' },
  system:       { Icon: Monitor,        color: 'text-zinc-400',    label: 'System' },
};

const STATUS_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  success: { Icon: CircleCheck, color: 'text-emerald-400' },
  info:    { Icon: Info,        color: 'text-blue-400' },
  warning: { Icon: CircleAlert, color: 'text-amber-400' },
  error:   { Icon: CircleX,     color: 'text-red-400' },
};

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

// ── Activity feed (collapsible) ───────────────────────────────────

function ActivitySection({ timeline }: { timeline: DemoTimelineEvent[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[13px] font-medium text-muted-foreground">Activity</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{timeline.length}</Badge>
      </button>
      {open && (
        <div className="space-y-1 pl-1">
          {timeline.slice(0, 10).map((event) => {
            const subsystem = SUBSYSTEM_CONFIG[event.subsystem];
            const status = STATUS_ICON[event.status] ?? STATUS_ICON.info;
            const StatusIcon = status.Icon;

            return (
              <div key={event.id} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                <StatusIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${status.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <subsystem.Icon className={`h-3 w-3 shrink-0 ${subsystem.color}`} />
                    <span className="text-xs font-medium">{event.title}</span>
                  </div>
                  {event.detail && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{event.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(event.ts)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Data changes (collapsible) ────────────────────────────────────

function DataChangesSection({ stateChanges }: { stateChanges: ScenarioStateChange[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[13px] font-medium text-muted-foreground">Data Changes</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{stateChanges.length}</Badge>
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {stateChanges.slice(0, 6).map((change) => (
            <div key={change.id} className="rounded-lg border border-border bg-card/50 px-3 py-2.5">
              <div className="mb-2 flex items-center gap-2">
                <ArrowRightLeft className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-medium">{change.title}</span>
              </div>
              <div className="space-y-1 rounded-md bg-muted/30 px-2.5 py-2 font-mono text-[11px]">
                <div className="flex gap-2">
                  <span className="shrink-0 text-red-400">−</span>
                  <span className="text-muted-foreground">{change.before}</span>
                </div>
                <div className="flex gap-2">
                  <span className="shrink-0 text-emerald-400">+</span>
                  <span className="text-foreground/80">{change.after}</span>
                </div>
              </div>
              {change.inferredTool && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Wrench className="h-3 w-3 text-emerald-400" />
                  <span className="text-[11px] text-muted-foreground">{change.inferredTool}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
