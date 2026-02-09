import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRIORITY_COLORS } from '@/lib/status-colors';

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.normal)}>
      {priority}
    </Badge>
  );
}
