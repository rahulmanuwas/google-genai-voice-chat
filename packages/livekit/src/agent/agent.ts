import {
  type JobContext,
  defineAgent,
  voice,
  type llm,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import type { LiveKitAgentConfig } from '@genai-voice/core';

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
  /** Convex HTTP URL for storing transcriptions (defaults to CONVEX_URL env) */
  convexUrl?: string;
  /** App slug for Convex auth (defaults to APP_SLUG env) */
  appSlug?: string;
  /** App secret for Convex auth (defaults to APP_SECRET env) */
  appSecret?: string;
}

interface BufferedMessage {
  sessionId: string;
  roomName: string;
  participantIdentity: string;
  role: string;
  content: string;
  isFinal: boolean;
  createdAt: number;
}

/**
 * Parse sessionId from room name (format: {appSlug}-{sessionId}-{timestamp}).
 * The sessionId itself may contain hyphens, so we drop the first and last segments.
 */
function parseSessionIdFromRoom(roomName: string, appSlug: string): string {
  const withoutPrefix = roomName.startsWith(appSlug + '-')
    ? roomName.slice(appSlug.length + 1)
    : roomName;
  const lastDash = withoutPrefix.lastIndexOf('-');
  return lastDash > 0 ? withoutPrefix.slice(0, lastDash) : withoutPrefix;
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

      // Resolve Convex credentials early so persona can load in parallel
      const convexUrl = options?.convexUrl ?? process.env.CONVEX_URL;
      const appSlug = options?.appSlug ?? process.env.APP_SLUG;
      const appSecret = options?.appSecret ?? process.env.APP_SECRET;
      const enableTranscriptionStorage = !!(convexUrl && appSlug && appSecret);

      // Start persona loading in parallel with waiting for participant.
      // For SIP/PSTN calls the wait can be 5-10s (ring time), so loading
      // the persona concurrently eliminates that latency.
      const personaPromise = (async (): Promise<string> => {
        if (!enableTranscriptionStorage) return config.instructions;
        try {
          const personaRes = await fetch(
            `${convexUrl}/api/persona?appSlug=${encodeURIComponent(appSlug!)}&appSecret=${encodeURIComponent(appSecret!)}`
          );
          if (personaRes.ok) {
            const persona = await personaRes.json();
            if (persona.personaName || persona.personaTone || persona.personaGreeting) {
              const parts: string[] = [config.instructions];
              if (persona.personaName) parts.push(`Your name is ${persona.personaName}.`);
              if (persona.personaTone) parts.push(`Speak in a ${persona.personaTone} tone.`);
              if (persona.preferredTerms) parts.push(`Preferred terms: ${persona.preferredTerms}.`);
              if (persona.blockedTerms) parts.push(`Never use these terms: ${persona.blockedTerms}.`);
              return parts.join(' ');
            }
          }
        } catch {
          // Non-fatal — continue without persona
        }
        return config.instructions;
      })();

      // Wait for a real participant (browser user or SIP callee) to join
      const participant = await ctx.waitForParticipant();

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

      // Set up transcription storage
      if (enableTranscriptionStorage) {
        const roomName = ctx.room.name ?? '';
        const sessionId = parseSessionIdFromRoom(roomName, appSlug);
        const messageBuffer: BufferedMessage[] = [];
        let flushTimer: ReturnType<typeof setInterval> | null = null;

        const flushMessages = async () => {
          if (messageBuffer.length === 0) return;
          const batch = messageBuffer.splice(0);
          try {
            await fetch(`${convexUrl}/api/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appSlug,
                appSecret,
                messages: batch,
              }),
            });
          } catch {
            // Re-queue on failure
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
          messageBuffer.push({
            sessionId,
            roomName,
            participantIdentity: 'user',
            role: 'user',
            content: transcript,
            isFinal: true,
            createdAt: ev.createdAt ?? Date.now(),
          });
        });

        // Capture agent responses
        emitter.on('conversation_item_added', (ev: { item: { role: string; textContent?: string; createdAt: number } }) => {
          const item = ev.item;
          if (!item || item.role !== 'assistant') return;
          const text = item.textContent;
          if (!text) return;
          messageBuffer.push({
            sessionId,
            roomName,
            participantIdentity: 'agent',
            role: 'agent',
            content: text,
            isFinal: true,
            createdAt: item.createdAt ?? Date.now(),
          });
        });

        // On session close, flush remaining and update conversation
        emitter.on('close', async () => {
          if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
          }
          await flushMessages();

          // Update conversation status to resolved
          try {
            await fetch(`${convexUrl}/api/conversations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appSlug,
                appSecret,
                sessionId,
                startedAt: Date.now(),
                messages: [],
                status: 'resolved',
                channel: 'voice-livekit',
              }),
            });
          } catch {
            // Best-effort
          }
        });
      }

      // Greet the user
      session.generateReply();
    },
  });
}

/**
 * Create an agent definition from a LiveKitAgentConfig (from @genai-voice/core).
 */
export function createAgentFromConfig(agentConfig: LiveKitAgentConfig) {
  return createAgentDefinition({
    model: agentConfig.model,
    voice: agentConfig.voice,
    instructions: agentConfig.instructions,
    temperature: agentConfig.temperature,
    convexUrl: agentConfig.convexUrl,
    appSlug: agentConfig.appSlug,
    appSecret: agentConfig.appSecret,
  });
}
