'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FadeIn } from '@/components/ui/fade-in';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const FOOTER_LINKS = {
  Product: [
    { label: 'Live Demo', href: '#try' },
    { label: 'Features', href: '#features' },
    { label: 'Use Cases', href: '#use-cases' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'How It Works', href: '#how-it-works' },
  ],
  Platform: [
    { label: 'Dashboard', href: '/overview' },
    { label: 'Knowledge Base', href: '/knowledge' },
    { label: 'Guardrails', href: '/guardrails' },
    { label: 'Tools', href: '/tools' },
    { label: 'Experiments', href: '/experiments' },
  ],
  Developers: [
    { label: 'Documentation', href: '/docs' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Code Examples', href: '#code' },
    { label: 'LiveKit Agent', href: '/demos/livekit' },
    { label: 'PSTN Calls', href: '/demos/twilio-call' },
  ],
} as const;

const TECH_NAMES = ['Gemini', 'LiveKit', 'Convex', 'Next.js'];

export function CTAFooter() {
  return (
    <footer className="relative border-t border-border overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none"
        aria-hidden="true"
      >
        <source src="/footer_video.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 25%, transparent 75%, hsl(var(--background)) 100%)',
        }}
      />

      {/* Ambient glow behind CTA */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, hsl(38 92% 50% / 0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* CTA section */}
        <div className="py-10 sm:py-12 text-center">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-6">
              Ship your first AI voice agent today.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              React SDK, guardrails, tools — configure and go live. No AI team required.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                asChild
                className="rounded-full bg-brand px-10 text-background hover:brightness-110 shadow-[0_0_24px_hsl(38_92%_50%/0.25),0_0_60px_hsl(38_92%_50%/0.1)]"
              >
                <Link href="/overview" className="group">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="rounded-full border-white/10 bg-white/[0.04] backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/15 px-10"
              >
                <a href="#try">Try Live Demo</a>
              </Button>
            </div>
          </FadeIn>
        </div>

        {/* Divider between CTA and footer links */}
        <Separator className="bg-white/[0.06]" />

        {/* Footer links */}
        <div className="pt-12 pb-8">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-1 lg:col-span-2 mb-4 sm:mb-0">
              <Badge
                variant="outline"
                className="mb-3 text-[10px] border-brand/20 text-brand/70"
              >
                Open Source
              </Badge>
              <Link href="/" className="block text-lg font-semibold tracking-tight mb-3">
                <span className="text-brand">.</span>Riyaan
              </Link>
              <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">
                Enterprise-grade AI voice agents. Built with Gemini, LiveKit &amp; Convex.
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
                  {heading}
                </h3>
                <ul className="space-y-1">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Button
                        variant="ghost"
                        asChild
                        className="h-auto justify-start px-0 py-1 text-sm text-muted-foreground/60 hover:text-foreground/90 hover:bg-transparent font-normal"
                      >
                        <Link href={link.href}>{link.label}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Copyright */}
          <Separator className="mt-12 bg-white/[0.06]" />
          <div className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground/50">
              <p>&copy; {new Date().getFullYear()} Riyaan. All rights reserved.</p>
              <div className="flex items-center">
                <span>Powered by</span>
                {TECH_NAMES.map((name) => (
                  <span key={name} className="inline-flex items-center">
                    <Separator
                      orientation="vertical"
                      className="mx-2 h-3 bg-white/[0.12]"
                    />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
