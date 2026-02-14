import { Check } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';

const TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'Start building and testing with real conversations.',
    features: [
      '100 resolved conversations / mo',
      '1 agent',
      'Community support',
      'Basic analytics',
      'React SDK',
    ],
    cta: 'Start Free',
    href: '#try',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'Per outcome',
    description: 'Pay only when your agent resolves a conversation.',
    features: [
      'Unlimited agents & conversations',
      'Tool integration & guardrails',
      'A/B testing & experiments',
      'RAG knowledge base',
      'Priority support',
      'Multi-channel (web, phone, SMS)',
    ],
    cta: 'Get Started',
    href: '#try',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For teams that need SLAs and custom outcome definitions.',
    features: [
      'Everything in Pro',
      'Custom outcome definitions',
      'SSO & role-based access',
      'Dedicated support & SLA',
      'On-prem deployment option',
      'Custom integrations',
    ],
    cta: 'Contact Us',
    href: 'mailto:rahul@riyaan.xyz',
    highlight: false,
  },
];


export function Pricing() {
  return (
    <section id="pricing" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 40%, hsl(38 92% 50% / 0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Pay for outcomes, not seats.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Charged per resolved conversation. Escalations? Free.
          </p>
        </FadeIn>

        {/* Tiers */}
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {TIERS.map((tier, i) => (
            <FadeIn key={tier.name} delay={i * 0.1}>
              <div
                className={`relative flex h-full flex-col rounded-xl border p-6 sm:p-8 transition-colors ${
                  tier.highlight
                    ? 'border-brand/40 bg-brand/[0.04]'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-background">
                    Most Popular
                  </span>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                    {tier.price}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={tier.href}
                  className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
                    tier.highlight
                      ? 'bg-brand text-background hover:brightness-110 shadow-[0_0_16px_hsl(38_92%_50%/0.2)]'
                      : 'border border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:border-white/15'
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}
