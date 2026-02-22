import {
  type JobContext,
  defineAgent,
  voice,
  llm,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { RoomServiceClient } from 'livekit-server-sdk';
import type { LiveKitAgentConfig } from '../types';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type {
  AgentCallbacks,
  AgentEvent,
  AgentPersonaData,
  BufferedMessage,
  GuardrailResult,
} from './callbacks';
import { createConvexAgentCallbacks } from './callbacks';
import { createToolsFromConvex } from './tools.js';
import { DataChannelToolBridge, type OnToolExecuted } from './data-channel-tools.js';

const GUARDRAIL_TIMEOUT_MS = 3000;
const TTS_DIRECTIVE_PATTERN = /\[\[tts:([^\]]+)\]\]/gi;
const SAFE_TTS_VOICE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const SILERO_MODULE_NAME = '@livekit/agents-plugin-silero';
const SILERO_VAD_USERDATA_KEY = 'sileroVAD';
const RAG_MIN_QUERY_CHARS = 3;
const RAG_SEARCH_TIMEOUT_MS = 1800;
const RAG_MIN_SCORE = 0.5;
const RAG_MAX_RESULTS = 3;
const RAG_MAX_ITEM_CHARS = 800;
const RAG_CONTEXT_MESSAGE_ID = 'lk.agent.rag_context';

interface ProcWithUserData {
  userData?: Record<string, unknown>;
  userdata?: Record<string, unknown>;
}

function getOrCreateProcUserData(proc: unknown): Record<string, unknown> {
  if (!proc || typeof proc !== 'object') return {};
  const candidate = proc as ProcWithUserData;

  if (candidate.userData && typeof candidate.userData === 'object') {
    return candidate.userData;
  }
  if (candidate.userdata && typeof candidate.userdata === 'object') {
    return candidate.userdata;
  }

  const bucket: Record<string, unknown> = {};
  try {
    candidate.userData = bucket;
  } catch {
    // Ignore write errors; we'll just use an ephemeral in-memory object.
  }
  return bucket;
}

async function loadSileroVad(): Promise<unknown | null> {
  try {
    const moduleName: string = SILERO_MODULE_NAME;
    const silero = await import(moduleName);
    const vadLoader = (silero as { VAD?: { load?: (options?: Record<string, unknown>) => Promise<unknown> } }).VAD?.load;
    if (!vadLoader) {
      console.warn('[agent] Silero plugin loaded but VAD.load() is unavailable');
      return null;
    }

    const options: Record<string, unknown> = {};
    const minSilenceDuration = process.env.SILERO_MIN_SILENCE_DURATION;
    const activationThreshold = process.env.SILERO_ACTIVATION_THRESHOLD;
    const prefixPaddingDuration = process.env.SILERO_PREFIX_PADDING_DURATION;

    if (minSilenceDuration !== undefined) {
      const value = Number(minSilenceDuration);
      if (Number.isFinite(value)) options.min_silence_duration = value;
    }
    if (activationThreshold !== undefined) {
      const value = Number(activationThreshold);
      if (Number.isFinite(value)) options.activation_threshold = value;
    }
    if (prefixPaddingDuration !== undefined) {
      const value = Number(prefixPaddingDuration);
      if (Number.isFinite(value)) options.prefix_padding_duration = value;
    }

    return await vadLoader(Object.keys(options).length > 0 ? options : undefined);
  } catch (err) {
    console.warn('[agent] Silero VAD unavailable, continuing without explicit VAD:', err);
    return null;
  }
}

/**
 * Voice agent preamble — prepended to every system prompt.
 * Handles voice-specific constraints, response format, and conversation lifecycle.
 */
const VOICE_PREAMBLE = `You are a voice agent. All your responses are spoken aloud — never output markdown, bullet points, URLs, or formatted text.

## Response Style
- Keep responses to 1–3 sentences unless the user asks for detail.
- Use natural, conversational language with contractions (I'm, don't, let's).
- Never say "as an AI language model" or break character.

## Conversation Flow
- If you can't hear or understand the user, say "Sorry, I didn't catch that — could you say that again?"
- If something goes wrong, apologize briefly and offer an alternative. Don't expose technical details.
- If the user goes off-topic, gently redirect to your area of expertise.

## Ending Calls
- When the user says goodbye or all questions are answered, give a brief warm closing.
- Do not ask open-ended follow-ups after a clear goodbye.
`;

/** Await input guardrail check with timeout. Returns null on timeout or error (fail-open). */
async function checkInputGuardrail(
  checkGuardrails: NonNullable<AgentCallbacks['checkGuardrails']>,
  transcript: string,
  sessionId: string,
  traceId: string | undefined,
): Promise<GuardrailResult | null> {
  try {
    return await Promise.race([
      checkGuardrails(transcript, 'input', sessionId, traceId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GUARDRAIL_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.warn('[agent] Input guardrail check failed:', err);
    return null; // fail-open
  }
}

function truncateForRag(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

export interface AgentDefinitionOptions {
  /** Gemini native audio model for speech-to-speech (default: "gemini-2.5-flash-native-audio-preview-12-2025") */
  model?: string;
  /** Voice preset (default: "Puck") */
  voice?: string;
  /** System instructions for the agent */
  instructions?: string;
  /** Model temperature (default: 0.8) */
  temperature?: number;
  /** Tools keyed by name (use llm.tool() to create each) */
  tools?: llm.ToolContext;
  /** Backend-agnostic lifecycle callbacks (persona, messages, conversation) */
  callbacks?: AgentCallbacks;
  /** Max auto-reconnect attempts on Gemini errors (default: 5) */
  maxReconnects?: number;
  /** Delay between reconnect attempts in ms (default: 2000) */
  reconnectDelayMs?: number;
  /** Idle timeout in ms — auto-disconnect if no speech activity (default: 30000) */
  idleTimeoutMs?: number;
  /** Enable thinking sounds during model/tool processing (default: true) */
  enableBackgroundAudio?: boolean;
}

/**
 * Parse appSlug and sessionId from room name.
 * Room name format: {appSlug}-{sessionId}-{timestamp}
 * SessionId format: session-{ts}-{random}
 * Since sessionId always starts with "session-", we split on "-session-" to extract the appSlug.
 */
function parseRoomName(roomName: string, fallbackAppSlug: string): { appSlug: string; sessionId: string } {
  const marker = '-session-';
  const markerIdx = roomName.indexOf(marker);
  if (markerIdx > 0) {
    const appSlug = roomName.slice(0, markerIdx);
    const rest = roomName.slice(markerIdx + 1); // "session-{ts}-{random}-{roomTs}"
    const lastDash = rest.lastIndexOf('-');
    const sessionId = lastDash > 0 ? rest.slice(0, lastDash) : rest;
    return { appSlug, sessionId };
  }
  // Fallback: use provided appSlug and strip prefix + timestamp
  const withoutPrefix = roomName.startsWith(fallbackAppSlug + '-')
    ? roomName.slice(fallbackAppSlug.length + 1)
    : roomName;
  const lastDash = withoutPrefix.lastIndexOf('-');
  return {
    appSlug: fallbackAppSlug,
    sessionId: lastDash > 0 ? withoutPrefix.slice(0, lastDash) : withoutPrefix,
  };
}

/** Check if the room still has remote (non-agent) participants */
function hasRemoteParticipants(ctx: JobContext): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const room = ctx.room as any;
    if (room.remoteParticipants) {
      return room.remoteParticipants.size > 0;
    }
    // Fallback: assume participants are still there
    return true;
  } catch {
    return true;
  }
}

/** Map a session close reason to a conversation status + resolution */
function mapCloseReasonToResolution(reason: string): { status: string; resolution: string } {
  switch (reason) {
    case 'error':
      return { status: 'resolved', resolution: 'error' };
    case 'job_shutdown':
    case 'shutdown':
      return { status: 'resolved', resolution: 'shutdown' };
    case 'participant_disconnected':
      return { status: 'resolved', resolution: 'completed' };
    case 'idle_timeout':
      return { status: 'resolved', resolution: 'idle_timeout' };
    default:
      return { status: 'resolved', resolution: reason === 'unknown' ? 'completed' : reason };
  }
}

interface ParsedTtsDirectives {
  cleanText: string;
  voice?: string;
  directives: Record<string, string>;
}

function parseTtsDirectives(text: string): ParsedTtsDirectives {
  const directives: Record<string, string> = {};
  let voice: string | undefined;

  const cleanText = text.replace(TTS_DIRECTIVE_PATTERN, (_match, payload: string) => {
    const parts = payload
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq <= 0) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      const value = part.slice(eq + 1).trim();
      if (!key || !value) continue;
      directives[key] = value;
      if (key === "voice" && SAFE_TTS_VOICE_PATTERN.test(value)) {
        voice = value;
      }
    }
    return "";
  }).replace(/\s+/g, " ").trim();

  return { cleanText, voice, directives };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStateEvent(ev: unknown): { state: string; oldState?: string } | null {
  if (typeof ev === 'string' && ev.trim().length > 0) {
    return { state: ev.trim() };
  }

  const record = asRecord(ev);
  if (!record) return null;

  const state = readNonEmptyString(record.newState)
    ?? readNonEmptyString(record.new_state)
    ?? readNonEmptyString(record.state);
  if (!state) return null;

  const oldState = readNonEmptyString(record.oldState)
    ?? readNonEmptyString(record.old_state)
    ?? undefined;

  return { state, oldState };
}

function readToolExecutionEvent(ev: unknown): {
  toolNames: string[];
  toolCallCount: number;
  toolErrorCount: number;
} {
  const record = asRecord(ev);
  if (!record) {
    return { toolNames: [], toolCallCount: 0, toolErrorCount: 0 };
  }

  const functionCalls = Array.isArray(record.functionCalls)
    ? record.functionCalls
    : Array.isArray(record.function_calls)
      ? record.function_calls
      : [];
  const functionCallOutputs = Array.isArray(record.functionCallOutputs)
    ? record.functionCallOutputs
    : Array.isArray(record.function_call_outputs)
      ? record.function_call_outputs
      : [];

  const legacyToolNames = Array.isArray(record.toolNames)
    ? record.toolNames.filter((name): name is string => typeof name === 'string' && name.length > 0)
    : [];

  const namesFromCalls = functionCalls
    .map((call) => {
      const item = asRecord(call);
      if (!item) return null;
      return readNonEmptyString(item.name);
    })
    .filter((name): name is string => typeof name === 'string');

  const toolNames = Array.from(new Set(
    (legacyToolNames.length > 0 ? legacyToolNames : namesFromCalls)
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  ));

  const toolErrorCount = functionCallOutputs.reduce((count, output) => {
    const item = asRecord(output);
    if (!item) return count;
    return item.isError === true || item.is_error === true
      ? count + 1
      : count;
  }, 0);

  return {
    toolNames,
    toolCallCount: functionCalls.length > 0 ? functionCalls.length : toolNames.length,
    toolErrorCount,
  };
}

function readMetricsEvent(ev: unknown): unknown {
  const record = asRecord(ev);
  if (!record) return ev;
  return Object.prototype.hasOwnProperty.call(record, 'metrics') ? record.metrics : ev;
}

function readErrorMessage(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (value instanceof Error && value.message.trim().length > 0) return value.message.trim();

  const record = asRecord(value);
  if (!record) return 'unknown error';

  const directMessage = readNonEmptyString(record.message);
  if (directMessage) return directMessage;

  if (record.error instanceof Error && record.error.message.trim().length > 0) {
    return record.error.message.trim();
  }
  const nestedError = asRecord(record.error);
  if (nestedError) {
    const nestedMessage = readNonEmptyString(nestedError.message)
      ?? readNonEmptyString(nestedError.reason);
    if (nestedMessage) return nestedMessage;
  }
  const nestedErrorText = readNonEmptyString(record.error);
  if (nestedErrorText) return nestedErrorText;

  const label = readNonEmptyString(record.label);
  if (label) return label;

  return 'unknown error';
}

function readErrorRecoverable(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  if (typeof record.recoverable === 'boolean') return record.recoverable;

  const nestedError = asRecord(record.error);
  if (nestedError && typeof nestedError.recoverable === 'boolean') {
    return nestedError.recoverable;
  }

  return false;
}

function readErrorType(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return readNonEmptyString(record.type) ?? undefined;
}

function readErrorSource(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();

  const record = asRecord(value);
  if (record) {
    const label = readNonEmptyString(record.label);
    if (label) return label;
  }

  const ctorName = (value as { constructor?: { name?: unknown } } | undefined)?.constructor?.name;
  if (typeof ctorName === 'string' && ctorName !== 'Object' && ctorName.trim().length > 0) {
    return ctorName.trim();
  }

  return undefined;
}

function readErrorEvent(ev: unknown): {
  message: string;
  recoverable: boolean;
  errorType?: string;
  source?: string;
} {
  const record = asRecord(ev);
  const errorPayload = record && Object.prototype.hasOwnProperty.call(record, 'error')
    ? record.error
    : ev;

  const errorType = readErrorType(errorPayload);
  const source = readErrorSource(record?.source);

  return {
    message: readErrorMessage(errorPayload),
    recoverable: readErrorRecoverable(errorPayload),
    ...(errorType ? { errorType } : {}),
    ...(source ? { source } : {}),
  };
}

function readCloseEvent(info: unknown): { reason: string; error?: unknown } {
  const record = asRecord(info);
  if (!record) return { reason: 'unknown' };

  const reason = readNonEmptyString(record.reason)
    ?? readNonEmptyString(record.closeReason)
    ?? readNonEmptyString(record.close_reason)
    ?? (Object.prototype.hasOwnProperty.call(record, 'error') ? 'error' : 'unknown');

  return {
    reason,
    error: record.error,
  };
}

function extractErrorCode(value: unknown): number | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  if (typeof record.code === 'number') return record.code;

  const body = asRecord(record.body);
  if (body && typeof body.code === 'number') return body.code;

  const nestedError = asRecord(record.error);
  if (nestedError) {
    if (typeof nestedError.code === 'number') return nestedError.code;
    const nestedBody = asRecord(nestedError.body);
    if (nestedBody && typeof nestedBody.code === 'number') return nestedBody.code;
  }

  return undefined;
}

/**
 * Create a LiveKit agent definition using Gemini Live API (speech-to-speech).
 * Uses google.beta.realtime.RealtimeModel for low-latency voice conversations.
 *
 * Auto-reconnects when Gemini errors out, up to maxReconnects times.
 * Does NOT reconnect when the user disconnects or room empties.
 *
 * @see https://docs.livekit.io/agents/models/realtime/plugins/gemini/
 */
export function createAgentDefinition(options?: AgentDefinitionOptions) {
  const config: Required<Pick<AgentDefinitionOptions, 'model' | 'voice' | 'instructions' | 'temperature'>> = {
    model: options?.model ?? 'gemini-2.5-flash-native-audio-preview-12-2025',
    voice: options?.voice ?? 'Puck',
    instructions: options?.instructions ?? 'You are a helpful voice assistant. Answer questions clearly and concisely.',
    temperature: options?.temperature ?? 0.8,
  };

  const maxReconnects = options?.maxReconnects ?? 5;
  const reconnectDelayMs = options?.reconnectDelayMs ?? 2000;
  const idleTimeoutMs = options?.idleTimeoutMs ?? 30_000;
  const enableBackgroundAudio = options?.enableBackgroundAudio !== false;

  return defineAgent({
    entry: async (ctx: JobContext) => {
      let roomName = 'unknown';
      console.log('[agent] Job received, connecting to room...');

      try {
        await ctx.connect();

        // Room name is only available after connect()
        roomName = ctx.room.name ?? 'unknown';

        // Read agent mode from room metadata (set by UI via createRoom)
        const roomMeta = (() => {
          try { return JSON.parse(ctx.room.metadata ?? '{}'); }
          catch { return {}; }
        })();
        let agentMode: 'realtime' | 'pipeline' = roomMeta.agentMode === 'pipeline' ? 'pipeline' : 'realtime';
        console.log(`[agent] Mode from metadata: ${agentMode}`);

        // Validate GOOGLE_API_KEY (required for both modes — realtime uses RealtimeModel, pipeline uses LLM)
        if (!process.env.GOOGLE_API_KEY) {
          throw new Error('GOOGLE_API_KEY env var is not set');
        }
        const traceId = crypto.randomUUID();
        console.log(`[agent] Connected to room: ${roomName} (traceId: ${traceId})`);

        // Reuse a process-local VAD model across jobs when possible.
        const procUserData = getOrCreateProcUserData(
          (ctx as JobContext & { proc?: unknown }).proc,
        );
        let sileroVad: unknown | null = procUserData[SILERO_VAD_USERDATA_KEY] ?? null;
        let sileroVadLoadAttempted = sileroVad !== null;
        const ensurePipelineVad = async (): Promise<unknown | null> => {
          if (sileroVadLoadAttempted) return sileroVad;
          sileroVadLoadAttempted = true;

          sileroVad = await loadSileroVad();
          if (sileroVad) {
            procUserData[SILERO_VAD_USERDATA_KEY] = sileroVad;
            console.log('[agent] Silero VAD loaded for pipeline turn detection');
          }
          return sileroVad;
        };

        // Resolve env vars once for callbacks and tool loading
        const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
        const envAppSlug = process.env.APP_SLUG ?? process.env.NEXT_PUBLIC_APP_SLUG;
        const appSecret = process.env.APP_SECRET;
        const { appSlug: roomAppSlug, sessionId: roomSessionId } = parseRoomName(
          roomName,
          envAppSlug ?? '',
        );

        // Resolve callbacks: use provided callbacks, or auto-create from env vars.
        let callbacks = options?.callbacks;
        if (!callbacks) {
          if (convexUrl && envAppSlug && appSecret) {
            callbacks = createConvexAgentCallbacks({ convexUrl, appSlug: roomAppSlug, appSecret, traceId });
            console.log(`[agent] Created Convex callbacks for app: ${roomAppSlug}`);
          } else {
            console.warn('[agent] No callbacks configured — missing CONVEX_URL, APP_SLUG, or APP_SECRET');
          }
        }

        // Load persona and tools in parallel with waiting for participant
        const personaPromise = (async (): Promise<{
          instructions: string;
          voice?: string;
          rawPersona?: AgentPersonaData;
        }> => {
          if (!callbacks?.loadPersona) return { instructions: VOICE_PREAMBLE + config.instructions };
          try {
            const persona = await callbacks.loadPersona();
            if (persona) {
              const base = persona.systemPrompt || config.instructions;
              return {
                instructions: VOICE_PREAMBLE + base,
                voice: persona.voice,
                rawPersona: persona,
              };
            }
          } catch (err) {
            console.warn('[agent] Failed to load persona, using default instructions:', err);
          }
          return { instructions: VOICE_PREAMBLE + config.instructions };
        })();

        // Set up RoomServiceClient for metadata updates (e.g. handoff signaling)
        const livekitUrl = process.env.LIVEKIT_URL;
        const livekitApiKey = process.env.LIVEKIT_API_KEY;
        const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
        let roomService: RoomServiceClient | null = null;
        if (livekitUrl && livekitApiKey && livekitApiSecret) {
          roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
        }

        // Load tools from Convex (runs in parallel with persona and waitForParticipant)
        const toolsPromise = (async (): Promise<{ tools: llm.ToolContext; confirmationRequired: string[] }> => {
          if (!convexUrl || !roomAppSlug || !appSecret) {
            console.warn('[agent] Skipping tool loading — missing Convex env vars');
            return { tools: options?.tools ?? {}, confirmationRequired: [] };
          }
          try {
            const { tools: convexTools, confirmationRequired } = await createToolsFromConvex({
              convexUrl,
              appSlug: roomAppSlug,
              appSecret,
              sessionId: roomSessionId,
              traceId,
              onToolResult: (toolName, result) => {
                // Detect handoff from tool result and update room metadata
                if (result.handoff === true && roomService) {
                  const handoffMeta = {
                    handoff: {
                      reason: (result.reason as string) ?? toolName,
                      priority: (result.priority as string) ?? 'normal',
                      timestamp: Date.now(),
                    },
                  };
                  roomService.updateRoomMetadata(roomName, JSON.stringify(handoffMeta))
                    .then(() => console.log(`[agent] Room metadata updated with handoff from tool: ${toolName}`))
                    .catch((err) => console.warn('[agent] Failed to update room metadata for handoff:', err));
                }
              },
            });
            const toolCount = Object.keys(convexTools).length;
            console.log(`[agent] Loaded ${toolCount} tools from Convex for app: ${roomAppSlug}`);
            // Merge: options?.tools take precedence over Convex tools
            return { tools: { ...convexTools, ...(options?.tools ?? {}) }, confirmationRequired };
          } catch (err) {
            console.warn('[agent] Failed to load tools from Convex, using defaults:', err);
            return { tools: options?.tools ?? {}, confirmationRequired: [] };
          }
        })();

        // Warm VAD early when we already know pipeline mode is requested.
        const pipelineVadPromise = agentMode === 'pipeline'
          ? ensurePipelineVad()
          : Promise.resolve<unknown | null>(null);

        // Wait for a real participant (browser user or SIP callee) to join
        console.log('[agent] Waiting for participant...');
        const participant = await ctx.waitForParticipant();
        console.log(`[agent] Participant joined: ${participant.identity}`);

        // Detect SIP/PSTN participants for channel tagging
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isSipParticipant = (participant as any).kind === 3
          || participant.identity?.startsWith('sip_');
        const channel = isSipParticipant ? 'voice-pstn' : 'voice-webrtc';

        // For SIP calls wait for audio track (call might still be ringing)
        if (participant.trackPublications.size === 0) {
          console.log('[agent] Waiting for participant audio track...');
          await new Promise<void>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const onTrack = (..._args: any[]) => {
              ctx.room.off('trackPublished', onTrack);
              resolve();
            };
            ctx.room.on('trackPublished', onTrack);
          });
          console.log('[agent] Audio track published');
        }

        const [personaResult, toolsResult] = await Promise.all([
          personaPromise,
          toolsPromise,
          pipelineVadPromise,
        ]);
        const baseInstructions = personaResult.instructions;
        const personaVoice = personaResult.voice;
        const rawPersona = personaResult.rawPersona;
        const { tools: loadedTools, confirmationRequired } = toolsResult;

        // Seed session chat context with persona traits rather than flattening into instructions.
        const baseChatCtx = llm.ChatContext.empty();
        if (rawPersona) {
          const personaContextParts: string[] = [];
          if (rawPersona.personaName) personaContextParts.push(`Your name is ${rawPersona.personaName}.`);
          if (rawPersona.personaTone) personaContextParts.push(`Speak in a ${rawPersona.personaTone} tone.`);
          if (rawPersona.preferredTerms) personaContextParts.push(`Preferred terms: ${rawPersona.preferredTerms}.`);
          if (rawPersona.blockedTerms) personaContextParts.push(`Never use these terms: ${rawPersona.blockedTerms}.`);
          if (personaContextParts.length > 0) {
            baseChatCtx.addMessage({
              role: 'system',
              content: personaContextParts.join(' '),
            });
          }
        }

        // Append tool instructions when tools are loaded
        const hasTools = Object.keys(loadedTools).length > 0;
        let instructions = hasTools
          ? baseInstructions + '\n\n## Tool Usage\n- Before calling a tool, briefly acknowledge what you\'re doing (e.g. "Let me look that up," "One moment," "Sure, checking now"). Vary your phrasing.\n- ALWAYS use tools for real data — NEVER fabricate or guess results.\n- If a tool fails or returns nothing, tell the user honestly.'
          : baseInstructions;

        if (confirmationRequired.length > 0) {
          instructions += `\n- Ask for confirmation before calling: ${confirmationRequired.join(', ')}.`;
          console.log(`[agent] Tools requiring confirmation: ${confirmationRequired.join(', ')}`);
        }

        console.log(`[agent] Instructions loaded (${instructions.length} chars, starts with: "${instructions.slice(0, 60)}...")`);
        console.log(`[agent] Voice: ${personaVoice || config.voice} ${personaVoice ? '(from persona)' : '(default)'}`);
        console.log(`[agent] Tools loaded: ${Object.keys(loadedTools).join(', ') || '(none)'}`);

        // Mutable reference to the current agent — set inside the session loop,
        // read by the robot_look tool closure to inject images into chat context.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentAgent: any = null;

        // --- Data channel tool bridge for robot participants ---
        // Check if ANY participant in the room is a robot (not just the first joiner).
        // This ensures robot_* tools are overridden even if a non-robot joins first.
        const hasRobotInRoom = (() => {
          if (participant.identity?.startsWith('robot')) return true;
          const room = ctx.room as any;
          if (room.remoteParticipants) {
            for (const [, p] of room.remoteParticipants) {
              if (p.identity?.startsWith('robot')) return true;
            }
          }
          return false;
        })();
        if (hasRobotInRoom && roomService) {
          // Force pipeline mode when robot is present — robot_look uses updateChatCtx
          // to inject images, which is not supported in Gemini Live (realtime) mode.
          if (agentMode !== 'pipeline') {
            console.log(`[agent] Forcing pipeline mode (was ${agentMode}) — robot participant requires updateChatCtx for vision`);
            agentMode = 'pipeline';
          }

          // Audit logging callback: POST execution records back to Convex (best-effort)
          const auditLog: OnToolExecuted | undefined = convexUrl && roomAppSlug && appSecret
            ? (toolName, args, result, durationMs, status) => {
                const spanId = crypto.randomUUID().slice(0, 8);
                fetch(new URL('/api/tools/log', convexUrl).toString(), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    appSlug: roomAppSlug,
                    appSecret,
                    sessionId: roomSessionId,
                    toolName,
                    parameters: JSON.stringify(args),
                    result,
                    status,
                    executedAt: Date.now() - durationMs,
                    durationMs,
                    traceId,
                    spanId,
                    source: 'agent_datachannel',
                  }),
                }).catch((err) => console.warn('[agent] Failed to log data channel tool execution:', err));
              }
            : undefined;

          const bridge = new DataChannelToolBridge(ctx, roomService, auditLog);
          bridge.startListening();

          const robotToolNames = Object.keys(loadedTools).filter(name => name.startsWith('robot_'));
          for (const toolName of robotToolNames) {
            const original = loadedTools[toolName] as any;

            if (toolName === 'robot_look') {
              // robot_look returns a base64 JPEG via chunked data channel.
              // Inject it into chat context as an image so Gemini can see it.
              loadedTools[toolName] = {
                ...original,
                execute: async (args: Record<string, unknown>) => {
                  const result = await bridge.sendToolCall(toolName, args);
                  if (result.startsWith('data:image/') && currentAgent) {
                    try {
                      const chatCtx = currentAgent.chatCtx.copy();
                      chatCtx.addMessage({
                        role: 'user',
                        content: [
                          llm.createImageContent({
                            image: result,
                            inferenceDetail: 'auto',
                            mimeType: 'image/jpeg',
                          }),
                        ],
                      });
                      await currentAgent.updateChatCtx(chatCtx);
                      console.log(`[agent] robot_look: injected image into chat context (${result.length} chars)`);
                      return 'Photo captured successfully. The image has been added to your visual context — describe what you see.';
                    } catch (err) {
                      console.error('[agent] robot_look: failed to inject image into chat context:', err);
                      return 'Photo captured but failed to process the image.';
                    }
                  }
                  return result; // error string passthrough
                },
              };
            } else {
              // Standard robot tool — pass through data channel
              loadedTools[toolName] = {
                ...original,
                execute: async (args: Record<string, unknown>) => {
                  return bridge.sendToolCall(toolName, args);
                },
              };
            }
            console.log(`[agent] Overrode ${toolName} → data channel execution`);
          }

          if (robotToolNames.length > 0) {
            console.log(`[agent] ${robotToolNames.length} tools routed via data channel to robot`);
          }
        }

        // --- Shared state across reconnect sessions ---
        const sessionId = roomSessionId;
        const messageBuffer: BufferedMessage[] = [];
        const eventBuffer: AgentEvent[] = [];
        const allMessages: Array<{ role: string; content: string; ts: number }> = [];
        const sessionStart = Date.now();
        const persistMessages = callbacks?.persistMessages;
        const resolveConversation = callbacks?.resolveConversation;
        const emitEvents = callbacks?.emitEvents;
        const checkGuardrails = callbacks?.checkGuardrails;
        let lastCloseReason = 'unknown';
        let conversationResolved = false;
        let pipelineVoice = personaVoice || config.voice;
        let restartSessionForVoiceDirective = false;
        let suppressReconnectReply = false;
        const searchKnowledge = callbacks?.searchKnowledge;

        class ContextAgent extends voice.Agent {
          async onUserTurnCompleted(turnCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
            if (!searchKnowledge) return;
            const clearRagContext = () => {
              const idx = turnCtx.indexById(RAG_CONTEXT_MESSAGE_ID);
              if (idx !== undefined) {
                turnCtx.items.splice(idx, 1);
              }
            };
            const userText = (newMessage.textContent ?? '').trim();
            if (userText.length < RAG_MIN_QUERY_CHARS) {
              clearRagContext();
              return;
            }
            try {
              const result = await Promise.race([
                searchKnowledge(userText, sessionId, traceId),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), RAG_SEARCH_TIMEOUT_MS)),
              ]);
              if (!result?.results?.length) {
                clearRagContext();
                return;
              }

              const relevant = result.results
                .filter((item) => Number.isFinite(item.score) && item.score >= RAG_MIN_SCORE)
                .sort((a, b) => b.score - a.score)
                .slice(0, RAG_MAX_RESULTS);
              if (relevant.length === 0) {
                clearRagContext();
                return;
              }

              const snippets = relevant.map((item, index) => {
                const source = item.category
                  ? `${item.title} (${item.category}, score ${item.score.toFixed(2)})`
                  : `${item.title} (score ${item.score.toFixed(2)})`;
                return `[${index + 1}] ${source}\n${truncateForRag(item.content, RAG_MAX_ITEM_CHARS)}`;
              }).join('\n\n');

              const ragContext =
                `Relevant knowledge snippets:\n\n${snippets}\n\n`
                + 'Use these when relevant. Do not mention retrieval unless it is natural in the conversation.';
              const existingIdx = turnCtx.indexById(RAG_CONTEXT_MESSAGE_ID);
              if (existingIdx !== undefined && turnCtx.items[existingIdx]?.type === 'message') {
                turnCtx.items[existingIdx] = llm.ChatMessage.create({
                  id: RAG_CONTEXT_MESSAGE_ID,
                  role: 'system',
                  content: ragContext,
                  createdAt: turnCtx.items[existingIdx]!.createdAt,
                });
              } else {
                turnCtx.addMessage({
                  id: RAG_CONTEXT_MESSAGE_ID,
                  role: 'system',
                  content: ragContext,
                });
              }
              console.log(`[agent] RAG: injected ${relevant.length} result(s) (top score: ${relevant[0]!.score.toFixed(3)})`);
            } catch (err) {
              clearRagContext();
              console.warn('[agent] RAG search failed (continuing without retrieval):', err);
            }
          }
        }

        const pushEvent = (eventType: string, data?: Record<string, unknown>) => {
          eventBuffer.push({
            eventType,
            ts: Date.now(),
            data: data ? JSON.stringify({ ...data, traceId }) : JSON.stringify({ traceId }),
          });
        };

        // Flush helpers
        const flushMessages = async () => {
          if (messageBuffer.length === 0 || !persistMessages) return;
          const batch = messageBuffer.splice(0);
          try {
            await persistMessages(batch);
          } catch (err) {
            console.warn('[agent] Failed to persist messages, re-queuing:', err);
            messageBuffer.unshift(...batch);
          }
        };

        const flushEvents = async () => {
          if (eventBuffer.length === 0 || !emitEvents) return;
          const batch = eventBuffer.splice(0);
          try {
            await emitEvents(sessionId, batch);
          } catch (err) {
            console.warn('[agent] Failed to emit events, re-queuing:', err);
            eventBuffer.unshift(...batch);
          }
        };

        const flushAll = async () => {
          await flushMessages();
          await flushEvents();
        };

        // Sync the conversation record periodically so dashboard stays current
        let lastSyncedMessageCount = 0;
        // Track in-flight sync so finally block can wait for it before resolving
        const syncState = { promise: null as Promise<void> | null };
        const syncConversation = async () => {
          if (!resolveConversation || conversationResolved) return;
          if (allMessages.length === lastSyncedMessageCount) return;
          lastSyncedMessageCount = allMessages.length;
          const p = resolveConversation(sessionId, channel, sessionStart, allMessages, { status: 'active' })
            .catch((err) => console.warn('[agent] Failed to sync conversation:', err));
          syncState.promise = p;
          await p;
          syncState.promise = null;
        };

        const flushTimer = setInterval(flushAll, 2000);
        const syncTimer = setInterval(syncConversation, 5000);

        // --- SIGTERM safety: flush data + resolve conversation on shutdown ---
        ctx.addShutdownCallback(async () => {
          console.log('[agent] Shutdown callback triggered');
          clearInterval(flushTimer);
          clearInterval(syncTimer);

          pushEvent('session_ended', {
            reason: 'shutdown',
            totalMessages: allMessages.length,
            durationMs: Date.now() - sessionStart,
          });
          await flushAll();

          if (resolveConversation && !conversationResolved) {
            conversationResolved = true;
            try {
              await resolveConversation(sessionId, channel, sessionStart, allMessages, {
                status: 'resolved',
                resolution: 'shutdown',
              });
              console.log('[agent] Conversation resolved (shutdown)');
            } catch (err) {
              console.error('[agent] Shutdown: failed to resolve conversation:', err);
            }
          }
        });

        // --- Detect participant disconnect → resolve session ---
        // When the last non-agent participant leaves, trigger a graceful close
        // so the conversation gets resolved instead of staying "active" forever.
        let participantDisconnectResolve: (() => void) | null = null;
        const participantDisconnectPromise = new Promise<void>((resolve) => {
          participantDisconnectResolve = resolve;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.room.on('participantDisconnected', (..._args: any[]) => {
          // Check after a short delay (room state needs to settle)
          setTimeout(() => {
            if (!hasRemoteParticipants(ctx)) {
              console.log('[agent] All remote participants left — triggering cleanup');
              participantDisconnectResolve?.();
            }
          }, 500);
        });

        // --- Idle timeout: auto-disconnect when no speech activity ---
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        let idleResolve: (() => void) | null = null;
        const idlePromise = new Promise<void>((resolve) => {
          idleResolve = resolve;
        });

        function resetIdleTimer() {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            console.log(`[agent] Idle timeout (${idleTimeoutMs}ms) — auto-disconnecting`);
            idleResolve?.();
          }, idleTimeoutMs);
        }

        // --- Session loop with auto-reconnect ---
        let attempt = 0;
        let isFirstSession = true;
        let currentMode = agentMode;
        let backgroundAudio: voice.BackgroundAudioPlayer | null = null;
        const safeCloseSession = async (session: voice.AgentSession) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (session as any).close?.();
          } catch {
            // Session may already be closed by the time we attempt cleanup.
          }
        };
        const safeCloseBackgroundAudio = async () => {
          if (!backgroundAudio) return;
          try {
            await backgroundAudio.close();
          } catch {
            // Ignore close errors from best-effort background audio.
          }
          backgroundAudio = null;
        };

        try {
          while (attempt <= maxReconnects) {
            console.log(`[agent] Creating agent session (mode: ${currentMode}, model: ${config.model}, attempt: ${attempt}/${maxReconnects})`);
            await safeCloseBackgroundAudio();

            const sessionChatCtx = (() => {
              const ctxWithPersona = baseChatCtx.copy();
              if (isFirstSession || allMessages.length === 0) {
                return ctxWithPersona;
              }
              for (const msg of allMessages) {
                ctxWithPersona.addMessage({
                  role: msg.role === 'user' ? 'user' : 'assistant',
                  content: msg.content,
                  createdAt: msg.ts,
                });
              }
              return ctxWithPersona;
            })();

            let sessionInstructions = instructions;
            if (currentMode === 'realtime' && !isFirstSession && allMessages.length > 0) {
              sessionInstructions = instructions
                + '\n\nIMPORTANT: This is a resumed session. Continue naturally from where you left off.'
                + ' Do NOT re-introduce yourself or greet the user again.';
            }
            if (!isFirstSession && allMessages.length > 0) {
              console.log(`[agent] Reconnect context restored from ${allMessages.length} message(s)`);
            }

            const agent = new ContextAgent({
              instructions: sessionInstructions,
              chatCtx: sessionChatCtx,
              tools: loadedTools,
            });
            currentAgent = agent;

            const sessionVoice = currentMode === 'pipeline'
              ? (pipelineVoice || personaVoice || config.voice)
              : (personaVoice || config.voice);

            // Create session based on current mode (may switch from realtime → pipeline on tool call failure)
            let session: voice.AgentSession;
            if (currentMode === 'pipeline') {
              const pipelineVad = await ensurePipelineVad();
              const pipelineSessionConfig: Record<string, unknown> = {
                stt: new deepgram.STT({ model: 'nova-3', language: 'en' }),
                llm: new google.LLM({ model: 'gemini-flash-latest', apiKey: process.env.GOOGLE_API_KEY }),
                tts: new google.beta.TTS({
                  model: 'gemini-2.5-flash-preview-tts',
                  voiceName: sessionVoice ?? 'Puck',
                }),
              };
              if (pipelineVad) {
                pipelineSessionConfig.vad = pipelineVad;
              }
              session = new voice.AgentSession(
                // `vad` is loaded dynamically from an optional plugin.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pipelineSessionConfig as any,
              );
            } else {
              session = new voice.AgentSession({
                llm: new google.beta.realtime.RealtimeModel({
                  model: config.model,
                  voice: sessionVoice,
                  temperature: config.temperature,
                  instructions: sessionInstructions,
                }),
              });
            }

            // Reconnect sessions can briefly overlap while the previous one tears down.
            // Mark reconnects as non-primary to avoid "Only one AgentSession can be the primary".
            const startPayload = isFirstSession
              ? { agent, room: ctx.room }
              : ({ agent, room: ctx.room, record: false } as const);
            await session.start(startPayload);
            console.log('[agent] Session started');

            if (enableBackgroundAudio) {
              try {
                // Use short trimmed clips (1.2–1.5s, 30% volume, fade-out) instead of
                // built-in BuiltinAudioClip which loop for 3–10s and feel too long.
                const resourcesDir = join(dirname(fileURLToPath(import.meta.url)), 'resources');
                backgroundAudio = new voice.BackgroundAudioPlayer({
                  thinkingSound: [
                    { source: join(resourcesDir, 'thinking-short1.ogg'), volume: 0.4, probability: 0.6 },
                    { source: join(resourcesDir, 'thinking-short2.ogg'), volume: 0.3, probability: 0.4 },
                  ],
                });
                await backgroundAudio.start({ room: ctx.room, agentSession: session });
                console.log('[agent] Background audio player started');
              } catch (err) {
                console.warn('[agent] Background audio failed (non-fatal):', err);
                backgroundAudio = null;
              }
            }

            if (isFirstSession) {
              session.generateReply();
              console.log('[agent] Greeting generated');
              isFirstSession = false;

              // Create conversation entry immediately so it appears in dashboard
              if (resolveConversation) {
                resolveConversation(sessionId, channel, sessionStart, [], { status: 'active' })
                  .then(() => console.log('[agent] Conversation created (active)'))
                  .catch((err) => console.warn('[agent] Failed to create initial conversation:', err));
              }
            } else {
              if (suppressReconnectReply) {
                suppressReconnectReply = false;
                console.log('[agent] Reconnected with updated pipeline TTS voice');
              } else {
                // Reconnect: generate a brief "I'm back" reply so user knows the agent is alive
                session.generateReply({ instructions: 'Briefly apologize for the interruption and ask how you can continue helping. Keep it to one short sentence.' });
                console.log('[agent] Reconnect reply generated');
              }
            }

            // Wire transcription listeners for this session
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const emitter = session as any;

            emitter.on('user_input_transcribed', (ev: { transcript: string; isFinal: boolean; createdAt: number }) => {
              const transcript = (ev.transcript ?? '').replace(/<noise>/gi, '').trim();
              if (!transcript || !ev.isFinal) return;
              resetIdleTimer();
              console.log(`[agent] User said: "${transcript}"`);
              const ts = ev.createdAt ?? Date.now();
              messageBuffer.push({
                sessionId, roomName,
                participantIdentity: 'user', role: 'user',
                content: transcript, isFinal: true, createdAt: ts,
              });
              allMessages.push({ role: 'user', content: transcript, ts });

              // Blocking input guardrail check with timeout (fail-open)
              if (checkGuardrails) {
                void (async () => {
                  const result = await checkInputGuardrail(checkGuardrails, transcript, sessionId, traceId);
                  if (result && !result.allowed) {
                    const blockViolation = result.violations.find(v => v.action === 'block');
                    const blockMessage = blockViolation?.userMessage
                      || 'I\'m sorry, I can\'t help with that request.';

                    pushEvent('guardrail_violation', {
                      direction: 'input',
                      violations: result.violations,
                      content: transcript.slice(0, 200),
                      blocked: true,
                    });
                    console.warn(`[agent] Input BLOCKED: ${result.violations.length} violation(s)`);

                    // Interrupt any in-progress response and speak the block message
                    session.interrupt();
                    session.generateReply({ instructions: `Say exactly this to the user: "${blockMessage}". Do not add anything else.` });
                  } else if (result && result.violations.length > 0) {
                    pushEvent('guardrail_violation', {
                      direction: 'input',
                      violations: result.violations,
                      content: transcript.slice(0, 200),
                    });
                    console.warn(`[agent] Input guardrail triggered: ${result.violations.length} violation(s)`);
                  }
                })();
              }
            });

            emitter.on('conversation_item_added', (ev: { item: { role: string; textContent?: string; createdAt: number } }) => {
              const item = ev.item;
              if (!item || item.role !== 'assistant') return;
              // Strip control characters (e.g. <ctrl46>) that Gemini occasionally emits
              const text = (item.textContent ?? '').replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
              if (!text) return;
              const parsed = parseTtsDirectives(text);
              const cleanText = parsed.cleanText;
              if (parsed.voice && currentMode === 'pipeline' && parsed.voice !== sessionVoice) {
                pipelineVoice = parsed.voice;
                restartSessionForVoiceDirective = true;
                suppressReconnectReply = true;
                pushEvent('tts_voice_directive_detected', {
                  voice: parsed.voice,
                  directives: parsed.directives,
                });
                // Voice is configured at session creation for pipeline mode, so restart quickly.
                setTimeout(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (session as any).close?.({ reason: 'tts_voice_change' });
                }, 0);
              }
              if (!cleanText) return;
              resetIdleTimer();
              console.log(`[agent] Agent said: "${cleanText.slice(0, 80)}..."`);
              const ts = item.createdAt ?? Date.now();
              messageBuffer.push({
                sessionId, roomName,
                participantIdentity: 'agent', role: 'agent',
                content: cleanText, isFinal: true, createdAt: ts,
              });
              allMessages.push({ role: 'agent', content: cleanText, ts });

              // Async output guardrail check (warn/log only — cannot un-speak audio)
              if (checkGuardrails) {
                checkGuardrails(cleanText, 'output', sessionId, traceId).then((result) => {
                  if (result.violations.length > 0) {
                    pushEvent('guardrail_violation', {
                      direction: 'output',
                      violations: result.violations,
                      content: cleanText.slice(0, 200),
                    });
                    console.warn(`[agent] Output guardrail triggered: ${result.violations.length} violation(s)`);
                  }
                }).catch((err) => {
                  console.warn('[agent] Output guardrail check failed:', err);
                });
              }
            });

            // Wire lifecycle event listeners
            emitter.on('agent_state_changed', (ev: unknown) => {
              const stateEvent = readStateEvent(ev);
              const state = stateEvent?.state ?? 'unknown';

              // Reset idle timer on any active state (thinking, speaking, listening)
              // This prevents timeout during tool calls or model processing
              if (state !== 'idle' && state !== 'disconnected') {
                resetIdleTimer();
              }
              pushEvent('agent_state_changed', {
                state,
                ...(stateEvent?.oldState ? { oldState: stateEvent.oldState } : {}),
              });
            });

            emitter.on('user_state_changed', (ev: unknown) => {
              const stateEvent = readStateEvent(ev);
              const state = stateEvent?.state ?? 'unknown';

              if (state === 'speaking') {
                resetIdleTimer();
              }
              pushEvent('user_state_changed', {
                state,
                ...(stateEvent?.oldState ? { oldState: stateEvent.oldState } : {}),
              });
            });

            emitter.on('function_tools_executed', (ev: unknown) => {
              const toolExec = readToolExecutionEvent(ev);
              resetIdleTimer();
              pushEvent('function_tools_executed', {
                toolNames: toolExec.toolNames,
                toolCallCount: toolExec.toolCallCount,
                toolErrorCount: toolExec.toolErrorCount,
              });
            });

            emitter.on('metrics_collected', (ev: unknown) => {
              pushEvent('metrics_collected', { metrics: readMetricsEvent(ev) });
            });

            emitter.on('error', (ev: unknown) => {
              pushEvent('agent_error', readErrorEvent(ev));
            });

            // Start idle timer after session is live
            resetIdleTimer();

            // Wait for this session to close, all participants to leave, OR idle timeout
            const closeInfo = await Promise.race([
              new Promise<{ reason: string; error?: unknown }>((resolve) => {
                emitter.on('close', (info?: unknown) => {
                  resolve(readCloseEvent(info));
                });
              }),
              participantDisconnectPromise.then(() => ({
                reason: 'participant_disconnected' as string,
                error: undefined as unknown,
              })),
              idlePromise.then(() => ({
                reason: 'idle_timeout' as string,
                error: undefined as unknown,
              })),
            ]);

            lastCloseReason = closeInfo.reason;
            console.log(`[agent] Session closed (reason: ${closeInfo.reason})`);
            await safeCloseBackgroundAudio();

            if (restartSessionForVoiceDirective) {
              restartSessionForVoiceDirective = false;
              if (!hasRemoteParticipants(ctx)) {
                break;
              }
              console.log(`[agent] Restarting pipeline session with voice: ${pipelineVoice}`);
              await new Promise((r) => setTimeout(r, 200));
              continue;
            }

            // If participant disconnected or idle timeout, close the session gracefully
            if (closeInfo.reason === 'participant_disconnected' || closeInfo.reason === 'idle_timeout') {
              await safeCloseSession(session);
              break;
            }

            // Decide whether to reconnect
            if (closeInfo.reason === 'error') {
              await safeCloseSession(session);

              // Check if anyone is still in the room
              if (!hasRemoteParticipants(ctx)) {
                console.log('[agent] No remote participants left — not reconnecting');
                break;
              }

              attempt++;
              if (attempt > maxReconnects) {
                console.error(`[agent] Max reconnects (${maxReconnects}) exceeded — giving up`);
                break;
              }

              // Detect error 1008 ("Operation is not implemented, or supported, or enabled")
              // which indicates Gemini native audio rejected a function call.
              // Fall back to pipeline mode (STT + LLM + TTS) where tool calling works reliably.
              const errorCode = extractErrorCode(closeInfo.error);
              if (currentMode === 'realtime' && errorCode === 1008 && hasTools) {
                currentMode = 'pipeline';
                console.log(`[agent] Error 1008 (tool call rejected) — falling back to pipeline mode`);
              }

              console.log(`[agent] Reconnecting in ${reconnectDelayMs}ms (attempt ${attempt}/${maxReconnects}, mode: ${currentMode})...`);
              await new Promise((r) => setTimeout(r, reconnectDelayMs));
              continue;
            }

            // Normal close (user left, room ended, etc.) — exit loop
            break;
          }
        } finally {
          await safeCloseBackgroundAudio();

          // Cleanup: stop timers and prevent future syncs from firing
          conversationResolved = true;
          if (idleTimer) clearTimeout(idleTimer);
          clearInterval(flushTimer);
          clearInterval(syncTimer);

          // Wait for any in-flight sync to finish before final resolution
          if (syncState.promise) {
            await syncState.promise.catch(() => {});
          }

          pushEvent('session_ended', {
            reason: lastCloseReason,
            totalMessages: allMessages.length,
            reconnectAttempts: attempt,
            durationMs: Date.now() - sessionStart,
          });

          await flushAll();
          console.log(`[agent] Cleanup for ${roomName}: flushed ${allMessages.length} total messages`);

          if (resolveConversation) {
            const { status, resolution } = mapCloseReasonToResolution(lastCloseReason);
            try {
              await resolveConversation(sessionId, channel, sessionStart, allMessages, { status, resolution });
              console.log(`[agent] Conversation resolved: ${resolution}`);
            } catch (err) {
              console.error('[agent] Failed to resolve conversation:', err);
            }
          }
        }
      } catch (err) {
        console.error(`[agent] FATAL error in entry() for room ${roomName}:`, err);
        throw err;
      }
    },
  });
}

/**
 * Create an agent definition from a LiveKitAgentConfig.
 */
export function createAgentFromConfig(agentConfig: LiveKitAgentConfig) {
  return createAgentDefinition({
    model: agentConfig.model,
    voice: agentConfig.voice,
    instructions: agentConfig.instructions,
    temperature: agentConfig.temperature,
    enableBackgroundAudio: agentConfig.enableBackgroundAudio,
  });
}
