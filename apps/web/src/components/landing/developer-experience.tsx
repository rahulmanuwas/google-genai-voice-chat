'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Shield, Brain, BarChart3, Terminal, Sparkles, Radio, Database } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';

const PROVIDERS = [
  {
    id: 'google',
    logo: '/logos/gemini.svg',
    name: 'Google',
    description: 'Gemini 3, Flash, embedding models',
    model: 'gemini-3-flash-preview',
    logoWidth: 74,
    logoHeight: 24,
  },
  {
    id: 'anthropic',
    logo: '/logos/anthropic.svg',
    name: 'Anthropic',
    description: 'Claude Opus, Sonnet, Haiku',
    model: 'claude-sonnet-4-5',
    logoWidth: 94,
    logoHeight: 24,
  },
  {
    id: 'openai',
    logo: '/logos/openai.svg',
    name: 'OpenAI',
    description: 'GPT-4o, o-series reasoning models',
    model: 'gpt-4.1',
    logoWidth: 80,
    logoHeight: 24,
  },
] as const;

const STACK = [
  {
    icon: Sparkles,
    name: 'Gemini',
    role: 'AI Engine',
    description: 'Native multimodal reasoning for realtime voice and tool use.',
  },
  {
    icon: Radio,
    name: 'LiveKit',
    role: 'Transport',
    description: 'WebRTC + SIP transport for browser, phone, and PSTN calls.',
  },
  {
    icon: Database,
    name: 'Convex',
    role: 'Backend',
    description: 'Realtime state, memory, tracing, and workflow orchestration.',
  },
] as const;

const PLATFORM_FEATURES = [
  { icon: Shield, label: 'Guardrails' },
  { icon: Brain, label: 'Knowledge' },
  { icon: BarChart3, label: 'Analytics' },
] as const;

export function DeveloperExperience() {
  const [selectedProvider, setSelectedProvider] = useState(0);
  const provider = PROVIDERS[selectedProvider];

  return (
    <section id="developer" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, hsl(38 92% 50% / 0.05) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Developer mode, infrastructure, and quickstart in one place
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            One SDK, 22+ providers, and a mobile-friendly path from runtime setup to production telemetry.
          </p>
        </FadeIn>

        <FadeIn delay={0.06}>
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {STACK.map(({ icon: Icon, name, role, description }) => (
              <div
                key={name}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5"
              >
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-brand/80">
                  <Icon className="h-3.5 w-3.5" />
                  {role}
                </div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Column 1: Provider selection */}
          <FadeIn delay={0.08}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6 h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-5">
                Pick Your Provider
              </p>

              {/* Mobile: compact horizontal selector */}
              <div className="md:hidden -mx-1 overflow-x-auto pb-1">
                <div className="flex w-max gap-2 px-1">
                  {PROVIDERS.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedProvider(i)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        i === selectedProvider
                          ? 'border-brand/40 bg-brand/12 text-brand'
                          : 'border-white/[0.08] bg-background/50 text-muted-foreground'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop: rich provider cards */}
              <div className="hidden md:block space-y-3">
                {PROVIDERS.map((provider, i) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProvider(i)}
                    className={`flex w-full items-center gap-4 rounded-lg border p-4 transition-colors cursor-pointer text-left ${
                      i === selectedProvider
                        ? 'border-brand/30 bg-brand/[0.04]'
                        : 'border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      i === selectedProvider ? 'border-brand' : 'border-white/20'
                    }`}>
                      {i === selectedProvider && <div className="h-2 w-2 rounded-full bg-brand" />}
                    </div>
                    <div className="flex h-6 w-[98px] shrink-0 items-center">
                      <Image
                        src={provider.logo}
                        alt={provider.name}
                        width={provider.logoWidth}
                        height={provider.logoHeight}
                        className="h-5 w-auto object-contain opacity-90"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{provider.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-white/[0.08] bg-background/55 p-3">
                <p className="text-xs font-semibold">{provider.name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{provider.description}</p>
                <p className="mt-2 font-mono text-[11px] text-brand/80">model: {provider.model}</p>
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-center pt-3">
                + DeepSeek, Mistral, xAI, Groq, and 15+ more via Pi
              </p>
            </div>
          </FadeIn>

          {/* Column 2: Platform Layer */}
          <FadeIn delay={0.16}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6 h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-5">
                Platform Layer
              </p>
              <div className="flex flex-col items-center gap-4">
                {/* Provider boxes */}
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                  {['Google', 'Anthropic', 'OpenAI', '15+'].map((name) => (
                    <div
                      key={name}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] py-2 text-center text-xs text-muted-foreground"
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
                  Voice + Web + Phone + SMS with consistent runtime behavior
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Column 3: Embedded Terminal */}
          <FadeIn delay={0.24}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6 h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-5">
                Agent Terminal
              </p>
              <div className="rounded-lg border border-white/[0.08] bg-[hsl(0_0%_4%)] overflow-hidden">
                {/* Terminal title bar */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  <span className="ml-2 text-[10px] text-muted-foreground/50">
                    <Terminal className="inline h-3 w-3 mr-1" aria-hidden="true" />
                    agent-terminal
                  </span>
                  <span className="ml-auto rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[9px] font-medium text-brand/70 uppercase tracking-wider">Preview</span>
                </div>
                {/* Terminal content */}
                <div className="p-4 font-mono text-[10px] sm:text-[11px] leading-relaxed overflow-x-auto">
                  <p className="text-muted-foreground/50">$ riyaan agent deploy --provider {provider.name.toLowerCase()}</p>
                  <p className="text-brand/70 mt-1">Deploying with {provider.name}...</p>
                  <p className="text-foreground/60 mt-1">  Model: {provider.model}</p>
                  <p className="text-foreground/60">  Guardrails: 3 active rules</p>
                  <p className="text-foreground/60">  Tools: check_warranty, book_appointment</p>
                  <p className="text-brand/70 mt-2">Agent live on wss://your-app.livekit.cloud</p>
                  <p className="text-muted-foreground/50 mt-2">$ riyaan test call --scenario dentist</p>
                  <p className="text-foreground/60 mt-1">Calling +1 (555) 012-3456...</p>
                  <p className="text-brand/70 mt-1">Connected. Speak to test your agent.</p>
                  <p className="text-muted-foreground/30 mt-2 animate-pulse">_</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.3}>
          <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/60 mb-4">
              SDK Quickstart
            </p>
            <div className="rounded-lg border border-white/[0.08] bg-[hsl(0_0%_4%)] p-4 font-mono text-[11px] sm:text-[12px] leading-relaxed overflow-x-auto">
              <p className="text-muted-foreground/50">import {'{'} createAgent {'}'} from &apos;@genai-voice/sdk/agent&apos;;</p>
              <p className="text-muted-foreground/50">import {'{'} createConvexRoomCallbacks {'}'} from &apos;@genai-voice/sdk&apos;;</p>
              <p className="mt-2 text-foreground/70">const agent = await createAgent({'{'} provider: &apos;{provider.id}&apos;, model: &apos;{provider.model}&apos; {'}'});</p>
              <p className="text-foreground/70">const callbacks = createConvexRoomCallbacks({'{'} convexUrl, appSlug, getSessionToken {'}'});</p>
              <p className="mt-2 text-brand/80">// same guardrails, tools, and analytics across providers</p>
            </div>
          </div>
        </FadeIn>

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
