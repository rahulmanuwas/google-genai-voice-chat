'use client';

import type { LucideIcon } from 'lucide-react';

interface CompactStatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
}

export function CompactStatCard({ title, value, sub, icon: Icon }: CompactStatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-brand/20">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/[0.06]">
        <Icon className="h-3.5 w-3.5 text-brand/70" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">{value}</span>
          <span className="text-xs text-muted-foreground truncate">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
