import { ServerOptions, cli } from '@livekit/agents';
import { fileURLToPath } from 'node:url';
import { createAgentDefinition } from './agent.js';

export { createAgentDefinition, createAgentFromConfig } from './agent.js';
export { createToolsFromConvex } from './tools.js';
export { createConvexAgentCallbacks } from './callbacks.js';
export type { AgentDefinitionOptions } from './agent.js';
export type { ConvexToolsConfig } from './tools.js';
export type { AgentCallbacks, AgentPersonaData, BufferedMessage, ConvexAgentConfig, AgentEvent } from './callbacks.js';
export type { LiveKitAgentConfig } from '../types';

// Default export required by @livekit/agents framework
const defaultAgent = createAgentDefinition();
export default defaultAgent;

// When run directly (e.g. `node agent/index.js dev`), start the CLI
const isDirectRun =
  typeof import.meta.url !== 'undefined' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  // Log env var status at startup for easier debugging
  const envCheck = {
    GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    LIVEKIT_URL: !!process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: !!process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: !!process.env.LIVEKIT_API_SECRET,
    CONVEX_URL: !!(process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL),
    APP_SLUG: !!(process.env.APP_SLUG ?? process.env.NEXT_PUBLIC_APP_SLUG),
    APP_SECRET: !!process.env.APP_SECRET,
  };
  console.log('[agent] Env vars:', JSON.stringify(envCheck));

  if (!process.env.GOOGLE_API_KEY) {
    console.error('[agent] WARNING: GOOGLE_API_KEY is not set — agent will fail to create Gemini RealtimeModel');
  }

  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
