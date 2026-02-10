import {
  AudioLines,
  Globe,
  BookOpen,
  Shield,
  BarChart3,
  FlaskConical,
} from 'lucide-react';

const FEATURES = [
  {
    icon: AudioLines,
    title: 'Real-time Voice',
    description:
      'Sub-second voice with Gemini multimodal and LiveKit WebRTC. Sounds like a person, not a phone tree.',
  },
  {
    icon: Globe,
    title: 'Multi-channel',
    description:
      'Web, mobile, and PSTN from one config. Telnyx voice, Twilio SMS — same agent, same rules, every channel.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description:
      'Vector-powered RAG with Gemini embeddings. Your agent answers from your docs. When it doesn\'t know, it says so.',
  },
  {
    icon: Shield,
    title: 'Guardrails',
    description:
      'Block, warn, or log — per rule, per direction, with full audit trail. Input guardrails interrupt in real time, not after the fact.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'CSAT, conversation clustering, tool usage, and guardrail violations. Know what\'s working before your customers tell you what isn\'t.',
  },
  {
    icon: FlaskConical,
    title: 'A/B Testing',
    description:
      'Weighted experiments with sticky sessions. Compare personas, prompts, and escalation flows with production data, not gut feel.',
  },
];

export function Features() {
  return (
    <section className="py-20 sm:py-28 lg:py-36">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            The integration layer the model providers don&apos;t ship
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The hard part was never the model. It&apos;s everything around it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-200 hover:border-brand/20 hover:shadow-[0_0_40px_hsl(38_92%_50%/0.06)]"
            >
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
          ))}
        </div>
      </div>
    </section>
  );
}
