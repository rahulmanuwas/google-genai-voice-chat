import { ServerOptions, cli } from '@livekit/agents';
import { fileURLToPath } from 'node:url';
import { createAgentDefinition } from './agent.js';

export { createAgentDefinition, createAgentFromConfig } from './agent.js';
export { createToolsFromConvex } from './tools.js';
export { createConvexAgentCallbacks } from './callbacks.js';
export type { AgentDefinitionOptions } from './agent.js';
export type { ConvexToolsConfig } from './tools.js';
export type { AgentCallbacks, AgentPersonaData, BufferedMessage, ConvexAgentConfig } from './callbacks.js';
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
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
