import Image from 'next/image';
import Link from 'next/link';
import { DemoShowcase } from './demo-showcase';
import { ShaderBackground } from './shader-bg';

const LOGOS = [
  { src: '/logos/gemini.svg', alt: 'Gemini', className: 'w-20 sm:w-24 opacity-40', width: 96, height: 32 },
  { src: '/logos/livekit.svg', alt: 'LiveKit', className: 'w-16 sm:w-20 opacity-40', width: 80, height: 24 },
  { src: '/logos/convex.svg', alt: 'Convex', className: 'w-20 sm:w-24 opacity-40', width: 96, height: 24 },
  { src: '/logos/nextjs.svg', alt: 'Next.js', className: 'w-16 sm:w-20 opacity-40', width: 80, height: 24 },
  { src: '/logos/typescript.svg', alt: 'TypeScript', className: 'h-5 w-auto rounded-[3px] opacity-40', width: 80, height: 20 },
  { src: '/logos/twilio.png', alt: 'Twilio', className: 'w-14 sm:w-18 brightness-0 invert opacity-40', width: 72, height: 28 },
] as const;

export function Hero() {
  return (
    <section id="hero" className="relative min-h-[100svh] flex flex-col overflow-hidden">
      <ShaderBackground />

      {/* Centered content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 sm:px-6 pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-16">
          {/* Badge */}
          <div
            className="inline-flex items-center rounded-full border border-brand/20 bg-brand/[0.06] px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm text-brand mb-6 sm:mb-8 backdrop-blur-sm"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.1s both' }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            AI Voice Agent Platform
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.15s both' }}
          >
            Build, deploy, and scale{' '}
            <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand via-[hsl(28_85%_49%)] to-brand-secondary">
              AI agents.
            </span>
          </h1>

          {/* Tagline */}
          <p
            className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.25s both' }}
          >
            An open-source platform with guardrails, tool integration,
            human handoffs, and multi-channel support — so you ship
            products, not infrastructure.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.35s both' }}
          >
            <a
              href="#try"
              className="group inline-flex items-center justify-center rounded-full bg-brand px-8 py-3 text-sm font-semibold text-background transition-all hover:brightness-110 shadow-[0_0_20px_hsl(38_92%_50%/0.2)]"
            >
              Try It Live
              <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <Link
              href="/overview"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-8 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:border-white/15"
            >
              Open Dashboard
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

        {/* Built with marquee */}
        <div
          className="mt-10 sm:mt-14 w-full flex flex-col items-center gap-3 overflow-hidden"
          style={{ animation: 'fade-in-up 0.6s ease-out 0.6s both' }}
        >
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/40 font-medium">
            Built with
          </span>
          <div className="relative w-full max-w-3xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-[marquee_20s_linear_infinite] items-center gap-10">
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex items-center gap-10 shrink-0">
                  {LOGOS.map((logo) => (
                    <Image
                      key={`${setIdx}-${logo.alt}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={logo.width}
                      height={logo.height}
                      className={logo.className}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
}
