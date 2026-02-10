export interface DemoMemory {
  userName: string | null;
  facts: string[];
  conversationSummary: string | null;
  updatedAt: number; // epoch ms
}

function storageKey(appSlug: string) {
  return `genai-voice:demo-memory:${appSlug}`;
}

export function loadDemoMemory(appSlug: string): DemoMemory | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(appSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoMemory> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      userName: typeof parsed.userName === 'string' ? parsed.userName : null,
      facts: Array.isArray(parsed.facts) ? parsed.facts.filter((f): f is string => typeof f === 'string') : [],
      conversationSummary: typeof parsed.conversationSummary === 'string' ? parsed.conversationSummary : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveDemoMemory(appSlug: string, memory: DemoMemory) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(appSlug), JSON.stringify(memory));
  } catch {
    // ignore
  }
}

export function clearDemoMemory(appSlug: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(appSlug));
  } catch {
    // ignore
  }
}

export function buildMemoryPrompt(memory: DemoMemory | null): string {
  if (!memory) return '';
  const facts = [...(memory.facts ?? [])].filter(Boolean).slice(0, 5);
  const hasAnything = Boolean(memory.userName) || facts.length > 0 || Boolean(memory.conversationSummary);
  if (!hasAnything) return '';

  const lines: string[] = [];
  if (memory.userName) lines.push(`- Name: ${memory.userName}`);
  for (const f of facts) lines.push(`- ${f}`);
  if (memory.conversationSummary) lines.push(`- Last conversation: ${memory.conversationSummary}`);

  return [
    '',
    '# Memory (from prior conversations)',
    'These are facts learned previously about the user. Use them naturally when helpful, and allow the user to correct them.',
    lines.join('\n'),
    '',
  ].join('\n');
}

