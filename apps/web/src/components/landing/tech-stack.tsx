import { Sparkles, Radio, Database, ArrowRight } from 'lucide-react';

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
    <section className="py-20 sm:py-28 lg:py-36 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Built on infrastructure that scales
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Not a wrapper. A platform.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6">
          {STACK.map(({ icon: Icon, name, role, description }, i) => (
            <div key={name} className="contents">
              <div className="w-full md:w-72 rounded-xl border border-border bg-card/50 p-6 text-center backdrop-blur-sm">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-lg bg-brand/10 p-3">
                  <Icon className="h-6 w-6 text-brand" />
                </div>
                <h3 className="text-lg font-semibold">{name}</h3>
                <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-brand">
                  {role}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
              {i < STACK.length - 1 && (
                <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
