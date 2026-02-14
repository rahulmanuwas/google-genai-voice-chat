'use client';

import Link from 'next/link';
import { ArrowRightLeft, NotebookPen, HelpCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface AttentionItem {
  icon: LucideIcon;
  label: string;
  count: number;
  href: string;
  color: string;
}

interface NeedsAttentionProps {
  pendingHandoffs: number;
  unannotatedConversations: number;
  unresolvedGaps: number;
}

export function NeedsAttention({ pendingHandoffs, unannotatedConversations, unresolvedGaps }: NeedsAttentionProps) {
  const items: AttentionItem[] = [
    {
      icon: ArrowRightLeft,
      label: 'Pending handoffs',
      count: pendingHandoffs,
      href: '/handoffs',
      color: 'text-amber-500',
    },
    {
      icon: NotebookPen,
      label: 'Unannotated conversations',
      count: unannotatedConversations,
      href: '/conversations',
      color: 'text-blue-400',
    },
    {
      icon: HelpCircle,
      label: 'Unresolved knowledge gaps',
      count: unresolvedGaps,
      href: '/knowledge',
      color: 'text-red-400',
    },
  ];

  const actionableItems = items.filter((item) => item.count > 0);

  if (actionableItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {actionableItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 group transition-colors hover:bg-brand/[0.02] -mx-3 px-3 rounded-md"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/[0.06]">
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
