'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCENARIOS } from '@/lib/scenarios';

interface ScenarioPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function ScenarioPicker({ value, onChange }: ScenarioPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        Scenario
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[280px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCENARIOS.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="mr-2">{s.icon}</span>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
