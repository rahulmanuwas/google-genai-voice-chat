import React from 'react';
import { Settings, Plug, Activity, ChevronRight } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';

const STEPS = [
  {
    number: '01',
    icon: Settings,
    title: 'Configure',
    description:
      'Define persona, tools, guardrails, and knowledge in the dashboard, or scaffold the same setup with Pi CLI.',
  },
  {
    number: '02',
    icon: Plug,
    title: 'Connect',
    description:
      'Ship web voice with the React SDK, map phone via SIP, and launch chat or SMS without rebuilding the agent.',
  },
  {
    number: '03',
    icon: Activity,
    title: 'Monitor',
    description:
      'Track live transcripts, tool calls, and resolution metrics, then ship prompt and workflow updates in minutes.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Go live in days. Improve every day.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Configure once, connect every channel, and iterate from real conversation data.
          </p>
        </FadeIn>

        <div className="relative grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start">
          {STEPS.map(({ number, icon: Icon, title, description }, i) => (
            <React.Fragment key={number}>
              <FadeIn delay={i * 0.12}>
                <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-brand/20 hover:bg-brand/[0.02]">
                  {/* Large faded number */}
                  <span className="absolute top-4 right-5 text-5xl font-bold tabular-nums text-white/[0.04] select-none leading-none">
                    {number}
                  </span>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/[0.08]">
                      <Icon className="h-4 w-4 text-brand" />
                    </div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
              </FadeIn>

              {/* Chevron between cards (desktop only) */}
              {i < STEPS.length - 1 && (
                <FadeIn delay={i * 0.12 + 0.06} className="hidden md:flex items-center self-center">
                  <ChevronRight className="h-4 w-4 text-brand/40" />
                </FadeIn>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
