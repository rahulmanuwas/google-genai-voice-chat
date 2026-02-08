'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/conversations': 'Conversations',
  '/handoffs': 'Handoffs',
  '/tools': 'Tools',
  '/guardrails': 'Guardrails',
  '/knowledge': 'Knowledge',
  '/persona': 'Persona',
  '/experiments': 'Experiments',
  '/settings': 'Settings',
  '/demos/chatbot': 'Demo: Voice Chat Widget',
  '/demos/custom': 'Demo: Custom UI',
  '/demos/livekit': 'Demo: LiveKit Agent',
  '/demos/twilio-call': 'Demo: PSTN Call',
};

interface HeaderProps {
  onMobileToggle: () => void;
}

export function Header({ onMobileToggle }: HeaderProps) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMobileToggle}
        className="mr-2 h-8 w-8 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
