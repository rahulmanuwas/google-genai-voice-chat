'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type AgentMode = 'realtime' | 'pipeline';

interface AgentModePickerProps {
  value: AgentMode;
  onChange: (mode: AgentMode) => void;
}

const MODES = [
  { id: 'pipeline' as const, label: 'Pipeline', description: 'Deepgram STT + Gemini LLM & TTS' },
  { id: 'realtime' as const, label: 'Full Duplex', description: 'Gemini native audio' },
];

export function AgentModePicker({ value, onChange }: AgentModePickerProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        Mode
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as AgentMode)}>
        <SelectTrigger className="w-full sm:w-[280px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODES.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.label}
              <span className="ml-2 text-muted-foreground text-xs">{m.description}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
