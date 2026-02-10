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
  FileText,
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
  { type: 'link', href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { type: 'link', href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { type: 'link', href: '/handoffs', label: 'Handoffs', icon: ArrowRightLeft },
  { type: 'link', href: '/tools', label: 'Tools', icon: Wrench },
  { type: 'link', href: '/guardrails', label: 'Guardrails', icon: Shield },
  { type: 'link', href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { type: 'link', href: '/persona', label: 'Persona', icon: User },
  { type: 'link', href: '/experiments', label: 'Experiments', icon: FlaskConical },
  { type: 'link', href: '/settings', label: 'Settings', icon: Settings },
  { type: 'link', href: '/docs', label: 'API Docs', icon: FileText },
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
      {/* Brand accent line at top */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

      <div className={cn('flex h-14 items-center border-b border-sidebar-border px-4', collapsed ? 'md:justify-center' : 'justify-between')}>
        {(!collapsed || mobileOpen) && (
          <span className={cn('text-base font-semibold tracking-tight text-sidebar-foreground', collapsed && 'md:hidden')}>
            <span className="text-brand">.</span>Riyaan
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="hidden h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent md:inline-flex"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          if (item.type === 'separator') {
            return (
              <div key={item.label} className="pt-5 pb-1.5">
                {(!collapsed || mobileOpen) ? (
                  <span className={cn('px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30', collapsed && 'md:hidden')}>
                    {item.label}
                  </span>
                ) : (
                  <div className="mx-3 border-t border-sidebar-border hidden md:block" />
                )}
                {/* Always show label on mobile */}
                {collapsed && (
                  <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 md:hidden">
                    {item.label}
                  </span>
                )}
              </div>
            );
          }

          const { href, label, icon: Icon } = item as Extract<NavEntry, { type: 'link' }>;
          const active = pathname === href || pathname.startsWith(href + '/');
          const link = (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/[0.04]',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full bg-brand" />
              )}
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70')} />
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

      {/* Bottom brand glow */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-brand/[0.03] to-transparent" />
    </aside>
  );
}
