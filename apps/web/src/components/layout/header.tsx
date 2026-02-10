'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMobileToggle: () => void;
}

export function Header({ onMobileToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMobileToggle}
        className="mr-2 h-8 w-8 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </header>
  );
}
