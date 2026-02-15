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
} from './types';
import { convertTools } from './tools-bridge';
import { createCallbacksBridge } from './callbacks';

type Listener = (...args: unknown[]) => void;

/** Dynamically import pi-ai and register providers. */
async function loadPiAi() {
  const piAi = await import('@mariozechner/pi-ai');
  piAi.registerBuiltInApiProviders();
  return piAi;
}

let _piAvailable: boolean | null = null;

export class PiRuntimeAdapter {
  isAvailable(): boolean {
    if (_piAvailable !== null) return _piAvailable;
    try {
      const path = require('path');
      const fs = require('fs');
      const candidates = [
        path.join(process.cwd(), 'node_modules', '@mariozechner', 'pi-coding-agent'),
        path.join(__dirname, '..', '..', 'node_modules', '@mariozechner', 'pi-coding-agent'),
        path.join(__dirname, '..', '..', '..', '..', 'node_modules', '@mariozechner', 'pi-coding-agent'),
      ];
      _piAvailable = candidates.some((p: string) => {
        try { return fs.existsSync(path.join(p, 'package.json')); } catch { return false; }
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

    const { createAgentSession, SessionManager, codingTools } =
      await import('@mariozechner/pi-coding-agent');
    const piAi = await loadPiAi();

    const sessionId = `pi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let state: AgentState = 'initializing';
    const listeners = new Map<AgentEventType, Set<Listener>>();

    const emit = (event: AgentEventType, ...args: unknown[]) => {
      listeners.get(event)?.forEach((fn) => fn(...args));
    };

    // Resolve model
    const provider = config.provider ?? 'google';
    const modelId = config.model ?? 'gemini-3-flash-preview';
    let model: any;
    try {
      model = piAi.getModel(provider as any, modelId);
    } catch {
      throw new Error(
        `Cannot resolve model "${modelId}" for provider "${provider}". ` +
        `Available providers: ${(piAi.getProviders() as string[]).join(', ')}`,
      );
    }

    // Prepare custom tools
    let customTools: any[] | undefined;
    if (config.tools && config.tools !== 'riyaan' && Array.isArray(config.tools)) {
      customTools = convertTools(config.tools) as any[];
    }

    // Platform callbacks bridge
    const bridge = config.callbacks
      ? createCallbacksBridge(config.callbacks, sessionId)
      : null;

    const startedAt = Date.now();

    // Create Pi agent session
    const { session } = await createAgentSession({
      model,
      thinkingLevel: config.piOptions?.thinkingLevel ?? 'high',
      tools: codingTools,
      customTools,
      cwd: config.cwd ?? process.cwd(),
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
        case 'tool_execution_end':
          emit('tool_result', { tool: event.toolName, output: event.output });
          break;
      }
    });

    state = 'idle';
    emit('state_change', state);

    if (bridge) {
      await bridge.emitEvent('agent_started', { provider, model: modelId });
    }

    const handle: AgentHandle = {
      sessionId,

      async prompt(text: string): Promise<string> {
        state = 'processing';
        emit('state_change', state);

        try {
          if (bridge) {
            const check = await bridge.checkGuardrails(text, 'input');
            if (!check.allowed) {
              state = 'idle';
              emit('state_change', state);
              return check.violations[0]?.userMessage ?? 'Input blocked by guardrail policy.';
            }
          }

          await session.prompt(text);

          // Extract response from session state
          const messages = session.state.messages;
          let response = '';
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'assistant' && msg.content) {
              if (typeof msg.content === 'string') {
                response = msg.content;
              } else if (Array.isArray(msg.content)) {
                response = msg.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('');
              }
              break;
            }
          }

          if (bridge) {
            const check = await bridge.checkGuardrails(response, 'output');
            if (!check.allowed) {
              state = 'idle';
              emit('state_change', state);
              return 'Response blocked by guardrail policy.';
            }
          }

          state = 'idle';
          emit('state_change', state);
          return response;
        } catch (err) {
          state = 'error';
          emit('state_change', state);
          emit('error', err);
          throw err;
        }
      },

      getState(): AgentState {
        return state;
      },

      async close(): Promise<void> {
        if (bridge) {
          const messages = session.state.messages;
          const transcript = messages
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => {
              const content = typeof m.content === 'string'
                ? m.content
                : Array.isArray(m.content)
                  ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
                  : '';
              return { role: m.role as string, content, ts: Date.now() };
            });

          await bridge.persistMessages(transcript, sessionId);
          await bridge.resolveConversation('terminal', startedAt);
          await bridge.emitEvent('agent_closed');
        }

        session.dispose();
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
