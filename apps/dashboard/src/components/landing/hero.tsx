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
        <span className="text-base font-medium tracking-tight">
          <span className="text-[hsl(200_80%_55%)]">.</span>Riyaan
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
        className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(0_0%_100%/0.05)]"
      >
        Dashboard
      </Link>
    </nav>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      <DotGrid />
      <Navbar />

      {/* Centered content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-16">
        <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-16">
          {/* Badge */}
          <div
            className="inline-flex items-center rounded-full border border-[hsl(200_80%_55%/0.25)] bg-[hsl(200_80%_55%/0.06)] px-4 py-1.5 text-sm text-[hsl(200_80%_55%)] mb-8 backdrop-blur-sm"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.1s both' }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[hsl(200_80%_55%)] animate-pulse" />
            Enterprise-Ready AI Platform
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.15s both' }}
          >
            Enterprise AI{' '}
            <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[hsl(200_80%_55%)] via-[hsl(180_70%_50%)] to-[hsl(160_60%_45%)]">
              that actually ships
            </span>
          </h1>

          {/* Tagline */}
          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.25s both' }}
          >
            Automate customer conversations, control physical systems, and deploy
            intelligent agents across every channel — with guardrails, observability,
            and compliance built in.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.35s both' }}
          >
            <Link
              href="/overview"
              className="group inline-flex items-center justify-center rounded-full bg-foreground px-8 py-3 text-sm font-semibold text-background transition-all hover:opacity-90"
            >
              Get Started
              <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/demos/livekit"
              className="inline-flex items-center justify-center rounded-full border border-border px-8 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-[hsl(0_0%_100%/0.05)]"
            >
              View Demos
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
