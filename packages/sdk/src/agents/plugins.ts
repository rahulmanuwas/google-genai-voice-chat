import type {
  ToolDefinition,
  AgentPluginService,
} from './types';

const registeredTools = new Map<string, ToolDefinition>();
const registeredServices = new Map<string, AgentPluginService>();

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Register a tool globally for future Pi agent sessions. */
export function registerTool(tool: ToolDefinition): () => void {
  const key = normalizeName(tool.name);
  if (!key) {
    throw new Error('Tool name is required for registerTool().');
  }
  registeredTools.set(key, { ...tool });
  return () => unregisterTool(tool.name);
}

/** Remove a previously registered global tool. */
export function unregisterTool(name: string): void {
  registeredTools.delete(normalizeName(name));
}

/** List globally registered tools. */
export function listRegisteredTools(): ToolDefinition[] {
  return Array.from(registeredTools.values()).map((tool) => ({ ...tool }));
}

/** Clear all globally registered tools. */
export function clearRegisteredTools(): void {
  registeredTools.clear();
}

/** Register a plugin service with optional start/stop lifecycle hooks. */
export function registerService(service: AgentPluginService): () => void {
  const key = normalizeName(service.name);
  if (!key) {
    throw new Error('Service name is required for registerService().');
  }
  registeredServices.set(key, { ...service });
  return () => unregisterService(service.name);
}

/** Remove a previously registered plugin service. */
export function unregisterService(name: string): void {
  registeredServices.delete(normalizeName(name));
}

/** List globally registered plugin services. */
export function listRegisteredServices(): AgentPluginService[] {
  return Array.from(registeredServices.values()).map((service) => ({ ...service }));
}

/** Clear all globally registered services. */
export function clearRegisteredServices(): void {
  registeredServices.clear();
}
