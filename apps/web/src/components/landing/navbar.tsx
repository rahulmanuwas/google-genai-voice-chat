'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Menu, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Demos', href: '#try' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '/docs' },
] as const;

const SECTION_IDS = ['try', 'use-cases', 'features', 'pricing'];

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  const observe = useCallback(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    return observe();
  }, [observe]);

  return active;
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const activeSection = useActiveSection(SECTION_IDS);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 transition-all duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_20px_hsl(0_0%_0%/0.3)]'
          : 'bg-transparent',
      )}
    >
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight hover:opacity-80 transition-opacity"
        >
          <span className="text-brand">.</span>Riyaan
        </Link>

        {/* Desktop links — pill container */}
        <div className="hidden md:flex items-center gap-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-1 py-0.5">
          {NAV_LINKS.map((link) => {
            const sectionId = link.href.startsWith('#') ? link.href.slice(1) : null;
            const isActive = sectionId !== null && activeSection === sectionId;

            return (
              <Button
                key={link.label}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  'relative rounded-full',
                  isActive && 'text-foreground',
                )}
              >
                {link.href.startsWith('#') ? (
                  <a href={link.href}>
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-1 inset-x-2 h-px bg-brand rounded-full" />
                    )}
                  </a>
                ) : (
                  <Link href={link.href}>{link.label}</Link>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          asChild
          className="hidden sm:inline-flex rounded-full bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20"
        >
          <Link href="/overview">
            Dashboard
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>

        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>
                <span className="text-brand">.</span>Riyaan
              </SheetTitle>
              <SheetDescription>AI Voice Agent Platform</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <SheetClose key={link.label} asChild>
                  <Button
                    variant="ghost"
                    asChild
                    className="justify-start text-muted-foreground hover:text-foreground"
                  >
                    {link.href.startsWith('#') ? (
                      <a href={link.href}>{link.label}</a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </Button>
                </SheetClose>
              ))}
            </div>
            <Separator className="mx-4 bg-white/[0.06]" />
            <div className="px-4">
              <SheetClose asChild>
                <Button asChild className="w-full">
                  <Link href="/overview">
                    Dashboard
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
