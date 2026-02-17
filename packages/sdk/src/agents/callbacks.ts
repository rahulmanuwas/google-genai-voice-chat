/**
 * Maps agent events to Riyaan AgentCallbacks for platform integration.
 *
 * The Pi runtime adapter calls these bridge functions to ensure guardrails,
 * persistence, and tracing work uniformly.
 */

import type {
  AgentCallbacks,
  AgentEvent,
  GuardrailResult,
  AgentRunRecord,
} from '../agent/callbacks';

/**
 * Wrap platform callbacks to automatically include session metadata.
 */
export function createCallbacksBridge(
  callbacks: AgentCallbacks,
  sessionId: string,
) {
  return {
    /** Check guardrails */
    async checkGuardrails(
      content: string,
      direction: 'input' | 'output',
    ): Promise<GuardrailResult> {
      if (!callbacks.checkGuardrails) {
        return { allowed: true, violations: [] };
      }
      return callbacks.checkGuardrails(content, direction, sessionId);
    },

    /** Emit events with metadata */
    async emitEvent(eventType: string, data?: Record<string, unknown>): Promise<void> {
      if (!callbacks.emitEvents) return;

      const event: AgentEvent = {
        eventType,
        ts: Date.now(),
        data: JSON.stringify({ ...data, runtime: 'pi' }),
      };
      await callbacks.emitEvents(sessionId, [event]);
    },

    /** Persist messages through the platform */
    async persistMessages(
      messages: Array<{ role: string; content: string; ts: number }>,
      roomName: string,
    ): Promise<void> {
      if (!callbacks.persistMessages) return;

      await callbacks.persistMessages(
        messages.map((m) => ({
          sessionId,
          roomName,
          participantIdentity: m.role === 'user' ? 'user' : 'agent-pi',
          role: m.role,
          content: m.content,
          isFinal: true,
          createdAt: m.ts,
        })),
      );
    },

    /** Resolve the conversation when the agent session ends */
    async resolveConversation(
      channel: string,
      startedAt: number,
      messages?: Array<{ role: string; content: string; ts: number }>,
    ): Promise<void> {
      if (!callbacks.resolveConversation) return;

      await callbacks.resolveConversation(sessionId, channel, startedAt, messages);
    },

    /** Persist run metadata when available */
    async persistAgentRun(run: AgentRunRecord): Promise<void> {
      if (!callbacks.persistAgentRun) return;
      await callbacks.persistAgentRun(sessionId, run);
    },
  };
}
