import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { LiveDemo } from '@/components/landing/live-demo';
import { UseCases } from '@/components/landing/use-cases';
import { Features } from '@/components/landing/features';
import { CodeShowcase } from '@/components/landing/code-showcase';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { TechStack } from '@/components/landing/tech-stack';
import { CTAFooter } from '@/components/landing/cta-footer';
import { ScrollSpy } from '@/components/landing/scroll-spy';
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <ScrollSpy />
      <Hero />
      <LiveDemo />
      <UseCases />
      <Features />
      <CodeShowcase />
      <HowItWorks />
      <Pricing />
      <TechStack />
      <CTAFooter />
    </div>
  );
}
