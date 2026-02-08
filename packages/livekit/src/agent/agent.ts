import {
  type JobContext,
  defineAgent,
  voice,
  type llm,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import type { LiveKitAgentConfig } from '../types';
import type { AgentCallbacks, BufferedMessage } from './callbacks';
import { createConvexAgentCallbacks } from './callbacks';
import { createToolsFromConvex } from './tools.js';

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
    instructions: options?.instructions ?? 'You are a helpful voice AI assistant.',
    temperature: options?.temperature ?? 0.8,
  };

  const maxReconnects = options?.maxReconnects ?? 5;
  const reconnectDelayMs = options?.reconnectDelayMs ?? 2000;

  return defineAgent({
    entry: async (ctx: JobContext) => {
      let roomName = 'unknown';
      console.log('[agent] Job received, connecting to room...');

      try {
        // Validate GOOGLE_API_KEY before doing anything else
        if (!process.env.GOOGLE_API_KEY) {
          throw new Error('GOOGLE_API_KEY env var is not set — cannot create Gemini RealtimeModel');
        }

        await ctx.connect();

        // Room name is only available after connect()
        roomName = ctx.room.name ?? 'unknown';
        console.log(`[agent] Connected to room: ${roomName}`);

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
            callbacks = createConvexAgentCallbacks({ convexUrl, appSlug: roomAppSlug, appSecret });
            console.log(`[agent] Created Convex callbacks for app: ${roomAppSlug}`);
          } else {
            console.warn('[agent] No callbacks configured — missing CONVEX_URL, APP_SLUG, or APP_SECRET');
          }
        }

        // Load persona and tools in parallel with waiting for participant
        const personaPromise = (async (): Promise<string> => {
          if (!callbacks?.loadPersona) return config.instructions;
          try {
            const persona = await callbacks.loadPersona();
            if (persona) {
              const base = persona.systemPrompt || config.instructions;
              const parts: string[] = [base];
              if (persona.personaName) parts.push(`Your name is ${persona.personaName}.`);
              if (persona.personaTone) parts.push(`Speak in a ${persona.personaTone} tone.`);
              if (persona.preferredTerms) parts.push(`Preferred terms: ${persona.preferredTerms}.`);
              if (persona.blockedTerms) parts.push(`Never use these terms: ${persona.blockedTerms}.`);
              return parts.join(' ');
            }
          } catch (err) {
            console.warn('[agent] Failed to load persona, using default instructions:', err);
          }
          return config.instructions;
        })();

        // Load tools from Convex (runs in parallel with persona and waitForParticipant)
        const toolsPromise = (async (): Promise<llm.ToolContext> => {
          if (!convexUrl || !roomAppSlug || !appSecret) {
            console.warn('[agent] Skipping tool loading — missing Convex env vars');
            return options?.tools ?? {};
          }
          try {
            const convexTools = await createToolsFromConvex({
              convexUrl,
              appSlug: roomAppSlug,
              appSecret,
              sessionId: roomSessionId,
            });
            const toolCount = Object.keys(convexTools).length;
            console.log(`[agent] Loaded ${toolCount} tools from Convex for app: ${roomAppSlug}`);
            // Merge: options?.tools take precedence over Convex tools
            return { ...convexTools, ...(options?.tools ?? {}) };
          } catch (err) {
            console.warn('[agent] Failed to load tools from Convex, using defaults:', err);
            return options?.tools ?? {};
          }
        })();

        // Wait for a real participant (browser user or SIP callee) to join
        console.log('[agent] Waiting for participant...');
        const participant = await ctx.waitForParticipant();
        console.log(`[agent] Participant joined: ${participant.identity}`);

        // Detect SIP/PSTN participants for channel tagging
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isSipParticipant = (participant as any).kind === 3
          || participant.identity?.startsWith('sip_');
        const channel = isSipParticipant ? 'voice-sip' : 'voice-webrtc';

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

        const [instructions, loadedTools] = await Promise.all([personaPromise, toolsPromise]);
        console.log(`[agent] Instructions loaded (${instructions.length} chars, starts with: "${instructions.slice(0, 60)}...")`);
        console.log(`[agent] Tools loaded: ${Object.keys(loadedTools).join(', ') || '(none)'}`);

        // --- Shared state across reconnect sessions ---
        const sessionId = roomSessionId;
        const messageBuffer: BufferedMessage[] = [];
        const allMessages: Array<{ role: string; content: string; ts: number }> = [];
        const sessionStart = Date.now();
        const persistMessages = callbacks?.persistMessages;
        const resolveConversation = callbacks?.resolveConversation;

        // Flush timer runs across all sessions
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
        const flushTimer = setInterval(flushMessages, 2000);

        // Reusable agent config (stateless, can be reused across sessions)
        const agent = new voice.Agent({
          instructions,
          tools: loadedTools,
        });

        // --- Session loop with auto-reconnect ---
        let attempt = 0;
        let isFirstSession = true;

        try {
          while (attempt <= maxReconnects) {
            console.log(`[agent] Creating agent session (model: ${config.model}, attempt: ${attempt}/${maxReconnects})`);

            const session = new voice.AgentSession({
              llm: new google.beta.realtime.RealtimeModel({
                model: config.model,
                voice: config.voice,
                temperature: config.temperature,
                instructions,
              }),
            });

            await session.start({ agent, room: ctx.room });
            console.log('[agent] Session started');

            if (isFirstSession) {
              session.generateReply();
              console.log('[agent] Greeting generated');
              isFirstSession = false;
            }

            // Wire transcription listeners for this session
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const emitter = session as any;

            emitter.on('user_input_transcribed', (ev: { transcript: string; isFinal: boolean; createdAt: number }) => {
              const transcript = (ev.transcript ?? '').replace(/<noise>/gi, '').trim();
              if (!transcript || !ev.isFinal) return;
              console.log(`[agent] User said: "${transcript}"`);
              const ts = ev.createdAt ?? Date.now();
              messageBuffer.push({
                sessionId, roomName,
                participantIdentity: 'user', role: 'user',
                content: transcript, isFinal: true, createdAt: ts,
              });
              allMessages.push({ role: 'user', content: transcript, ts });
            });

            emitter.on('conversation_item_added', (ev: { item: { role: string; textContent?: string; createdAt: number } }) => {
              const item = ev.item;
              if (!item || item.role !== 'assistant') return;
              const text = item.textContent;
              if (!text) return;
              console.log(`[agent] Agent said: "${text.slice(0, 80)}..."`);
              const ts = item.createdAt ?? Date.now();
              messageBuffer.push({
                sessionId, roomName,
                participantIdentity: 'agent', role: 'agent',
                content: text, isFinal: true, createdAt: ts,
              });
              allMessages.push({ role: 'agent', content: text, ts });
            });

            // Wait for this session to close and capture the reason
            const closeInfo = await new Promise<{ reason: string; error?: unknown }>((resolve) => {
              emitter.on('close', (info?: { reason?: string; error?: unknown }) => {
                resolve({
                  reason: info?.reason ?? 'unknown',
                  error: info?.error,
                });
              });
            });

            console.log(`[agent] Session closed (reason: ${closeInfo.reason})`);

            // Decide whether to reconnect
            if (closeInfo.reason === 'error') {
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

              console.log(`[agent] Gemini error, reconnecting in ${reconnectDelayMs}ms (attempt ${attempt}/${maxReconnects})...`);
              await new Promise((r) => setTimeout(r, reconnectDelayMs));
              continue;
            }

            // Normal close (user left, room ended, etc.) — exit loop
            break;
          }
        } finally {
          // Cleanup: stop flush timer, flush remaining, resolve conversation
          clearInterval(flushTimer);
          await flushMessages();

          console.log(`[agent] Cleanup for ${roomName}: flushed ${allMessages.length} total messages`);

          if (resolveConversation) {
            try {
              await resolveConversation(sessionId, channel, sessionStart, allMessages);
              console.log(`[agent] Conversation resolved for session ${sessionId}`);
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
  });
}
