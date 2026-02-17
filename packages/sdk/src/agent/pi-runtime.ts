/**
 * Pi runtime adapter.
 *
 * Wraps the Pi coding agent (`@mariozechner/pi-coding-agent`) with access
 * to 22+ providers. Uses the real Pi SDK: createAgentSession → session.prompt
 * → subscribe for events.
 */

import type {
  AgentConfig,
  AgentHandle,
  AgentState,
  AgentEventType,
  ProviderInfo,
  ModelInfo,
  AuthProfileConfig,
  ModelFallbackCandidate,
  AgentRunMetadata,
  AgentPluginServiceCleanup,
} from './pi-types';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertTools } from './tools-bridge';
import { createCallbacksBridge } from './pi-callbacks';
import { getDefaultModel } from './providers';
import { evaluateToolPolicy } from './tool-policy';
import { listRegisteredTools, listRegisteredServices } from './plugins';

type Listener = (...args: unknown[]) => void;

const DEFAULT_CONTEXT_OVERFLOW_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 400;
const DEFAULT_TOOL_RESULT_MAX_CHARS = 2_500;
const DEFAULT_HISTORY_SUMMARY_MAX_CHARS = 12_000;
const DEFAULT_AUTH_COOLDOWN_MS = 120_000;
const DEFAULT_AUTH_FAILURE_THRESHOLD = 1;
const MAX_HISTORY_TURNS = 40;
const MAX_TOOL_NOTES = 24;
const TOOL_NAME_SEGMENT = /[^a-zA-Z0-9_:-]+/g;

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface ToolNote {
  name: string;
  output: string;
  ts: number;
}

interface AuthProfileState {
  failures: number;
  cooldownUntil: number;
}

interface AttemptPlan {
  candidate: ModelFallbackCandidate;
  profile: AuthProfileConfig;
  bypassCooldown?: boolean;
}

interface ErrorClassification {
  kind: 'context_overflow' | 'auth' | 'rate_limit' | 'transient' | 'fatal';
  reason: string;
}

interface MutableRunMetrics {
  toolOutputTruncatedChars: number;
}

interface StartedPluginService {
  name: string;
  serviceStop?: (context: {
    sessionId: string;
    cwd: string;
    runtime: 'pi';
    getProvider: () => string;
    getModel: () => string;
    emitEvent?: (eventType: string, data?: Record<string, unknown>) => Promise<void>;
  }) => Promise<void> | void;
  cleanup?: AgentPluginServiceCleanup;
}

function normalizeToolName(value: string): string {
  return value.trim().replace(TOOL_NAME_SEGMENT, '');
}

function safeSerialize(value: unknown): string {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateText(text: string, maxChars: number): { value: string; truncatedChars: number } {
  if (text.length <= maxChars) {
    return { value: text, truncatedChars: 0 };
  }
  const extra = text.length - maxChars;
  return {
    value: `${text.slice(0, Math.max(0, maxChars))}\n...[truncated ${extra} chars]`,
    truncatedChars: extra,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyError(err: unknown): ErrorClassification {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('context') && (
      normalized.includes('length')
      || normalized.includes('window')
      || normalized.includes('token')
      || normalized.includes('too long')
      || normalized.includes('overflow')
    )
  ) {
    return { kind: 'context_overflow', reason: 'context_overflow' };
  }

  if (
    normalized.includes('unauthorized')
    || normalized.includes('forbidden')
    || normalized.includes('api key')
    || normalized.includes('authentication')
    || normalized.includes('invalid api key')
    || normalized.includes('permission denied')
  ) {
    return { kind: 'auth', reason: 'auth_failure' };
  }

  if (
    normalized.includes('rate limit')
    || normalized.includes('quota')
    || normalized.includes('429')
    || normalized.includes('billing')
  ) {
    return { kind: 'rate_limit', reason: 'rate_limit' };
  }

  if (
    normalized.includes('timeout')
    || normalized.includes('temporar')
    || normalized.includes('network')
    || normalized.includes('econnreset')
    || normalized.includes('socket hang up')
  ) {
    return { kind: 'transient', reason: 'transient_error' };
  }

  return { kind: 'fatal', reason: 'runtime_error' };
}

function normalizeAuthProfiles(
  configuredProfiles: AuthProfileConfig[] | undefined,
): AuthProfileConfig[] {
  if (!configuredProfiles || configuredProfiles.length === 0) {
    return [{ id: 'default', priority: 0 }];
  }

  const deduped = new Map<string, AuthProfileConfig>();
  for (const profile of configuredProfiles) {
    if (!profile?.id?.trim()) continue;
    deduped.set(profile.id, {
      ...profile,
      id: profile.id.trim(),
      priority: profile.priority ?? 100,
    });
  }

  if (deduped.size === 0) {
    return [{ id: 'default', priority: 0 }];
  }

  return Array.from(deduped.values()).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

function buildModelCandidates(config: AgentConfig, provider: string, model: string): ModelFallbackCandidate[] {
  const candidates: ModelFallbackCandidate[] = [
    { provider, model },
    ...(config.piOptions?.fallbackCandidates ?? []),
  ];

  const defaultModel = getDefaultModel();
  if (!candidates.some((candidate) => candidate.provider === defaultModel.provider && candidate.model === defaultModel.model)) {
    candidates.push(defaultModel);
  }

  const seen = new Set<string>();
  const deduped: ModelFallbackCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.provider || !candidate.model) continue;
    const key = `${candidate.provider}::${candidate.model}::${candidate.authProfileId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function extractAssistantResponse(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== 'assistant') continue;
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((c: any) => c?.type === 'text')
        .map((c: any) => String(c?.text ?? ''))
        .join('');
    }
  }
  return '';
}

function formatHistorySummary(
  history: ConversationTurn[],
  toolNotes: ToolNote[],
  maxChars: number,
): string {
  if (history.length === 0 && toolNotes.length === 0) return '';

  const historyLines = history.slice(-24).map(
    (turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content.replace(/\s+/g, ' ').trim()}`,
  );
  const toolLines = toolNotes.slice(-10).map(
    (note) => `Tool ${note.name}: ${note.output.replace(/\s+/g, ' ').trim()}`,
  );

  const blocks: string[] = [];
  if (historyLines.length > 0) {
    blocks.push('Conversation so far:\n' + historyLines.join('\n'));
  }
  if (toolLines.length > 0) {
    blocks.push('Recent tool outputs:\n' + toolLines.join('\n'));
  }

  const joined = blocks.join('\n\n');
  if (joined.length <= maxChars) return joined;

  const headLen = Math.floor(maxChars * 0.58);
  const tailLen = Math.max(0, maxChars - headLen - 64);
  const omitted = joined.length - headLen - tailLen;
  return `${joined.slice(0, headLen)}\n...[context compacted, omitted ${omitted} chars]...\n${joined.slice(joined.length - tailLen)}`;
}

function composePromptWithSummary(summary: string, userText: string): string {
  return [
    'Use the compact context below for continuity.',
    'Do not repeat it verbatim unless the user asks.',
    '',
    summary,
    '',
    'Latest user message:',
    userText,
  ].join('\n');
}

function compactConversationHistory(history: ConversationTurn[]) {
  if (history.length <= 10) return;

  const head = history.slice(0, 1);
  const tail = history.slice(-7);
  const middle = history.slice(1, -7);
  const compressed = middle
    .map((turn) => `${turn.role}: ${turn.content.replace(/\s+/g, ' ').trim()}`)
    .join(' | ');
  const compacted = truncateText(compressed, 2_000).value;

  history.splice(
    0,
    history.length,
    ...head,
    {
      role: 'assistant',
      content: `[Compacted prior context] ${compacted}`,
      ts: Date.now(),
    },
    ...tail,
  );
}

function isLikelyToolPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const type = String(record.type ?? '').toLowerCase();
  if (type.includes('tool')) return true;
  if ('toolName' in record || 'toolCallId' in record) return true;
  if ('output' in record || 'result' in record) return true;
  return false;
}

function truncateLongStringsInObject(value: unknown, maxChars: number): { next: unknown; truncatedChars: number } {
  if (typeof value === 'string') {
    const truncated = truncateText(value, maxChars);
    return { next: truncated.value, truncatedChars: truncated.truncatedChars };
  }

  if (Array.isArray(value)) {
    let total = 0;
    const next = value.map((item) => {
      const result = truncateLongStringsInObject(item, maxChars);
      total += result.truncatedChars;
      return result.next;
    });
    return { next, truncatedChars: total };
  }

  if (value && typeof value === 'object') {
    let total = 0;
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const result = truncateLongStringsInObject(nested, maxChars);
      next[key] = result.next;
      total += result.truncatedChars;
    }
    return { next, truncatedChars: total };
  }

  return { next: value, truncatedChars: 0 };
}

function truncateToolPayloadsInSession(session: any, maxChars: number): number {
  const messages = session?.state?.messages;
  if (!Array.isArray(messages)) return 0;

  let totalTruncated = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!isLikelyToolPayload(msg)) continue;
    const result = truncateLongStringsInObject(msg, maxChars);
    messages[i] = result.next;
    totalTruncated += result.truncatedChars;
  }
  return totalTruncated;
}

function getToolName(tool: any): string {
  return normalizeToolName(String(tool?.name ?? tool?.label ?? ''));
}

/** Dynamically import pi-ai and register providers. */
async function loadPiAi() {
  const piAi = await import('@mariozechner/pi-ai');
  piAi.registerBuiltInApiProviders();
  return piAi;
}

let _piAvailable: boolean | null = null;

function getCurrentModuleDir(): string {
  if (typeof __dirname === 'string') {
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
}

export class PiRuntimeAdapter {
  isAvailable(): boolean {
    if (_piAvailable !== null) return _piAvailable;
    try {
      const moduleDir = getCurrentModuleDir();
      const candidates = [
        path.join(process.cwd(), 'node_modules', '@mariozechner', 'pi-coding-agent', 'package.json'),
        path.join(moduleDir, '..', '..', 'node_modules', '@mariozechner', 'pi-coding-agent', 'package.json'),
        path.join(moduleDir, '..', '..', '..', '..', 'node_modules', '@mariozechner', 'pi-coding-agent', 'package.json'),
      ];

      _piAvailable = candidates.some((candidate) => {
        try {
          return fs.existsSync(candidate);
        } catch {
          return false;
        }
      });
      return _piAvailable;
    } catch {
      _piAvailable = false;
      return false;
    }
  }

  /** Dynamically discover all providers and models from the Pi SDK. */
  async discoverProviders(): Promise<ProviderInfo[]> {
    const piAi = await loadPiAi();
    const providerNames = piAi.getProviders() as string[];
    const result: ProviderInfo[] = [];

    for (const name of providerNames) {
      try {
        const models = piAi.getModels(name as any);
        const modelInfos: ModelInfo[] = models.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.contextWindow,
        }));
        result.push({ id: name, name, models: modelInfos });
      } catch {
        result.push({ id: name, name, models: [] });
      }
    }

    return result;
  }

  async create(config: AgentConfig): Promise<AgentHandle> {
    if (!this.isAvailable()) {
      throw new Error(
        'Pi runtime requires @mariozechner/pi-coding-agent. Install it: pnpm add @mariozechner/pi-coding-agent',
      );
    }

    const { createAgentSession, SessionManager, createCodingTools } =
      await import('@mariozechner/pi-coding-agent');
    const piAi = await loadPiAi();
    const cwd = config.cwd ?? process.cwd();
    const includeBuiltInTools = config.tools === undefined || config.tools === 'riyaan';
    const runtimeToolDefs =
      config.tools && config.tools !== 'riyaan' && Array.isArray(config.tools)
        ? config.tools
        : [];
    const pluginToolDefs = listRegisteredTools();
    const customToolDefsMap = new Map<string, (typeof runtimeToolDefs)[number]>();
    for (const tool of pluginToolDefs) {
      customToolDefsMap.set(normalizeToolName(tool.name), tool);
    }
    for (const tool of runtimeToolDefs) {
      customToolDefsMap.set(normalizeToolName(tool.name), tool);
    }
    const customToolDefs = Array.from(customToolDefsMap.values());
    const contextOverflowRetries = config.piOptions?.contextOverflowRetries ?? DEFAULT_CONTEXT_OVERFLOW_RETRIES;
    const retryDelayMs = config.piOptions?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const toolResultMaxChars = config.piOptions?.toolResultMaxChars ?? DEFAULT_TOOL_RESULT_MAX_CHARS;
    const historySummaryMaxChars = config.piOptions?.historySummaryMaxChars ?? DEFAULT_HISTORY_SUMMARY_MAX_CHARS;
    const authCooldownMs = config.piOptions?.authCooldownMs ?? DEFAULT_AUTH_COOLDOWN_MS;
    const authFailureThreshold = config.piOptions?.authFailureThreshold ?? DEFAULT_AUTH_FAILURE_THRESHOLD;

    const sessionId = `pi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let state: AgentState = 'initializing';
    const listeners = new Map<AgentEventType, Set<Listener>>();
    const conversationHistory: ConversationTurn[] = [];
    const toolNotes: ToolNote[] = [];
    const authProfiles = normalizeAuthProfiles(config.piOptions?.authProfiles);
    const authProfileState = new Map<string, AuthProfileState>(
      authProfiles.map((profile) => [profile.id, { failures: 0, cooldownUntil: 0 }]),
    );
    let runCounter = 0;
    let activeRunMetrics: MutableRunMetrics | null = null;

    const emit = (event: AgentEventType, ...args: unknown[]) => {
      listeners.get(event)?.forEach((fn) => fn(...args));
    };

    const provider = config.provider ?? 'google';
    const modelId = config.model ?? 'gemini-3-flash-preview';
    const modelCandidates = buildModelCandidates(config, provider, modelId);
    const maxAttemptsOverride = config.piOptions?.maxAttempts;
    const pluginServices = listRegisteredServices();
    const startedServices: StartedPluginService[] = [];

    // Platform callbacks bridge
    const bridge = config.callbacks
      ? createCallbacksBridge(config.callbacks, sessionId)
      : null;

    const startedAt = Date.now();
    let activeSession: any | null = null;
    let activeSessionKey: string | null = null;
    let activeProvider = provider;
    let activeModel = modelId;
    let activeAuthProfileId: string | undefined;
    let sessionNeedsBootstrap = false;

    const resolveProfilesForCandidate = (candidate: ModelFallbackCandidate): AuthProfileConfig[] => {
      if (candidate.authProfileId) {
        const explicit = authProfiles.find((profile) => profile.id === candidate.authProfileId);
        if (explicit) return [explicit];
        return [{ id: candidate.authProfileId, priority: 0 }];
      }

      const providerScoped = authProfiles.filter((profile) => {
        if (!profile.providers || profile.providers.length === 0) return true;
        return profile.providers.includes(candidate.provider);
      });
      return providerScoped.length > 0 ? providerScoped : authProfiles;
    };

    const getAttemptKey = (attempt: AttemptPlan): string => (
      `${attempt.candidate.provider}::${attempt.candidate.model}::${attempt.profile.id}`
    );

    const activateProfileEnv = (profile: AuthProfileConfig) => {
      for (const [target, value] of Object.entries(profile.env ?? {})) {
        process.env[target] = value;
      }

      for (const [target, source] of Object.entries(profile.envFrom ?? {})) {
        const sourceValue = process.env[source];
        if (sourceValue !== undefined) {
          process.env[target] = sourceValue;
        }
      }
    };

    const markProfileFailure = (profile: AuthProfileConfig, reason: ErrorClassification['kind']) => {
      if (reason !== 'auth' && reason !== 'rate_limit') return;
      const state = authProfileState.get(profile.id) ?? { failures: 0, cooldownUntil: 0 };
      state.failures += 1;
      const threshold = profile.maxFailures ?? authFailureThreshold;
      if (state.failures >= threshold) {
        const cooldown = profile.cooldownMs ?? authCooldownMs;
        state.cooldownUntil = Date.now() + cooldown;
      }
      authProfileState.set(profile.id, state);
    };

    const markProfileSuccess = (profile: AuthProfileConfig) => {
      const state = authProfileState.get(profile.id);
      if (!state) return;
      state.failures = 0;
      state.cooldownUntil = 0;
      authProfileState.set(profile.id, state);
    };

    const buildAttemptPlan = (): AttemptPlan[] => {
      const now = Date.now();
      const attempts: AttemptPlan[] = [];

      for (const candidate of modelCandidates) {
        const profiles = resolveProfilesForCandidate(candidate)
          .slice()
          .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
        const readyProfiles = profiles.filter((profile) => {
          const state = authProfileState.get(profile.id);
          return !state || state.cooldownUntil <= now;
        });

        if (readyProfiles.length > 0) {
          for (const profile of readyProfiles) {
            attempts.push({ candidate, profile });
          }
          continue;
        }

        if (profiles.length > 0) {
          attempts.push({ candidate, profile: profiles[0], bypassCooldown: true });
        }
      }

      if (attempts.length === 0) {
        attempts.push({
          candidate: modelCandidates[0],
          profile: authProfiles[0],
          bypassCooldown: true,
        });
      }

      const maxAttempts = maxAttemptsOverride ?? attempts.length;
      return attempts.slice(0, Math.max(1, maxAttempts));
    };

    const createSessionForAttempt = async (attempt: AttemptPlan) => {
      const attemptKey = getAttemptKey(attempt);
      if (activeSession && activeSessionKey === attemptKey) return;

      activateProfileEnv(attempt.profile);

      let model: any;
      try {
        model = piAi.getModel(attempt.candidate.provider as any, attempt.candidate.model);
      } catch {
        throw new Error(
          `Cannot resolve model "${attempt.candidate.model}" for provider "${attempt.candidate.provider}". ` +
          `Available providers: ${(piAi.getProviders() as string[]).join(', ')}`,
        );
      }

      const builtInTools = includeBuiltInTools ? createCodingTools(cwd) : [];
      const builtInToolsList = Array.isArray(builtInTools) ? builtInTools : [];
      const builtInToolNames = builtInToolsList
        .map((tool: any) => getToolName(tool))
        .filter((name: string) => name.length > 0);
      const customToolNames = customToolDefs.map((tool) => normalizeToolName(tool.name));

      const toolPolicyDecision = evaluateToolPolicy(
        [...builtInToolNames, ...customToolNames],
        attempt.candidate.provider,
        attempt.candidate.model,
        config.toolPolicy,
      );
      const allowedToolNames = new Set(
        toolPolicyDecision.allowedToolNames.map((name) => normalizeToolName(name)),
      );

      const filteredBuiltInTools = Array.isArray(builtInTools)
        ? builtInTools.filter((tool: any) => allowedToolNames.has(getToolName(tool)))
        : builtInTools;
      const filteredCustomTools = customToolDefs.filter((tool) => (
        allowedToolNames.has(normalizeToolName(tool.name))
      ));
      const convertedCustomTools = filteredCustomTools.length > 0
        ? (convertTools(filteredCustomTools) as any[])
        : undefined;

      const { session } = await createAgentSession({
        model,
        thinkingLevel: config.piOptions?.thinkingLevel ?? 'high',
        tools: filteredBuiltInTools,
        customTools: convertedCustomTools,
        cwd,
        sessionManager: SessionManager.inMemory(),
      });

      // Map Pi events to our events
      session.subscribe((event: any) => {
        switch (event.type) {
          case 'message_start':
            state = 'processing';
            emit('state_change', state);
            break;
          case 'message_update':
            if (event.assistantMessageEvent?.type === 'text_delta') {
              emit('response', event.assistantMessageEvent.delta);
            }
            break;
          case 'message_end':
            state = 'idle';
            emit('state_change', state);
            break;
          case 'tool_execution_start':
            emit('tool_call', { tool: event.toolName, input: event.input });
            break;
          case 'tool_execution_end': {
            const serializedOutput = safeSerialize(event.output);
            const clipped = truncateText(serializedOutput, toolResultMaxChars);
            if (clipped.truncatedChars > 0 && activeRunMetrics) {
              activeRunMetrics.toolOutputTruncatedChars += clipped.truncatedChars;
            }

            toolNotes.push({
              name: String(event.toolName ?? 'tool'),
              output: clipped.value,
              ts: Date.now(),
            });
            if (toolNotes.length > MAX_TOOL_NOTES) {
              toolNotes.splice(0, toolNotes.length - MAX_TOOL_NOTES);
            }

            emit('tool_result', {
              tool: event.toolName,
              output: clipped.truncatedChars > 0 ? clipped.value : event.output,
            });
            break;
          }
        }
      });

      if (bridge) {
        await bridge.emitEvent('tool_policy_applied', {
          provider: attempt.candidate.provider,
          model: attempt.candidate.model,
          allowedTools: toolPolicyDecision.allowedToolNames,
          blockedTools: toolPolicyDecision.blockedTools,
        });
      }

      const previousSession = activeSession;
      activeSession = session;
      activeSessionKey = attemptKey;
      activeProvider = attempt.candidate.provider;
      activeModel = attempt.candidate.model;
      activeAuthProfileId = attempt.profile.id === 'default' ? undefined : attempt.profile.id;
      sessionNeedsBootstrap = conversationHistory.length > 0;

      if (previousSession && previousSession !== session) {
        try {
          previousSession.dispose();
        } catch {
          // Ignore dispose failures for stale sessions.
        }
      }
    };

    // Warm up by trying the first available attempt (with fallback).
    let warmupError: unknown;
    for (const attempt of buildAttemptPlan()) {
      try {
        await createSessionForAttempt(attempt);
        markProfileSuccess(attempt.profile);
        warmupError = null;
        break;
      } catch (err) {
        warmupError = err;
        markProfileFailure(attempt.profile, classifyError(err).kind);
      }
    }
    if (warmupError) {
      throw warmupError;
    }

    state = 'idle';
    emit('state_change', state);

    if (bridge) {
      await bridge.emitEvent('agent_started', { provider: activeProvider, model: activeModel });
    }

    if (pluginServices.length > 0) {
      const pluginContext = {
        sessionId,
        cwd,
        runtime: 'pi' as const,
        getProvider: () => activeProvider,
        getModel: () => activeModel,
        emitEvent: bridge ? bridge.emitEvent : undefined,
      };

      for (const service of pluginServices) {
        try {
          const cleanup = await service.start?.(pluginContext);
          startedServices.push({
            name: service.name,
            serviceStop: service.stop,
            cleanup,
          });
        } catch (err) {
          if (bridge) {
            await bridge.emitEvent('plugin_service_start_failed', {
              service: service.name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    const handle: AgentHandle = {
      sessionId,

      async prompt(text: string): Promise<string> {
        state = 'processing';
        emit('state_change', state);

        const runId = `${sessionId}-run-${++runCounter}`;
        const runMetadata: AgentRunMetadata = {
          runId,
          runtime: 'pi',
          provider: activeProvider,
          model: activeModel,
          status: 'error',
          startedAt: Date.now(),
          endedAt: Date.now(),
          durationMs: 0,
          attemptCount: 0,
          fallbackCount: 0,
          contextRecoveryCount: 0,
          toolOutputTruncatedChars: 0,
          promptChars: text.length,
          responseChars: 0,
        };

        const runMetrics: MutableRunMetrics = { toolOutputTruncatedChars: 0 };
        activeRunMetrics = runMetrics;

        let response = '';
        let terminalError: unknown = null;
        let terminalClassification: ErrorClassification | null = null;
        const attemptPlan = buildAttemptPlan();
        const primaryAttemptKey = getAttemptKey(attemptPlan[0]);

        try {
          if (bridge) {
            const check = await bridge.checkGuardrails(text, 'input');
            if (!check.allowed) {
              state = 'idle';
              emit('state_change', state);
              runMetadata.status = 'error';
              runMetadata.failureReason = 'guardrail_input_blocked';
              runMetadata.errorMessage = check.violations[0]?.userMessage ?? 'Input blocked by guardrail policy.';
              return check.violations[0]?.userMessage ?? 'Input blocked by guardrail policy.';
            }
          }

          attemptLoop: for (let attemptIndex = 0; attemptIndex < attemptPlan.length; attemptIndex++) {
            const attempt = attemptPlan[attemptIndex];
            runMetadata.attemptCount += 1;
            runMetadata.failureReason = undefined;
            runMetadata.errorMessage = undefined;

            if (getAttemptKey(attempt) !== primaryAttemptKey) {
              runMetadata.fallbackCount += 1;
            }

            if (attemptIndex > 0 && retryDelayMs > 0) {
              await sleep(retryDelayMs);
            }

            let recoveryCount = 0;
            while (true) {
              try {
                await createSessionForAttempt(attempt);

                if (attempt.bypassCooldown && bridge) {
                  await bridge.emitEvent('auth_cooldown_bypassed', {
                    provider: attempt.candidate.provider,
                    model: attempt.candidate.model,
                    authProfileId: attempt.profile.id,
                  });
                }

                const historySummary = sessionNeedsBootstrap
                  ? formatHistorySummary(conversationHistory, toolNotes, historySummaryMaxChars)
                  : '';
                const promptText = historySummary
                  ? composePromptWithSummary(historySummary, text)
                  : text;

                await activeSession.prompt(promptText);
                response = extractAssistantResponse(activeSession.state.messages);
                sessionNeedsBootstrap = false;
                markProfileSuccess(attempt.profile);

                if (bridge) {
                  const check = await bridge.checkGuardrails(response, 'output');
                  if (!check.allowed) {
                    state = 'idle';
                    emit('state_change', state);
                    runMetadata.status = 'error';
                    runMetadata.failureReason = 'guardrail_output_blocked';
                    runMetadata.errorMessage = 'Response blocked by guardrail policy.';
                    response = 'Response blocked by guardrail policy.';
                  }
                }

                conversationHistory.push(
                  { role: 'user', content: text, ts: Date.now() },
                  { role: 'assistant', content: response, ts: Date.now() },
                );
                if (conversationHistory.length > MAX_HISTORY_TURNS) {
                  conversationHistory.splice(0, conversationHistory.length - MAX_HISTORY_TURNS);
                }

                runMetadata.provider = attempt.candidate.provider;
                runMetadata.model = attempt.candidate.model;
                runMetadata.authProfileId = attempt.profile.id === 'default' ? undefined : attempt.profile.id;
                runMetadata.responseChars = response.length;
                if (runMetadata.failureReason) {
                  runMetadata.status = 'error';
                } else {
                  runMetadata.errorMessage = undefined;
                  runMetadata.status = 'success';
                }
                break attemptLoop;
              } catch (err) {
                terminalError = err;
                terminalClassification = classifyError(err);
                runMetadata.failureReason = terminalClassification.reason;
                runMetadata.errorMessage = err instanceof Error ? err.message : String(err);

                if (
                  terminalClassification.kind === 'context_overflow'
                  && recoveryCount < contextOverflowRetries
                ) {
                  recoveryCount += 1;
                  runMetadata.contextRecoveryCount += 1;

                  const truncatedInSession = truncateToolPayloadsInSession(activeSession, toolResultMaxChars);
                  runMetrics.toolOutputTruncatedChars += truncatedInSession;

                  if (truncatedInSession === 0) {
                    compactConversationHistory(conversationHistory);
                    if (activeSession) {
                      try {
                        activeSession.dispose();
                      } catch {
                        // Ignore dispose errors before a forced session rebuild.
                      }
                    }
                    activeSession = null;
                    activeSessionKey = null;
                    sessionNeedsBootstrap = conversationHistory.length > 0;
                  }

                  continue;
                }

                markProfileFailure(attempt.profile, terminalClassification.kind);
                break;
              }
            }
          }

          if (!response) {
            throw terminalError ?? new Error('Prompt failed across all fallback attempts.');
          }

          state = 'idle';
          emit('state_change', state);
          return response;
        } catch (err) {
          state = 'error';
          emit('state_change', state);
          emit('error', err);
          throw err;
        } finally {
          activeRunMetrics = null;
          runMetadata.endedAt = Date.now();
          runMetadata.durationMs = runMetadata.endedAt - runMetadata.startedAt;
          runMetadata.toolOutputTruncatedChars += runMetrics.toolOutputTruncatedChars;
          runMetadata.provider = activeProvider;
          runMetadata.model = activeModel;
          if (!runMetadata.authProfileId && activeAuthProfileId) {
            runMetadata.authProfileId = activeAuthProfileId;
          }
          if (runMetadata.status === 'error' && terminalClassification && !runMetadata.failureReason) {
            runMetadata.failureReason = terminalClassification.reason;
          }
          if (bridge) {
            await bridge.persistAgentRun(runMetadata).catch(() => undefined);
          }
        }
      },

      getState(): AgentState {
        return state;
      },

      async close(): Promise<void> {
        if (startedServices.length > 0) {
          const pluginContext = {
            sessionId,
            cwd,
            runtime: 'pi' as const,
            getProvider: () => activeProvider,
            getModel: () => activeModel,
            emitEvent: bridge ? bridge.emitEvent : undefined,
          };

          for (const started of startedServices) {
            try {
              if (typeof started.cleanup === 'function') {
                await started.cleanup();
              }
            } catch (err) {
              if (bridge) {
                await bridge.emitEvent('plugin_service_cleanup_failed', {
                  service: started.name,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }

            try {
              await started.serviceStop?.(pluginContext);
            } catch (err) {
              if (bridge) {
                await bridge.emitEvent('plugin_service_stop_failed', {
                  service: started.name,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          }
        }

        if (bridge) {
          const transcript = conversationHistory.length > 0
            ? conversationHistory.map((turn) => ({
              role: turn.role,
              content: turn.content,
              ts: turn.ts,
            }))
            : (
              Array.isArray(activeSession?.state?.messages)
                ? activeSession.state.messages
                  .filter((m: any) => m.role === 'user' || m.role === 'assistant')
                  .map((m: any) => {
                    const content = typeof m.content === 'string'
                      ? m.content
                      : Array.isArray(m.content)
                        ? m.content
                          .filter((c: any) => c.type === 'text')
                          .map((c: any) => c.text)
                          .join('')
                        : '';
                    return { role: m.role as string, content, ts: Date.now() };
                  })
                : []
            );

          await bridge.persistMessages(transcript, sessionId);
          await bridge.resolveConversation('terminal', startedAt);
          await bridge.emitEvent('agent_closed');
        }

        if (activeSession) {
          activeSession.dispose();
          activeSession = null;
        }
        state = 'closed';
        emit('state_change', state);
        emit('close');
      },

      on(event: AgentEventType, handler: Listener): void {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(handler);
      },

      off(event: AgentEventType, handler: Listener): void {
        listeners.get(event)?.delete(handler);
      },
    };

    return handle;
  }
}
