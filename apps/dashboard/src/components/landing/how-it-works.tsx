import { Settings, Plug, Activity } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Settings,
    title: 'Configure',
    description:
      'Set up your persona, knowledge base, guardrails, and tools through the dashboard or API.',
  },
  {
    number: '02',
    icon: Plug,
    title: 'Connect',
    description:
      'Drop in the React SDK or wire up PSTN via SIP. Your agent goes live in minutes, not months.',
  },
  {
    number: '03',
    icon: Activity,
    title: 'Monitor',
    description:
      'Watch conversations in real time, track CSAT, review guardrail violations, and iterate with data.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 sm:py-32 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Three steps to production
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Go from zero to production without stitching together a dozen services.
          </p>
        </div>

        <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
          {/* Connecting line (desktop only) */}
          <div className="absolute top-12 left-[16.67%] right-[16.67%] hidden md:block">
            <div className="h-px bg-gradient-to-r from-[hsl(200_80%_55%/0.5)] via-[hsl(200_80%_55%/0.3)] to-[hsl(200_80%_55%/0.5)]" />
          </div>

          {STEPS.map(({ number, icon: Icon, title, description }) => (
            <div key={number} className="relative text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[hsl(200_80%_55%/0.3)] bg-[hsl(200_80%_55%/0.06)]">
                <Icon className="h-8 w-8 text-[hsl(200_80%_55%)]" />
              </div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[hsl(200_80%_55%)]">
                Step {number}
              </span>
              <h3 className="text-xl font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
