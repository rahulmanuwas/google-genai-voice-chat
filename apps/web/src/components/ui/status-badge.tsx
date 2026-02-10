import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, ACTION_COLORS, PRIORITY_COLORS } from '@/lib/status-colors';

const COLOR_MAPS = {
  status: STATUS_COLORS,
  action: ACTION_COLORS,
  priority: PRIORITY_COLORS,
} as const;

interface StatusBadgeProps {
  value: string;
  type?: keyof typeof COLOR_MAPS;
  className?: string;
}

export function StatusBadge({ value, type = 'status', className }: StatusBadgeProps) {
  const map = COLOR_MAPS[type];
  return (
    <Badge variant="outline" className={cn('text-xs', map[value] ?? '', className)}>
      {value.replace(/_/g, ' ')}
    </Badge>
  );
}
