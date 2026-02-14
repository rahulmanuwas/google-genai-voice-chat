'use client';

import type { LucideIcon } from 'lucide-react';

interface HeroKPICardProps {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
}

export function HeroKPICard({ title, value, sub, icon: Icon }: HeroKPICardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-colors duration-200 hover:border-brand/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/25 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/[0.08]">
          <Icon className="h-5 w-5 text-brand/70" />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
