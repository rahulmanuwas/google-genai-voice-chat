import { Suspense } from 'react';
import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { LiveDemo } from '@/components/landing/live-demo';
import { UseCases } from '@/components/landing/use-cases';
import { DeveloperExperience } from '@/components/landing/developer-experience';
import { Pricing } from '@/components/landing/pricing';
import { CTAFooter } from '@/components/landing/cta-footer';
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <Suspense fallback={null}>
        <LiveDemo />
      </Suspense>
      <UseCases />
      <DeveloperExperience />
      <Pricing />
      <CTAFooter />
    </div>
  );
}
