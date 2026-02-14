'use client';

import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppFilter } from '@/lib/context/app-filter-context';

export function AppSelector() {
  const { selectedApp, setSelectedApp, availableApps } = useAppFilter();

  if (availableApps.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      <Select
        value={selectedApp ?? 'all'}
        onValueChange={(v) => setSelectedApp(v === 'all' ? null : v)}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="All apps" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All apps</SelectItem>
          {availableApps.map((app) => (
            <SelectItem key={app} value={app}>
              {app}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
