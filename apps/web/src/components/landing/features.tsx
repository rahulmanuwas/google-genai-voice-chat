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
    <section className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            The integration layer the model providers don&apos;t ship
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The hard part was never the model. It&apos;s everything around it.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-[hsl(200_80%_55%/0.3)] hover:shadow-[0_0_30px_hsl(200_80%_55%/0.08)]"
            >
              <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-[hsl(200_80%_55%/0.1)] p-2.5">
                <Icon className="h-5 w-5 text-[hsl(200_80%_55%)]" />
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
