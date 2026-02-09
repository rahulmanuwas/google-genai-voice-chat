import Link from 'next/link';
import {
  Headset,
  Bot,
  Cpu,
  Boxes,
  Plug,
  ArrowRight,
} from 'lucide-react';

const USE_CASES = [
  {
    icon: Headset,
    title: 'Customer Support',
    description:
      'Eliminate hold times and resolve issues around the clock with natural voice conversations that know when to escalate to a human.',
    href: '/demos/livekit',
    cta: 'Try live demo',
    featured: true,
  },
  {
    icon: Bot,
    title: 'Manufacturing & Logistics',
    description:
      'Direct robots with natural language on the warehouse floor or assembly line. Integrate Physical Intelligence for pick-and-place, navigation, and manipulation.',
    href: null,
    cta: 'Coming soon',
    featured: true,
  },
  {
    icon: Cpu,
    title: 'R&D & Simulation',
    description:
      'Validate agent behaviors in simulation with Gemini Robotics ER before deploying to hardware — de-risk with sim-to-real confidence.',
    href: null,
    cta: 'Coming soon',
    featured: false,
  },
  {
    icon: Plug,
    title: 'Custom Workflows',
    description:
      'Wire up any internal tool, API, or MCP server as a skill. Agents inspect, decide, and act across your existing systems — no rip-and-replace.',
    href: '/tools',
    cta: 'View tools',
    featured: false,
  },
  {
    icon: Boxes,
    title: 'Omnichannel Operations',
    description:
      'One configuration runs across web, mobile, phone, and SMS. Same compliance rules and brand voice at every touchpoint your customers use.',
    href: '/demos/chatbot',
    cta: 'Try voice chat',
    featured: false,
  },
];

function CaseCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  featured,
}: (typeof USE_CASES)[number]) {
  const inner = (
    <div
      className={`group relative flex h-full flex-col rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-[hsl(200_80%_55%/0.3)] hover:shadow-[0_0_30px_hsl(200_80%_55%/0.06)] ${
        featured ? 'sm:p-8' : ''
      }`}
    >
      <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-[hsl(200_80%_55%/0.1)] p-2.5 self-start">
        <Icon className="h-5 w-5 text-[hsl(200_80%_55%)]" />
      </div>
      <h3 className={`font-semibold mb-2 ${featured ? 'text-xl' : 'text-lg'}`}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
        {description}
      </p>
      <div className="mt-4 flex items-center text-sm font-medium text-[hsl(200_80%_55%)]">
        {cta}
        {href && (
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{inner}</Link>;
  }
  return inner;
}

export function UseCases() {
  return (
    <section className="py-16 sm:py-24 lg:py-32 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Solving real problems{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[hsl(200_80%_55%)] to-[hsl(160_60%_45%)]">
              across industries
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From the call center to the factory floor — see how enterprises
            are deploying AI that works in production today.
          </p>
        </div>

        {/* Bento grid: 2 featured on top, 3 below */}
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-6">
          {USE_CASES.map((uc, i) => (
            <div
              key={uc.title}
              className={
                i < 2
                  ? 'lg:col-span-3'         // featured: half-width each
                  : 'sm:col-span-1 lg:col-span-2' // normal: third-width each
              }
            >
              <CaseCard {...uc} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
