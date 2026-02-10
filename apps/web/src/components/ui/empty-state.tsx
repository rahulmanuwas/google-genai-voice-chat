import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="relative mb-5">
        {/* Ambient glow behind icon */}
        <div className="absolute inset-0 rounded-2xl bg-brand/10 blur-xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/[0.06] ring-1 ring-brand/10">
          <Icon className="h-6 w-6 text-brand/60" />
        </div>
      </div>
      <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      {action}
    </div>
  );
}
