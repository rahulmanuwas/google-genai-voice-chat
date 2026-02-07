'use client';

import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <div className={cn('transition-all duration-200', collapsed ? 'ml-16' : 'ml-64')}>
          <Header />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
