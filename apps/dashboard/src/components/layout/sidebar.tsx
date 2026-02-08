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
  Bot,
  Palette,
  AudioLines,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type NavEntry =
  | { type: 'link'; href: string; label: string; icon: typeof LayoutDashboard }
  | { type: 'separator'; label: string };

const NAV_ITEMS: NavEntry[] = [
  { type: 'link', href: '/', label: 'Overview', icon: LayoutDashboard },
  { type: 'link', href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { type: 'link', href: '/handoffs', label: 'Handoffs', icon: ArrowRightLeft },
  { type: 'link', href: '/tools', label: 'Tools', icon: Wrench },
  { type: 'link', href: '/guardrails', label: 'Guardrails', icon: Shield },
  { type: 'link', href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { type: 'link', href: '/persona', label: 'Persona', icon: User },
  { type: 'link', href: '/experiments', label: 'Experiments', icon: FlaskConical },
  { type: 'link', href: '/settings', label: 'Settings', icon: Settings },
  { type: 'separator', label: 'Demos' },
  { type: 'link', href: '/demos/chatbot', label: 'Voice Chat', icon: Bot },
  { type: 'link', href: '/demos/custom', label: 'Custom UI', icon: Palette },
  { type: 'link', href: '/demos/livekit', label: 'LiveKit Agent', icon: AudioLines },
  { type: 'link', href: '/demos/twilio-call', label: 'PSTN Call', icon: Phone },
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

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          if (item.type === 'separator') {
            return (
              <div key={item.label} className="pt-4 pb-1">
                {!collapsed ? (
                  <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {item.label}
                  </span>
                ) : (
                  <div className="mx-3 border-t border-sidebar-border" />
                )}
              </div>
            );
          }

          const { href, label, icon: Icon } = item as Extract<NavEntry, { type: 'link' }>;
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
