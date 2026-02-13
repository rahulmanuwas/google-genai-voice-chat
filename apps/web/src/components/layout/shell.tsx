'use client';

import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/hooks/use-session';
import { Button } from '@/components/ui/button';

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { error, refreshSession } = useSession();

  return (
    <TooltipProvider>
      <div className="relative min-h-screen">
        {/* Ambient glow in top-right corner */}
        <div className="pointer-events-none fixed right-0 top-0 h-[500px] w-[500px] rounded-full bg-brand/[0.04] blur-[100px]" />

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
          {error && (
            <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive md:mx-6 lg:mx-8">
              <span className="truncate">Session issue: {error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshSession()}
                className="h-7 shrink-0 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/15"
              >
                Retry
              </Button>
            </div>
          )}
          <main
            className="p-4 md:p-6 lg:p-8"
            style={{ animation: 'fade-in-up 0.4s ease-out both' }}
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
