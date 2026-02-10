import { Sparkles, Radio, Database, ArrowRight } from 'lucide-react';

const STACK = [
  {
    icon: Sparkles,
    name: 'Google Gemini',
    role: 'AI Engine',
    description:
      'Multimodal real-time model for voice understanding, generation, and tool use.',
  },
  {
    icon: Radio,
    name: 'LiveKit',
    role: 'Transport',
    description:
      'WebRTC infrastructure with SIP bridging for sub-100ms audio streaming.',
  },
  {
    icon: Database,
    name: 'Convex',
    role: 'Backend',
    description:
      'Reactive database with built-in vector search, real-time sync, and serverless functions.',
  },
];

export function TechStack() {
  return (
    <section className="py-16 sm:py-24 lg:py-32 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Built on the modern stack
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Best-in-class infrastructure at every layer.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6">
          {STACK.map(({ icon: Icon, name, role, description }, i) => (
            <div key={name} className="contents">
              <div className="w-full md:w-72 rounded-xl border border-border bg-card/50 p-6 text-center backdrop-blur-sm">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-lg bg-[hsl(200_80%_55%/0.1)] p-3">
                  <Icon className="h-6 w-6 text-[hsl(200_80%_55%)]" />
                </div>
                <h3 className="text-lg font-semibold">{name}</h3>
                <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[hsl(200_80%_55%)]">
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
