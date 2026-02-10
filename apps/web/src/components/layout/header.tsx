'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMobileToggle: () => void;
}

export function Header({ onMobileToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-md md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMobileToggle}
        className="mr-3 h-8 w-8 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Link href="/" className="text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity">
        <span className="text-brand">.</span>Riyaan
      </Link>
    </header>
  );
}
