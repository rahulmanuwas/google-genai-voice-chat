import React from 'react';
import { Settings, Plug, Activity, ChevronRight } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';
import { WaveVisualizer } from './wave-visualizer';

const STEPS = [
  {
    number: '01',
    icon: Settings,
    title: 'Configure',
    description:
      'Set your persona, knowledge base, guardrail rules, and tools through the dashboard. Or use the API if that\'s more your speed.',
  },
  {
    number: '02',
    icon: Plug,
    title: 'Connect',
    description:
      'Drop in the React SDK for web. Point a SIP trunk for phone. Your agent handles its first call today.',
  },
  {
    number: '03',
    icon: Activity,
    title: 'Monitor',
    description:
      'Watch conversations live, review blocked inputs, track resolution rates, and iterate. Ship improvements in minutes, not sprints.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Days to production. Not quarters.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Three steps from zero to production.
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

        {/* WaveVisualizer as visual divider — reinforces "voice" identity */}
        <FadeIn delay={0.2} className="mt-16 sm:mt-24 opacity-60">
          <WaveVisualizer />
        </FadeIn>
      </div>
    </section>
  );
}
