import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Code2 } from 'lucide-react';
import { DemoShowcase } from './demo-showcase';
import { ShaderBackground } from './shader-bg';

const LOGOS = [
  { src: '/logos/google.svg', alt: 'Google', className: 'h-5 sm:h-6 w-auto opacity-50', width: 96, height: 32 },
  { src: '/logos/anthropic.svg', alt: 'Anthropic', className: 'h-4 sm:h-5 w-auto opacity-50 text-white', width: 120, height: 14 },
  { src: '/logos/openai.svg', alt: 'OpenAI', className: 'h-5 sm:h-6 w-auto opacity-50 text-white', width: 120, height: 32 },
  { src: '/logos/livekit.svg', alt: 'LiveKit', className: 'h-5 sm:h-6 w-auto opacity-50', width: 80, height: 24 },
  { src: '/logos/convex.svg', alt: 'Convex', className: 'h-5 sm:h-6 w-auto opacity-50', width: 96, height: 24 },
  { src: '/logos/nextjs.svg', alt: 'Next.js', className: 'h-5 sm:h-6 w-auto opacity-50', width: 80, height: 24 },
  { src: '/logos/typescript.svg', alt: 'TypeScript', className: 'h-5 sm:h-6 w-auto rounded-[3px] opacity-50', width: 20, height: 20 },
  { src: '/logos/twilio.png', alt: 'Twilio', className: 'h-5 sm:h-6 w-auto brightness-0 invert opacity-50', width: 72, height: 24 },
] as const;

export function Hero() {
  return (
    <section id="hero" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <ShaderBackground />

      <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_16%,hsl(38_92%_50%/0.2),transparent_62%)]" />
        <div className="absolute left-1/2 top-[35%] h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_130deg,hsl(38_92%_50%/.14),hsl(16_75%_48%/.09),transparent_58%,hsl(38_92%_50%/.16))] blur-3xl animate-[hero-spin_18s_linear_infinite] motion-reduce:animate-none" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,hsl(0_0%_100%/.04)_1px,transparent_1px),linear-gradient(to_bottom,hsl(0_0%_100%/.04)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(circle_at_50%_36%,black_0%,transparent_76%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-6 pt-[clamp(4.5rem,9vh,6.2rem)] sm:px-7 sm:pb-8 sm:pt-[clamp(5rem,11vh,6.6rem)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <h1
            className="max-w-5xl text-balance text-center text-[clamp(2.05rem,11.2vw,2.95rem)] font-semibold leading-[0.94] tracking-[-0.04em] sm:text-[clamp(2.35rem,5.6vw,4.2rem)] lg:text-[clamp(3.1rem,6vw,5.1rem)] motion-reduce:!animate-none"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.1s both' }}
          >
            <span className="sm:whitespace-nowrap">Build, deploy, and scale</span>
            <br />
            <span className="relative bg-gradient-to-r from-[hsl(42_95%_64%)] via-brand to-[hsl(14_86%_58%)] bg-clip-text text-transparent [text-shadow:0_0_32px_hsl(38_92%_50%/0.2)]">
              AI agents that take action.
            </span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-lg motion-reduce:!animate-none"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.25s both' }}
          >
            Voice agents that handle calls, resolve tickets, and close deals. Any model. 22+ providers. Voice-first.
          </p>

          <div
            className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row sm:gap-3.5 motion-reduce:!animate-none"
            style={{ animation: 'fade-in-up 0.6s ease-out 0.35s both' }}
          >
            <a
              href="#try"
              className="group inline-flex items-center justify-center rounded-full border border-brand/50 bg-brand px-7 py-3 text-sm font-semibold text-background transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 shadow-[0_0_40px_hsl(38_92%_50%/0.28)]"
            >
              Try Live Demo
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <Link
              href="/overview"
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-7 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:bg-white/[0.08] hover:border-white/20"
            >
              Open Dashboard
            </Link>
            <a
              href="#developer"
              className="group inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-7 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:bg-white/[0.08] hover:border-white/20"
            >
              <Code2 className="mr-2 h-4 w-4 text-brand" />
              For Developers
            </a>
          </div>
        </div>

        <div
          className="relative mx-auto mt-6 w-full max-w-4xl sm:mt-7 motion-reduce:!animate-none"
          style={{ animation: 'fade-in-up 0.8s ease-out 0.55s both' }}
        >
          <div className="pointer-events-none absolute inset-x-10 -top-8 h-24 rounded-full bg-[radial-gradient(ellipse,hsl(38_92%_50%/0.3),transparent_68%)] blur-2xl" />
          <div className="relative rounded-[28px] border border-white/12 bg-[linear-gradient(155deg,hsl(0_0%_100%/.09),transparent_36%)] p-2.5 shadow-[0_34px_120px_hsl(0_0%_0%/0.55)] backdrop-blur-sm">
            <div className="rounded-2xl border border-white/[0.08] bg-background/60 p-1.5 sm:p-2">
              <DemoShowcase />
            </div>
          </div>

          <div className="pointer-events-none absolute -left-4 top-14 hidden rounded-full border border-white/15 bg-background/85 px-4 py-2 text-[11px] uppercase tracking-wide text-foreground/80 shadow-[0_16px_30px_hsl(0_0%_0%/0.45)] backdrop-blur-sm 2xl:block animate-[hero-float_9s_ease-in-out_infinite] motion-reduce:animate-none">
            Intent routing + policy checks
          </div>
          <div className="pointer-events-none absolute -right-4 bottom-12 hidden rounded-full border border-brand/25 bg-brand/[0.12] px-4 py-2 text-[11px] uppercase tracking-wide text-brand shadow-[0_12px_28px_hsl(38_92%_50%/0.25)] backdrop-blur-sm 2xl:block animate-[hero-float_10s_ease-in-out_1.2s_infinite] motion-reduce:animate-none">
            Voice latency tuned for live calls
          </div>
        </div>

        <div
          className="hero-partner-rail mt-5 flex w-full flex-col items-center gap-2 overflow-hidden motion-reduce:!animate-none"
          style={{ animation: 'fade-in-up 0.6s ease-out 0.7s both' }}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground/45">
            Integrated with
          </span>
          <div className="relative w-full max-w-3xl overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.02] py-2.5 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-[marquee_20s_linear_infinite] motion-reduce:animate-none items-center gap-10 px-4">
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

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
