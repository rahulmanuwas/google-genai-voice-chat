import Link from 'next/link';
import { DotGrid } from './dot-grid';
import { DemoShowcase } from './demo-showcase';

function Navbar() {
  return (
    <nav
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 sm:px-10 py-5"
      style={{ animation: 'fade-in-up 0.5s ease-out both' }}
    >
      <div className="flex items-center gap-8">
        <span className="text-base font-semibold tracking-tight">
          <span className="text-brand">.</span>Riyaan
        </span>
        <div className="hidden md:flex items-center gap-6">
          <Link href="/demos/livekit" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Demos
          </Link>
          <Link href="/docs" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Docs
          </Link>
        </div>
      </div>
      <Link
        href="/overview"
        className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:border-white/15"
      >
        Dashboard
      </Link>
    </nav>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-[100svh] flex flex-col overflow-hidden">
      <DotGrid />
      <Navbar />

      {/* Centered content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 sm:px-6 pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-16">
          {/* Badge */}
          <div
            className="inline-flex items-center rounded-full border border-brand/20 bg-brand/[0.06] px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm text-brand mb-6 sm:mb-8 backdrop-blur-sm"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.1s both' }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            Platform + Expertise
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.15s both' }}
          >
            The models work.{' '}
            <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand via-[hsl(28_85%_49%)] to-brand-secondary">
              Deploying them doesn&apos;t.
            </span>
          </h1>

          {/* Tagline */}
          <p
            className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.25s both' }}
          >
            Guardrails, tool integration, human handoffs, multi-channel
            deployment — the hard parts are built in. And when you need hands-on
            help, our team deploys alongside yours.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.35s both' }}
          >
            <Link
              href="/overview"
              className="group inline-flex items-center justify-center rounded-full bg-brand px-8 py-3 text-sm font-semibold text-background transition-all hover:brightness-110 shadow-[0_0_20px_hsl(38_92%_50%/0.2)]"
            >
              Open Dashboard
              <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/demos/livekit"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-8 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:border-white/15"
            >
              See it handle a live call
            </Link>
          </div>
        </div>

        {/* Demo showcase card */}
        <div
          className="w-full max-w-4xl"
          style={{ animation: 'fade-in-up 0.8s ease-out 0.5s both' }}
        >
          <DemoShowcase />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
}
