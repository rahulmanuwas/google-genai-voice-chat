'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  ArrowRightLeft,
  Wrench,
  Shield,
  BookOpen,
  User,
  FlaskConical,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/handoffs', label: 'Handoffs', icon: ArrowRightLeft },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/guardrails', label: 'Guardrails', icon: Shield },
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { href: '/persona', label: 'Persona', icon: User },
  { href: '/experiments', label: 'Experiments', icon: FlaskConical },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-sidebar-border px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground">
            GenAI Voice
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const link = (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>
    </aside>
  );
}
