import { Hero } from '@/components/landing/hero';
import { UseCases } from '@/components/landing/use-cases';
import { Features } from '@/components/landing/features';
import { HowItWorks } from '@/components/landing/how-it-works';
import { TechStack } from '@/components/landing/tech-stack';
import { CTAFooter } from '@/components/landing/cta-footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <UseCases />
      <Features />
      <HowItWorks />
      <TechStack />
      <CTAFooter />
    </div>
  );
}
