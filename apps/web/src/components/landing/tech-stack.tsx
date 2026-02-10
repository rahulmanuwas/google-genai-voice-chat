import { Sparkles, Radio, Database } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';

const STACK = [
  {
    icon: Sparkles,
    name: 'Google Gemini',
    role: 'AI Engine',
    description:
      'Native multimodal model for real-time voice understanding, generation, and tool calling. Speech-to-speech, not speech-to-text-to-speech.',
  },
  {
    icon: Radio,
    name: 'LiveKit',
    role: 'Transport',
    description:
      'WebRTC with SIP bridging. Sub-100ms audio. Your agent sounds like it\'s in the room, whether the user is on Chrome or a landline.',
  },
  {
    icon: Database,
    name: 'Convex',
    role: 'Backend',
    description:
      'Reactive database with native vector search, real-time sync, and serverless compute. Memory, tools, and guardrails — all in one place.',
  },
];

export function TechStack() {
  return (
    <section id="tech-stack" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Subtle gradient band across the section */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, hsl(0 0% 3%) 15%, hsl(0 0% 5%) 50%, hsl(0 0% 3%) 85%, transparent 100%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Built on infrastructure that scales
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Not a wrapper. A platform.
          </p>
        </FadeIn>

        {/* Horizontal flow on desktop, stacked on mobile */}
        <div className="grid gap-6 md:grid-cols-3">
          {STACK.map(({ icon: Icon, name, role, description }, i) => (
            <FadeIn key={name} delay={i * 0.12}>
              <div className="group relative h-full rounded-xl border border-border bg-card/50 p-6 sm:p-8 text-center backdrop-blur-sm transition-all duration-200 hover:border-brand/20">
                {/* Step indicator */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-background border border-brand/30 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand">
                    {role}
                  </span>
                </div>

                {/* Hover glow */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                <div className="mx-auto mb-4 mt-2 inline-flex items-center justify-center rounded-xl bg-brand/10 p-3.5">
                  <Icon className="h-7 w-7 text-brand" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>

                {/* Connecting arrow (desktop only, not on last item) */}
                {i < STACK.length - 1 && (
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center h-6 w-6 rounded-full bg-background border border-border z-10">
                    <svg className="h-3 w-3 text-brand/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
