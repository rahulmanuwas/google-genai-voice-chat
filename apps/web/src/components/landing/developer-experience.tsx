import Image from 'next/image';
import { Shield, Brain, BarChart3, Terminal } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';

const PROVIDERS = [
  {
    logo: '/logos/gemini.svg',
    name: 'Google',
    description: 'Gemini 3, Flash, embedding models',
  },
  {
    logo: '/logos/anthropic.svg',
    name: 'Anthropic',
    description: 'Claude Opus, Sonnet, Haiku',
  },
  {
    logo: '/logos/openai.svg',
    name: 'OpenAI',
    description: 'GPT-4o, o-series reasoning models',
  },
] as const;

const PLATFORM_FEATURES = [
  { icon: Shield, label: 'Guardrails' },
  { icon: Brain, label: 'Knowledge' },
  { icon: BarChart3, label: 'Analytics' },
];

export function DeveloperExperience() {
  return (
    <section id="developer" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, hsl(280 60% 50% / 0.04) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Built for developers who ship.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            One SDK. 22+ providers. Your choice.
          </p>
        </FadeIn>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Column 1: Pick Your Provider */}
          <FadeIn delay={0.08}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-5">
                Pick Your Provider
              </p>
              <div className="space-y-3">
                {PROVIDERS.map((provider, i) => (
                  <label
                    key={provider.name}
                    className={`flex items-center gap-4 rounded-lg border p-4 transition-colors cursor-pointer ${
                      i === 0
                        ? 'border-brand/30 bg-brand/[0.04]'
                        : 'border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      i === 0 ? 'border-brand' : 'border-white/20'
                    }`}>
                      {i === 0 && <div className="h-2 w-2 rounded-full bg-brand" />}
                    </div>
                    <Image
                      src={provider.logo}
                      alt={provider.name}
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{provider.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                    </div>
                  </label>
                ))}
                <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
                  + DeepSeek, Mistral, xAI, Groq, and 15+ more via Pi
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Column 2: Platform Layer */}
          <FadeIn delay={0.16}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-5">
                Platform Layer
              </p>
              <div className="flex flex-col items-center gap-4">
                {/* Provider boxes */}
                <div className="flex gap-2 w-full">
                  {['Google', 'Anthropic', 'OpenAI', '15+'].map((name) => (
                    <div
                      key={name}
                      className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] py-2 text-center text-xs text-muted-foreground"
                    >
                      {name}
                    </div>
                  ))}
                </div>

                {/* Arrow down */}
                <div className="flex flex-col items-center gap-0.5">
                  <div className="h-4 w-px bg-brand/30" />
                  <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-brand/30" />
                </div>

                {/* Platform wrapping */}
                <div className="w-full rounded-xl border border-brand/20 bg-brand/[0.04] p-4">
                  <p className="text-xs font-semibold text-brand/70 text-center mb-3">Riyaan Platform</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PLATFORM_FEATURES.map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg bg-background/40 p-2.5">
                        <Icon className="h-4 w-4 text-brand/70" />
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow down */}
                <div className="flex flex-col items-center gap-0.5">
                  <div className="h-4 w-px bg-brand/30" />
                  <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-brand/30" />
                </div>

                {/* Output */}
                <div className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] py-2.5 text-center text-xs text-muted-foreground">
                  Voice + Web + Phone + SMS
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Column 3: Embedded Terminal */}
          <FadeIn delay={0.24}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-5">
                Embedded Terminal
              </p>
              <div className="rounded-lg border border-white/[0.08] bg-[hsl(0_0%_4%)] overflow-hidden">
                {/* Terminal title bar */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  <span className="ml-2 text-[10px] text-muted-foreground/50">
                    <Terminal className="inline h-3 w-3 mr-1" />
                    agent-terminal
                  </span>
                </div>
                {/* Terminal content */}
                <div className="p-4 font-mono text-[11px] leading-relaxed">
                  <p className="text-muted-foreground/50">$ riyaan agent start --runtime pi</p>
                  <p className="text-brand/70 mt-1">Agent started with Pi runtime</p>
                  <p className="text-muted-foreground/50 mt-2">&gt; Add a warranty check tool</p>
                  <p className="text-foreground/60 mt-1">Created tool &quot;check_warranty&quot; with</p>
                  <p className="text-foreground/60">parameters: orderId (string)</p>
                  <p className="text-brand/70 mt-2">Tool registered and active.</p>
                  <p className="text-muted-foreground/50 mt-2">&gt; Add guardrail: block profanity</p>
                  <p className="text-foreground/60 mt-1">Guardrail &quot;profanity_filter&quot; added</p>
                  <p className="text-brand/70">with action: block</p>
                  <p className="text-muted-foreground/30 mt-2 animate-pulse">_</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Credibility footnote */}
        <FadeIn delay={0.35}>
          <p className="mt-8 text-center text-xs text-muted-foreground/40">
            Pi gives you access to Anthropic, OpenAI, Google, DeepSeek, Mistral, xAI, Groq, and 15+ more providers.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
