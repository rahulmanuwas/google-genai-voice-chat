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

/**
 * Create a LiveKit agent definition using Gemini Live API (speech-to-speech).
 * Uses google.beta.realtime.RealtimeModel for low-latency voice conversations.
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

  return defineAgent({
    entry: async (ctx: JobContext) => {
      await ctx.connect();

      // Resolve callbacks: use provided callbacks, or auto-create from env vars.
      // Parse appSlug from room name so the agent uses the correct app for each room
      // (e.g. "demo-dentist" vs "demo") instead of always using the env APP_SLUG.
      let callbacks = options?.callbacks;
      if (!callbacks) {
        const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
        const envAppSlug = process.env.APP_SLUG ?? process.env.NEXT_PUBLIC_APP_SLUG;
        const appSecret = process.env.APP_SECRET;
        if (convexUrl && envAppSlug && appSecret) {
          const roomName = ctx.room.name ?? '';
          const { appSlug: roomAppSlug } = parseRoomName(roomName, envAppSlug);
          callbacks = createConvexAgentCallbacks({ convexUrl, appSlug: roomAppSlug, appSecret });
        }
      }

      // Start persona loading in parallel with waiting for participant.
      // For SIP/PSTN calls the wait can be 5-10s (ring time), so loading
      // the persona concurrently eliminates that latency.
      const personaPromise = (async (): Promise<string> => {
        if (!callbacks?.loadPersona) return config.instructions;
        try {
          const persona = await callbacks.loadPersona();
          if (persona) {
            // Use the backend's systemPrompt as base if available, otherwise fall back to config
            const base = persona.systemPrompt || config.instructions;
            const parts: string[] = [base];
            if (persona.personaName) parts.push(`Your name is ${persona.personaName}.`);
            if (persona.personaTone) parts.push(`Speak in a ${persona.personaTone} tone.`);
            if (persona.preferredTerms) parts.push(`Preferred terms: ${persona.preferredTerms}.`);
            if (persona.blockedTerms) parts.push(`Never use these terms: ${persona.blockedTerms}.`);
            return parts.join(' ');
          }
        } catch {
          // Non-fatal — continue without persona
        }
        return config.instructions;
      })();

      // Wait for a real participant (browser user or SIP callee) to join
      const participant = await ctx.waitForParticipant();

      // Detect SIP/PSTN participants for channel tagging
      // ParticipantKind.SIP = 3 in @livekit/rtc-node
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isSipParticipant = (participant as any).kind === 3
        || participant.identity?.startsWith('sip_');
      const channel = isSipParticipant ? 'voice-sip' : 'voice-webrtc';

      // For SIP/PSTN calls, the SIP participant joins the room as soon as the
      // call is *placed* (ringing), not when the callee *answers*. The audio
      // track is only published once the call connects. Wait for it so the
      // agent doesn't greet an unanswered phone.
      // For browser users this resolves near-instantly (mic already publishing).
      if (participant.trackPublications.size === 0) {
        await new Promise<void>((resolve) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const onTrack = (..._args: any[]) => {
            ctx.room.off('trackPublished', onTrack);
            resolve();
          };
          ctx.room.on('trackPublished', onTrack);
        });
      }

      // Persona should be loaded by now (fetched during the wait above)
      const instructions = await personaPromise;

      const agent = new voice.Agent({
        instructions,
        tools: options?.tools,
      });

      const session = new voice.AgentSession({
        llm: new google.beta.realtime.RealtimeModel({
          model: config.model,
          voice: config.voice,
          temperature: config.temperature,
          instructions,
        }),
      });

      await session.start({ agent, room: ctx.room });

      // Greet the user
      session.generateReply();

      // Set up transcription storage and keep entry alive until session closes.
      // We must await the close cleanup here — if entry() returns early, the
      // LiveKit framework may terminate the job before async cleanup finishes.
      if (callbacks?.persistMessages) {
        const envSlug = process.env.APP_SLUG ?? process.env.NEXT_PUBLIC_APP_SLUG ?? '';
        const roomName = ctx.room.name ?? '';
        const { sessionId } = parseRoomName(roomName, envSlug);
        const messageBuffer: BufferedMessage[] = [];
        // Keep a full transcript log for resolveConversation (separate from flush buffer)
        const allMessages: Array<{ role: string; content: string; ts: number }> = [];
        const sessionStart = Date.now();
        let flushTimer: ReturnType<typeof setInterval> | null = null;

        // Capture callback refs for use in closures
        const persistMessages = callbacks.persistMessages;
        const resolveConversation = callbacks.resolveConversation;

        const flushMessages = async () => {
          if (messageBuffer.length === 0) return;
          const batch = messageBuffer.splice(0);
          try {
            await persistMessages(batch);
          } catch (err) {
            console.warn('[agent] Failed to persist messages, re-queuing:', err);
            messageBuffer.unshift(...batch);
          }
        };

        // Flush every 2 seconds
        flushTimer = setInterval(flushMessages, 2000);

        // Use the emitter with string event names (enum values resolve to these strings)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emitter = session as any;

        // Capture user speech transcriptions
        emitter.on('user_input_transcribed', (ev: { transcript: string; isFinal: boolean; createdAt: number }) => {
          // Strip <noise> tags from Gemini transcription (common with telephony audio)
          const transcript = (ev.transcript ?? '').replace(/<noise>/gi, '').trim();
          if (!transcript || !ev.isFinal) return;
          console.log(`[agent] User said: "${transcript}"`);
          const ts = ev.createdAt ?? Date.now();
          messageBuffer.push({
            sessionId,
            roomName,
            participantIdentity: 'user',
            role: 'user',
            content: transcript,
            isFinal: true,
            createdAt: ts,
          });
          allMessages.push({ role: 'user', content: transcript, ts });
        });

        // Capture agent responses
        emitter.on('conversation_item_added', (ev: { item: { role: string; textContent?: string; createdAt: number } }) => {
          const item = ev.item;
          if (!item || item.role !== 'assistant') return;
          const text = item.textContent;
          if (!text) return;
          console.log(`[agent] Agent said: "${text.slice(0, 80)}..."`);
          const ts = item.createdAt ?? Date.now();
          messageBuffer.push({
            sessionId,
            roomName,
            participantIdentity: 'agent',
            role: 'agent',
            content: text,
            isFinal: true,
            createdAt: ts,
          });
          allMessages.push({ role: 'agent', content: text, ts });
        });

        // Await session close so entry() stays alive for the full cleanup
        await new Promise<void>((resolve) => {
          emitter.on('close', async () => {
            console.log(`[agent] Session closed for ${roomName}, flushing ${messageBuffer.length} buffered + ${allMessages.length} total messages`);
            if (flushTimer) {
              clearInterval(flushTimer);
              flushTimer = null;
            }
            await flushMessages();

            // Update conversation status to resolved, include full transcript
            if (resolveConversation) {
              try {
                await resolveConversation(sessionId, channel, sessionStart, allMessages);
                console.log(`[agent] Conversation resolved for session ${sessionId}`);
              } catch (err) {
                console.error('[agent] Failed to resolve conversation:', err);
              }
            }
            resolve();
          });
        });
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
