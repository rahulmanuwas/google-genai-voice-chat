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
      'Sub-second latency with Gemini multimodal and LiveKit WebRTC. Natural conversations, not robotic IVRs.',
  },
  {
    icon: Globe,
    title: 'Multi-channel',
    description:
      'Web, mobile, and PSTN phone calls from one codebase. Telnyx voice, Twilio SMS — provider-agnostic adapters.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description:
      'Vector-powered RAG with Gemini embeddings. Your agent answers from your docs, not hallucinations.',
  },
  {
    icon: Shield,
    title: 'Guardrails',
    description:
      'Pattern-based content filtering with block, warn, and log actions. Full audit trail on every violation.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'CSAT ratings, conversation insights, tool usage metrics, and AI-generated summaries in real time.',
  },
  {
    icon: FlaskConical,
    title: 'A/B Testing',
    description:
      'Weighted experiment assignment with sticky sessions. Compare personas, prompts, and flows with data.',
  },
];

export function Features() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Built for enterprise from day one
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Guardrails, compliance, observability, and scale — not bolted on, built in.
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
