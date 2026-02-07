'use client';

import { usePathname } from 'next/navigation';

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
};

export function Header() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
