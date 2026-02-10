import Link from 'next/link';
import { FadeIn } from '@/components/ui/fade-in';

export function CTAFooter() {
  return (
    <>
      {/* CTA */}
      <section className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
        {/* Elevated background — gradient + ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 60%, hsl(38 92% 50% / 0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, hsl(16 75% 48% / 0.05) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-6">
              Platform when you want to self-serve.
              <br className="hidden sm:block" />
              Team when you don&apos;t.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Start with the dashboard and live demos. When you&apos;re ready to go to production, our
              engineers deploy alongside yours.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/overview"
                className="group inline-flex items-center justify-center rounded-full bg-brand px-10 py-3.5 text-sm font-semibold text-background transition-all hover:brightness-110 shadow-[0_0_24px_hsl(38_92%_50%/0.25),0_0_60px_hsl(38_92%_50%/0.1)]"
              >
                Open Dashboard
                <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="https://www.linkedin.com/in/rahulmanuwas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-10 py-3.5 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:border-white/15"
              >
                Connect on LinkedIn
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-center sm:text-left">
          <span className="text-sm font-semibold tracking-tight text-muted-foreground">
            <span className="text-brand">.</span>Riyaan
          </span>
          <p className="text-xs text-muted-foreground/60">
            Enterprise AI platform — built with Gemini, LiveKit &amp; Convex
          </p>
        </div>
      </footer>
    </>
  );
}
