import {
  type JobContext,
  defineAgent,
  voice,
  type llm,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { RoomServiceClient } from 'livekit-server-sdk';
import type { LiveKitAgentConfig } from '../types';
import crypto from 'node:crypto';
import type { AgentCallbacks, AgentEvent, BufferedMessage, GuardrailResult } from './callbacks';
import { createConvexAgentCallbacks } from './callbacks';
import { createToolsFromConvex } from './tools.js';

const GUARDRAIL_TIMEOUT_MS = 3000;

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
    default:
      return { status: 'resolved', resolution: reason === 'unknown' ? 'completed' : reason };
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
        const traceId = crypto.randomUUID();
        console.log(`[agent] Connected to room: ${roomName} (traceId: ${traceId})`);

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

        const [baseInstructions, toolsResult] = await Promise.all([personaPromise, toolsPromise]);
        const { tools: loadedTools, confirmationRequired } = toolsResult;

        // Append tool-acknowledgment instructions when tools are loaded
        const hasTools = Object.keys(loadedTools).length > 0;
        let instructions = hasTools
          ? baseInstructions + ' When you need to use a tool or look something up, always briefly tell the user what you are about to do before executing (e.g. "Let me check that for you", "One moment while I look that up"). Never go silent while waiting for a tool result.'
          : baseInstructions;

        if (confirmationRequired.length > 0) {
          instructions += ` IMPORTANT: The following tools require explicit user confirmation before execution: [${confirmationRequired.join(', ')}]. For these tools, you MUST describe what you are about to do and ask the user to confirm (e.g. "I'm about to cancel your appointment. Should I go ahead?"). Only execute the tool after the user clearly confirms. If they decline, do not execute.`;
          console.log(`[agent] Tools requiring confirmation: ${confirmationRequired.join(', ')}`);
        }

        console.log(`[agent] Instructions loaded (${instructions.length} chars, starts with: "${instructions.slice(0, 60)}...")`);
        console.log(`[agent] Tools loaded: ${Object.keys(loadedTools).join(', ') || '(none)'}`);

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
        const syncConversation = async () => {
          if (!resolveConversation || conversationResolved) return;
          if (allMessages.length === lastSyncedMessageCount) return;
          lastSyncedMessageCount = allMessages.length;
          try {
            await resolveConversation(sessionId, channel, sessionStart, allMessages, { status: 'active' });
          } catch (err) {
            console.warn('[agent] Failed to sync conversation:', err);
          }
        };

        const flushTimer = setInterval(flushAll, 2000);
        const syncTimer = setInterval(syncConversation, 5000);

        // Reusable agent config (stateless, can be reused across sessions)
        const agent = new voice.Agent({
          instructions,
          tools: loadedTools,
        });

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
                thinkingConfig: {
                  thinkingBudget: 1024,
                },
              }),
            });

            await session.start({ agent, room: ctx.room });
            console.log('[agent] Session started');

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

              // Async output guardrail check (warn/log only — cannot un-speak audio)
              if (checkGuardrails) {
                checkGuardrails(text, 'output', sessionId, traceId).then((result) => {
                  if (result.violations.length > 0) {
                    pushEvent('guardrail_violation', {
                      direction: 'output',
                      violations: result.violations,
                      content: text.slice(0, 200),
                    });
                    console.warn(`[agent] Output guardrail triggered: ${result.violations.length} violation(s)`);
                  }
                }).catch((err) => {
                  console.warn('[agent] Output guardrail check failed:', err);
                });
              }
            });

            // Wire lifecycle event listeners
            emitter.on('agent_state_changed', (state: string) => {
              pushEvent('agent_state_changed', { state });
            });

            emitter.on('user_state_changed', (state: string) => {
              pushEvent('user_state_changed', { state });
            });

            emitter.on('function_tools_executed', (ev: { toolNames?: string[] }) => {
              pushEvent('function_tools_executed', { toolNames: ev.toolNames ?? [] });
            });

            emitter.on('metrics_collected', (metrics: Record<string, unknown>) => {
              pushEvent('metrics_collected', { metrics });
            });

            emitter.on('error', (ev: { message?: string; recoverable?: boolean }) => {
              pushEvent('agent_error', {
                message: ev.message ?? 'unknown error',
                recoverable: ev.recoverable ?? false,
              });
            });

            // Wait for this session to close OR for all participants to leave
            const closeInfo = await Promise.race([
              new Promise<{ reason: string; error?: unknown }>((resolve) => {
                emitter.on('close', (info?: { reason?: string; error?: unknown }) => {
                  resolve({
                    reason: info?.reason ?? 'unknown',
                    error: info?.error,
                  });
                });
              }),
              participantDisconnectPromise.then(() => ({
                reason: 'participant_disconnected' as string,
                error: undefined as unknown,
              })),
            ]);

            lastCloseReason = closeInfo.reason;
            console.log(`[agent] Session closed (reason: ${closeInfo.reason})`);

            // If participant disconnected, try to close the session gracefully
            if (closeInfo.reason === 'participant_disconnected') {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (session as any).close?.();
              } catch { /* session might already be closed */ }
              break;
            }

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
          // Cleanup: stop flush timer, emit final event, flush everything, resolve conversation
          clearInterval(flushTimer);
          clearInterval(syncTimer);

          pushEvent('session_ended', {
            reason: lastCloseReason,
            totalMessages: allMessages.length,
            reconnectAttempts: attempt,
            durationMs: Date.now() - sessionStart,
          });

          await flushAll();
          console.log(`[agent] Cleanup for ${roomName}: flushed ${allMessages.length} total messages`);

          if (resolveConversation && !conversationResolved) {
            conversationResolved = true;
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
  });
}
