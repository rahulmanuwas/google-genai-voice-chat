'use client';

import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="relative min-h-screen">
        {/* Subtle ambient glow in top-right corner */}
        <div className="pointer-events-none fixed right-0 top-0 h-[500px] w-[500px] rounded-full bg-brand/[0.02] blur-[100px]" />

        {/* Backdrop overlay for mobile drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        <div className={cn(
          'transition-all duration-200',
          'ml-0 md:ml-64',
          collapsed && 'md:ml-16',
        )}>
          <Header onMobileToggle={() => setMobileOpen(o => !o)} />
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
