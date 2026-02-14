'use client';

import { useState, useEffect } from 'react';
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
  Send,
  ScanSearch,
  NotebookPen,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard };

type NavEntry =
  | { type: 'group'; label: string; items: NavLink[]; defaultOpen?: boolean }
  | { type: 'link'; href: string; label: string; icon: typeof LayoutDashboard };

const NAV_GROUPS: NavEntry[] = [
  {
    type: 'group',
    label: 'Monitor',
    defaultOpen: true,
    items: [
      { href: '/overview', label: 'Overview', icon: LayoutDashboard },
      { href: '/conversations', label: 'Conversations', icon: MessageSquare },
      { href: '/handoffs', label: 'Handoffs', icon: ArrowRightLeft },
      { href: '/traces', label: 'Traces', icon: ScanSearch },
    ],
  },
  {
    type: 'group',
    label: 'Configure',
    items: [
      { href: '/tools', label: 'Tools', icon: Wrench },
      { href: '/guardrails', label: 'Guardrails', icon: Shield },
      { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
      { href: '/persona', label: 'Persona', icon: User },
      { href: '/experiments', label: 'A/B Tests', icon: FlaskConical },
    ],
  },
  {
    type: 'group',
    label: 'Quality',
    items: [
      { href: '/qa', label: 'QA', icon: MessageSquare },
      { href: '/annotations', label: 'Annotations', icon: NotebookPen },
      { href: '/outbound', label: 'Outbound', icon: Send },
    ],
  },
  {
    type: 'group',
    label: 'Demos',
    items: [
      { href: '/demos/chatbot', label: 'Voice Chat', icon: Bot },
      { href: '/demos/custom', label: 'Embedded Widget', icon: Palette },
      { href: '/demos/livekit', label: 'Voice Agent', icon: AudioLines },
      { href: '/demos/twilio-call', label: 'Phone Call', icon: Phone },
    ],
  },
];

const UTILITY_LINKS: NavLink[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/docs', label: 'API Docs', icon: FileText },
];

/** Find which group contains the active path */
function findActiveGroup(pathname: string): string | null {
  for (const entry of NAV_GROUPS) {
    if (entry.type === 'group') {
      for (const item of entry.items) {
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          return entry.label;
        }
      }
    }
  }
  return null;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const [groupStates, setGroupStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    for (const entry of NAV_GROUPS) {
      if (entry.type === 'group') {
        states[entry.label] = entry.defaultOpen ?? false;
      }
    }
    return states;
  });

  // Auto-open group containing active page on mount
  useEffect(() => {
    const activeGroup = findActiveGroup(pathname);
    if (activeGroup) {
      setGroupStates((prev) => ({ ...prev, [activeGroup]: true }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (label: string) => {
    setGroupStates((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isExpanded = !collapsed || mobileOpen;

  const renderLink = (item: NavLink) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    const link = (
      <Link
        key={item.href}
        href={item.href}
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
        <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70')} />
        <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="hidden md:block">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        'z-50 w-64 -translate-x-full md:translate-x-0',
        mobileOpen && 'translate-x-0',
        'md:z-30',
        collapsed && 'md:w-16',
      )}
    >
      {/* Brand accent line at top */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

      <div className={cn('flex h-14 items-center border-b border-sidebar-border px-4', collapsed ? 'md:justify-center' : 'justify-between')}>
        {(!collapsed || mobileOpen) && (
          <Link href="/" className={cn('text-base font-semibold tracking-tight text-sidebar-foreground hover:opacity-80 transition-opacity', collapsed && 'md:hidden')}>
            <span className="text-brand">.</span>Riyaan
          </Link>
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
        {NAV_GROUPS.map((entry) => {
          if (entry.type !== 'group') return null;
          const isOpen = groupStates[entry.label];

          return (
            <div key={entry.label}>
              {/* Group header */}
              {isExpanded ? (
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 pt-4 pb-1.5',
                    collapsed && 'md:hidden',
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                    {entry.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 text-sidebar-foreground/25 transition-transform duration-200',
                      !isOpen && '-rotate-90',
                    )}
                  />
                </button>
              ) : (
                <div className="mx-3 mt-3 mb-1.5 border-t border-sidebar-border hidden md:block" />
              )}

              {/* Group items */}
              {(isOpen || !isExpanded) && (
                <div className={cn(!isExpanded && 'space-y-0.5')}>
                  {entry.items.map(renderLink)}
                </div>
              )}
            </div>
          );
        })}

        {/* Utility links */}
        <div className="pt-4">
          {isExpanded ? (
            <div className={cn('mx-3 mb-1.5 border-t border-sidebar-border', collapsed && 'md:hidden')} />
          ) : (
            <div className="mx-3 mb-1.5 border-t border-sidebar-border hidden md:block" />
          )}
          {UTILITY_LINKS.map(renderLink)}
        </div>
      </nav>

      {/* User info */}
      {user && (
        <div className={cn('border-t border-sidebar-border p-3', collapsed && 'md:px-2')}>
          <div className={cn('flex items-center gap-3', collapsed && 'md:justify-center')}>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-medium text-brand">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            {isExpanded && (
              <>
                <div className={cn('min-w-0 flex-1', collapsed && 'md:hidden')}>
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {user.displayName || 'User'}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/50">
                    {user.email}
                  </p>
                </div>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={signOut}
                      className={cn('h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground', collapsed && 'md:hidden')}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
