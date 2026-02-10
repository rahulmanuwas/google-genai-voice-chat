import { Settings, Plug, Activity } from 'lucide-react';

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
    <section className="py-20 sm:py-28 lg:py-36 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Days to production. Not quarters.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Self-serve with the platform, or let our team handle deployment end-to-end. Either way, three steps.
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3 md:gap-8">
          {/* Connecting line (desktop only) */}
          <div className="absolute top-12 left-[16.67%] right-[16.67%] hidden md:block">
            <div className="h-px bg-gradient-to-r from-brand/50 via-brand/30 to-brand/50" />
          </div>

          {STEPS.map(({ number, icon: Icon, title, description }) => (
            <div key={number} className="relative text-center">
              <div className="mx-auto mb-4 sm:mb-6 flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-full border border-brand/30 bg-brand/6">
                <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
              </div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-brand">
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
