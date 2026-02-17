import {
  AudioLines,
  BookOpen,
  Shield,
  BarChart3,
  FlaskConical,
  Layers,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';

const FEATURES = [
  {
    icon: AudioLines,
    title: 'Realtime + Omnichannel',
    description:
      'Sub-second voice with Gemini + LiveKit, deployed to web, mobile, and phone from one config.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description:
      'Vector-powered RAG with Gemini embeddings. Answers from your docs — or says it doesn\'t know.',
  },
  {
    icon: Shield,
    title: 'Guardrails',
    description:
      'Block, warn, or log per rule with full audit trail. Real-time, not after the fact.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'CSAT, conversation clustering, tool usage, and guardrail violations in one dashboard.',
  },
  {
    icon: FlaskConical,
    title: 'A/B Testing',
    description:
      'Weighted experiments with sticky sessions. Compare prompts and flows with production data.',
  },
  {
    icon: Layers,
    title: '22+ Providers',
    description:
      'Google, Anthropic, OpenAI, DeepSeek, Mistral, xAI, Groq, and more — all through Pi. Switch models mid-session. Your guardrails and analytics work across all of them.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28 lg:py-36 overflow-hidden">
      {/* Subtle radial glow to differentiate from adjacent sections */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse, hsl(38 92% 50% / 0.04) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Everything around the model
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            The hard part was never the model. It&apos;s the integration layer.
          </p>
        </FadeIn>

        {/* Six core platform capabilities */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <FadeIn key={title} delay={i * 0.08}>
              <div className="group relative overflow-hidden rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-200 hover:border-brand/20 hover:shadow-[0_0_40px_hsl(38_92%_50%/0.06)] h-full">
                {/* Hover glow line at top */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-brand/[0.08] p-2.5">
                  <Icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
