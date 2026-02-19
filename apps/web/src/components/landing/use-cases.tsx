import Link from 'next/link';
import {
  Headset,
  CalendarCheck,
  Boxes,
  Mic,
  Layers,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';
import { DotGrid } from './dot-grid';

const USE_CASES = [
  {
    icon: Headset,
    title: 'Customer Support',
    description:
      'Resolve billing, order, and account issues in one call, with clean handoff when needed.',
    href: '/demos/livekit',
    cta: 'Try live demo',
    tag: 'Operations',
  },
  {
    icon: CalendarCheck,
    title: 'Sales & Appointments',
    description:
      'Qualify leads, book meetings, and run follow-ups from the same agent workflow.',
    href: '/demos/livekit',
    cta: 'Try live demo',
    tag: 'Revenue',
  },
  {
    icon: Boxes,
    title: 'Omnichannel Routing',
    description:
      'Deploy one agent config to web, phone, and SMS with consistent behavior across channels.',
    href: '/demos/chatbot',
    cta: 'Try voice chat',
    tag: 'Platform',
  },
  {
    icon: Mic,
    title: 'Self-Healing Runtime',
    description:
      'Watch Pi recover from context overflow, retry with fallback models, and keep the session moving.',
    href: '/?track=developer#try',
    cta: 'Run resilience demo',
    tag: 'Developer',
    proof: 'Fallback + context recovery telemetry',
  },
  {
    icon: Layers,
    title: 'Policy-Aware Tooling',
    description:
      'Apply layered allow and deny rules, then verify blocked tools and approvals in one session.',
    href: '/?track=developer#try',
    cta: 'See policy controls',
    tag: 'Developer',
    proof: 'Tool policy decisions + run metadata',
  },
  {
    icon: Shield,
    title: 'Compliant Automation',
    description:
      'Enforce policy with guardrails, approval steps, and audit logs before actions are executed.',
    href: '#features',
    cta: 'Explore controls',
    tag: 'Trust & Safety',
  },
];

type CaseData = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  cta: string;
  tag: string;
  proof?: string;
};

function CaseCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  tag,
  proof,
}: CaseData) {
  const inner = (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-brand/20 hover:shadow-[0_0_40px_hsl(38_92%_50%/0.06)]">
      {/* Hover glow line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-10" />

      <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-brand/70">
        <div className="h-1.5 w-1.5 rounded-full bg-brand/70" />
        {tag}
      </div>
      <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-brand/[0.08] p-2.5 self-start">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
        {description}
      </p>
      {proof && (
        <p className="mt-3 text-[11px] text-brand/80">{proof}</p>
      )}
      <div className="mt-4 flex items-center text-sm font-medium text-brand">
        {cta}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );

  return <Link href={href} className="block h-full">{inner}</Link>;
}

export function UseCases() {
  return (
    <section id="use-cases" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Ambient background — reuses the existing DotGrid component */}
      <DotGrid />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Six voice agent workflows you can run today
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From support calls to developer build loops, each path maps to a live demo with observable runtime behavior.
          </p>
        </FadeIn>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((useCase, i) => (
            <FadeIn key={useCase.title} delay={i * 0.08 + 0.08}>
              <CaseCard {...useCase} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
