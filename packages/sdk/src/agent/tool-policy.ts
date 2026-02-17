import type {
  ToolPolicyConfig,
  ToolPolicyDecision,
  ToolPolicyLayer,
  ToolPolicyRule,
} from './pi-types';

const DEFAULT_TOOL_GROUPS: Record<string, string[]> = {
  filesystem: [
    'list_files',
    'read_file',
    'write_file',
    'search_files',
    'replace_in_file',
    'create_file',
    'delete_file',
  ],
  shell: ['run_terminal_command'],
  network: ['http_request', 'fetch_url'],
  vcs: ['git_status', 'git_diff', 'git_commit', 'git_push'],
};

interface ToolState {
  allowed: boolean;
  reason?: string;
}

const TOOL_NAME_SEGMENT = /[^a-zA-Z0-9_:-]+/g;

function normalizeToolName(value: string): string {
  return value.trim().replace(TOOL_NAME_SEGMENT, '');
}

function expandNames(
  names: string[] | undefined,
  groups: Record<string, string[]>,
): Set<string> {
  const result = new Set<string>();
  for (const raw of names ?? []) {
    const name = normalizeToolName(raw);
    if (!name) continue;
    const group = groups[name];
    if (group) {
      for (const groupedTool of group) {
        const normalized = normalizeToolName(groupedTool);
        if (normalized) result.add(normalized);
      }
      continue;
    }
    result.add(name);
  }
  return result;
}

function matchesRule(
  toolName: string,
  rule: ToolPolicyRule,
  groups: Record<string, string[]>,
): boolean {
  const names = expandNames(rule.tools, groups);
  if (names.size > 0 && names.has(toolName)) return true;

  const groupNames = expandNames(rule.groups, groups);
  if (groupNames.size > 0 && groupNames.has(toolName)) return true;

  if (rule.pattern) {
    try {
      return new RegExp(rule.pattern).test(toolName);
    } catch {
      return false;
    }
  }
  return false;
}

function applyLayer(
  toolStates: Map<string, ToolState>,
  layerName: string,
  layer: ToolPolicyLayer | undefined,
  groups: Record<string, string[]>,
) {
  if (!layer) return;

  const allowed = expandNames(layer.allow, groups);
  const denied = expandNames(layer.deny, groups);

  if (allowed.size > 0) {
    for (const [name, state] of toolStates.entries()) {
      const isAllowed = allowed.has(name);
      state.allowed = isAllowed;
      if (!isAllowed) {
        state.reason = `${layerName}:not_allowed`;
      } else if (state.reason?.startsWith(layerName)) {
        state.reason = undefined;
      }
    }
  }

  if (denied.size > 0) {
    for (const name of denied) {
      const state = toolStates.get(name);
      if (!state) continue;
      state.allowed = false;
      state.reason = `${layerName}:deny_list`;
    }
  }

  for (const rule of layer.rules ?? []) {
    const effect = rule.effect === 'allow' ? 'allow' : 'deny';
    for (const [name, state] of toolStates.entries()) {
      if (!matchesRule(name, rule, groups)) continue;
      if (effect === 'allow') {
        state.allowed = true;
        if (state.reason?.startsWith(layerName)) {
          state.reason = undefined;
        }
      } else {
        state.allowed = false;
        state.reason = `${layerName}:rule_deny`;
      }
    }
  }
}

/**
 * Evaluate a layered tool policy for a provider/model context.
 * Later layers can override earlier layers.
 */
export function evaluateToolPolicy(
  toolNames: string[],
  provider: string,
  model: string,
  policy?: ToolPolicyConfig,
): ToolPolicyDecision {
  const normalizedToolNames = toolNames
    .map(normalizeToolName)
    .filter((name) => name.length > 0);
  const toolStates = new Map<string, ToolState>(
    normalizedToolNames.map((name) => [name, { allowed: true }]),
  );

  if (!policy) {
    return {
      allowedToolNames: normalizedToolNames,
      blockedTools: [],
    };
  }

  const groups: Record<string, string[]> = {
    ...DEFAULT_TOOL_GROUPS,
    ...(policy.groups ?? {}),
  };

  applyLayer(toolStates, 'global', policy.global, groups);
  applyLayer(toolStates, `provider:${provider}`, policy.providers?.[provider], groups);
  applyLayer(toolStates, `model:${model}`, policy.models?.[model], groups);
  applyLayer(toolStates, 'session', policy.session, groups);

  const allowedToolNames: string[] = [];
  const blockedTools: ToolPolicyDecision['blockedTools'] = [];

  for (const [name, state] of toolStates.entries()) {
    if (state.allowed) {
      allowedToolNames.push(name);
    } else {
      blockedTools.push({ name, reason: state.reason ?? 'policy_blocked' });
    }
  }

  return { allowedToolNames, blockedTools };
}

/** Filter arbitrary tool objects that expose a `name` property. */
export function filterNamedTools<T extends { name?: string }>(
  tools: T[],
  allowedToolNames: string[],
): T[] {
  const allowed = new Set(allowedToolNames.map(normalizeToolName));
  return tools.filter((tool) => {
    const name = normalizeToolName(tool.name ?? '');
    return name.length > 0 && allowed.has(name);
  });
}
