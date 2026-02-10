import Link from 'next/link';
import {
  Headset,
  Bot,
  Cpu,
  Boxes,
  Plug,
  ArrowRight,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';
import { DotGrid } from './dot-grid';

const USE_CASES = [
  {
    icon: Headset,
    title: 'Customer Support',
    description:
      'Resolve issues on the first call — not the third. Your agent pulls booking data, executes changes, and knows when to transfer to a human. No "let me look into that" loops.',
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
      'Wire any internal API or MCP server as a tool. Your agent inspects, decides, and acts across your existing systems. No rip-and-replace.',
    href: '/tools',
    cta: 'View tools',
    featured: false,
  },
  {
    icon: Boxes,
    title: 'Omnichannel Operations',
    description:
      'One config runs across web, mobile, phone, and SMS. Same guardrail rules, same brand voice, every channel your customers use.',
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
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-200 hover:border-brand/20 hover:shadow-[0_0_40px_hsl(38_92%_50%/0.06)] ${
        featured ? 'sm:p-8' : ''
      }`}
    >
      {/* Hover glow line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-brand/[0.08] p-2.5 self-start">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <h3 className={`font-semibold mb-2 ${featured ? 'text-xl' : 'text-lg'}`}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
        {description}
      </p>
      <div className="mt-4 flex items-center text-sm font-medium text-brand">
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
    <section id="use-cases" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Ambient background — reuses the existing DotGrid component */}
      <DotGrid />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Where agents fail{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-secondary">
              — and how yours won&apos;t
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Most AI agents break on the same things: tool calls that hang, context
            that drifts, escalations that never happen. These are solved problems.
          </p>
        </FadeIn>

        {/* Bento grid: 2 featured on top, 3 below */}
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-6">
          {USE_CASES.map((uc, i) => (
            <FadeIn
              key={uc.title}
              delay={i * 0.08}
              className={
                i < 2
                  ? 'lg:col-span-3'
                  : 'sm:col-span-1 lg:col-span-2'
              }
            >
              <CaseCard {...uc} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
