import Image from 'next/image';
import Link from 'next/link';
import {
  Headset,
  CalendarCheck,
  Boxes,
  Mic,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';
import { DotGrid } from './dot-grid';

const USER_CASES = [
  {
    icon: Headset,
    title: 'Customer Support',
    description:
      'Resolve on the first call. Your agent pulls data, executes changes, and knows when to hand off.',
    href: '/demos/livekit',
    cta: 'Try live demo',
    featured: true,
    image: '/images/customer-support-2.jpg',
  },
  {
    icon: CalendarCheck,
    title: 'Sales & Appointments',
    description:
      'Qualify leads, book meetings, and close deals over voice. Real-time CRM sync and follow-up scheduling.',
    href: '/demos/livekit',
    cta: 'Try live demo',
    featured: true,
    image: '/images/logistics.jpg',
  },
  {
    icon: Boxes,
    title: 'Omnichannel',
    description:
      'Web, phone, and SMS from one config. Same rules, same voice, every channel.',
    href: '/demos/chatbot',
    cta: 'Try voice chat',
    featured: false,
    image: null,
  },
];

const DEV_CASES = [
  {
    icon: Mic,
    title: 'Voice-Driven Development',
    description:
      'Talk to build agents. Add tools, guardrails, and knowledge by voice. Powered by Pi with 22+ providers.',
    href: '#developer',
    cta: 'Learn more',
    featured: false,
    image: null,
  },
  {
    icon: Layers,
    title: 'Any Model, Any Provider',
    description:
      'Switch between 22+ providers mid-session. Same guardrails, same analytics.',
    href: '#developer',
    cta: 'Learn more',
    featured: false,
    image: null,
  },
];

type CaseData = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string | null;
  cta: string;
  featured: boolean;
  image: string | null;
};

function CaseCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  featured,
  image,
}: CaseData) {
  const inner = (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-brand/20 hover:shadow-[0_0_40px_hsl(38_92%_50%/0.06)] ${
        featured ? '' : 'p-6'
      }`}
    >
      {/* Hover glow line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-10" />

      {/* Image for featured cards */}
      {featured && image && (
        <div className="relative h-44 sm:h-52 w-full overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          {/* Bottom fade so text below is readable */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, hsl(0 0% 5.5%) 0%, hsl(0 0% 5.5% / 0.4) 50%, transparent 100%)',
            }}
          />
        </div>
      )}

      <div className={featured ? 'p-6 sm:p-8 -mt-6 relative' : ''}>
        <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-brand/[0.08] p-2.5 self-start">
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
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Tool calls that hang, context that drifts, escalations that never happen. Solved.
          </p>
        </FadeIn>

        {/* What your agents do — user-facing */}
        <FadeIn delay={0.08}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-4">What your agents do</p>
        </FadeIn>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12 sm:mb-16">
          {USER_CASES.map((uc, i) => (
            <FadeIn
              key={uc.title}
              delay={i * 0.08 + 0.1}
              className="lg:col-span-1"
            >
              <CaseCard {...uc} />
            </FadeIn>
          ))}
        </div>

        {/* What you can build — developer-facing */}
        <FadeIn delay={0.3}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-4">What you can build</p>
        </FadeIn>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          {DEV_CASES.map((uc, i) => (
            <FadeIn key={uc.title} delay={i * 0.08 + 0.35}>
              <CaseCard {...uc} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
