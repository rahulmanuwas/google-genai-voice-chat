/**
 * Agent lifecycle callbacks for backend integration.
 *
 * Provides a backend-agnostic interface so the LiveKit agent can load
 * persona config, persist transcription messages, and resolve
 * conversations without hard-coding Convex (or any other backend).
 */

/** Persona data returned by the backend */
export interface AgentPersonaData {
  /** Full system prompt / instructions from the app config */
  systemPrompt?: string;
  personaName?: string;
  personaTone?: string;
  personaGreeting?: string;
  preferredTerms?: string;
  blockedTerms?: string;
}

/** A lifecycle event emitted by the agent (state changes, errors, metrics, etc.) */
export interface AgentEvent {
  eventType: string;
  ts: number;
  /** JSON-stringified payload */
  data?: string;
}

/** A single transcription message to persist */
export interface BufferedMessage {
  sessionId: string;
  roomName: string;
  participantIdentity: string;
  role: string;
  content: string;
  isFinal: boolean;
  createdAt: number;
}

/** Backend-agnostic callbacks for the voice agent lifecycle */
export interface AgentCallbacks {
  /** Load persona/brand-voice config at session start */
  loadPersona?: () => Promise<AgentPersonaData | null>;

  /** Persist a batch of transcription messages */
  persistMessages?: (messages: BufferedMessage[]) => Promise<void>;

  /** Mark the conversation as resolved when the session ends */
  resolveConversation?: (
    sessionId: string,
    channel: string,
    startedAt: number,
    messages?: Array<{ role: string; content: string; ts: number }>,
    options?: { status?: string; resolution?: string },
  ) => Promise<void>;

  /** Emit lifecycle events (agent state, errors, metrics, tool calls) */
  emitEvents?: (sessionId: string, events: AgentEvent[]) => Promise<void>;
}

/** Config for the built-in Convex callbacks factory */
export interface ConvexAgentConfig {
  /** Convex deployment URL (e.g. https://my-app.convex.cloud) */
  convexUrl: string;
  /** App slug for authentication */
  appSlug: string;
  /** App secret for server-to-server authentication */
  appSecret: string;
}

/**
 * Create AgentCallbacks backed by a Convex deployment.
 * This is the default backend integration — pass the result to
 * `createAgentDefinition({ callbacks })`.
 */
export function createConvexAgentCallbacks(config: ConvexAgentConfig): AgentCallbacks {
  const { convexUrl, appSlug, appSecret } = config;

  return {
    async loadPersona(): Promise<AgentPersonaData | null> {
      try {
        const res = await fetch(
          `${convexUrl}/api/persona?appSlug=${encodeURIComponent(appSlug)}&appSecret=${encodeURIComponent(appSecret)}`,
        );
        if (!res.ok) return null;
        const persona = await res.json();
        if (persona.systemPrompt || persona.personaName || persona.personaTone || persona.personaGreeting) {
          return persona as AgentPersonaData;
        }
        return null;
      } catch {
        return null;
      }
    },

    async persistMessages(messages: BufferedMessage[]): Promise<void> {
      const res = await fetch(`${convexUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug, appSecret, messages }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`persistMessages failed (${res.status}): ${text}`);
      }
    },

    async resolveConversation(
      sessionId: string,
      channel: string,
      startedAt: number,
      messages?: Array<{ role: string; content: string; ts: number }>,
      options?: { status?: string; resolution?: string },
    ): Promise<void> {
      const res = await fetch(`${convexUrl}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSlug,
          appSecret,
          sessionId,
          startedAt,
          messages: messages ?? [],
          status: options?.status ?? 'resolved',
          channel,
          ...(options?.resolution !== undefined && { resolution: options.resolution }),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`resolveConversation failed (${res.status}): ${text}`);
      }
    },

    async emitEvents(sessionId: string, events: AgentEvent[]): Promise<void> {
      if (events.length === 0) return;
      const res = await fetch(`${convexUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug, appSecret, sessionId, events }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`emitEvents failed (${res.status}): ${text}`);
      }
    },
  };
}
