import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs', PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.normal)}>
      {priority}
    </Badge>
  );
}
