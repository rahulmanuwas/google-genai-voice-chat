export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/25',
  resolved: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  handed_off: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  abandoned: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  claimed: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  success: 'bg-green-500/15 text-green-400 border-green-500/25',
  error: 'bg-red-500/15 text-red-400 border-red-500/25',
};

export const ACTION_COLORS: Record<string, string> = {
  block: 'bg-red-500/15 text-red-400 border-red-500/25',
  warn: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  log: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
};

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  normal: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
};
