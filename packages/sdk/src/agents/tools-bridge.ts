/**
 * Converts Riyaan tool definitions to Pi's native tool format.
 */

import type { ToolDefinition } from './types';

/**
 * Convert a Riyaan ToolDefinition into Pi's tool format.
 * Pi uses `{ description, parameters, execute }`.
 */
export function convertTool(tool: ToolDefinition): unknown {
  return {
    description: tool.description,
    parameters: toJsonSchema(tool.parameters),
    execute: tool.execute,
  };
}

/** Convert an array of Riyaan tools for Pi */
export function convertTools(tools: ToolDefinition[]): unknown[] {
  return tools.map(convertTool);
}

/** Convert Riyaan parameter definitions to JSON Schema properties */
function toJsonSchema(params: ToolDefinition['parameters']): {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [name, param] of Object.entries(params)) {
    properties[name] = {
      type: param.type,
      ...(param.description && { description: param.description }),
      ...(param.default !== undefined && { default: param.default }),
    };
    if (param.required) {
      required.push(name);
    }
  }

  return { type: 'object', properties, required };
}
