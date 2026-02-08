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
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        // Mobile: slide-in drawer, always w-64
        'z-50 w-64 -translate-x-full md:translate-x-0',
        mobileOpen && 'translate-x-0',
        // Desktop: respect collapsed state
        'md:z-30',
        collapsed && 'md:w-16',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-sidebar-border px-4', collapsed ? 'md:justify-center' : 'justify-between')}>
        {(!collapsed || mobileOpen) && (
          <span className={cn('text-sm font-semibold text-sidebar-foreground', collapsed && 'md:hidden')}>
            GenAI Voice
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="hidden h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent md:inline-flex"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          if (item.type === 'separator') {
            return (
              <div key={item.label} className="pt-4 pb-1">
                {(!collapsed || mobileOpen) ? (
                  <span className={cn('px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40', collapsed && 'md:hidden')}>
                    {item.label}
                  </span>
                ) : (
                  <div className="mx-3 border-t border-sidebar-border hidden md:block" />
                )}
                {/* Always show label on mobile */}
                {collapsed && (
                  <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 md:hidden">
                    {item.label}
                  </span>
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
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {/* Always show label on mobile, respect collapsed on desktop */}
              <span className={cn(collapsed && 'md:hidden')}>{label}</span>
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="hidden md:block">{label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>
    </aside>
  );
}
