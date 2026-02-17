/**
 * Converts Riyaan tool definitions to Pi's native tool format.
 */

import type { ToolDefinition } from './pi-types';

interface PiToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details: unknown;
}

/**
 * Convert a Riyaan ToolDefinition into Pi's tool format.
 * Pi expects extension-style tools with `name`, `label`, `parameters`, and
 * `execute(toolCallId, params, signal, onUpdate, ctx)`.
 */
export function convertTool(tool: ToolDefinition): unknown {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: toJsonSchema(tool.parameters),
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const raw = await invokeTool(tool, params);
      return normalizeToolResult(raw);
    },
  };
}

/** Convert an array of Riyaan tools for Pi */
export function convertTools(tools: ToolDefinition[]): unknown[] {
  return tools.map(convertTool);
}

async function invokeTool(tool: ToolDefinition, params: Record<string, unknown>): Promise<unknown> {
  if (tool.execute) {
    return tool.execute(params);
  }

  if (tool.endpoint) {
    const res = await fetch(tool.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: tool.name, params }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Tool "${tool.name}" endpoint failed (${res.status}): ${text}`);
    }

    const text = await res.text();
    if (!text) return { ok: true };
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  throw new Error(
    `Tool "${tool.name}" is missing an executor. Provide either tool.execute() or tool.endpoint.`,
  );
}

function normalizeToolResult(result: unknown): PiToolResult {
  if (isPiToolResult(result)) return result;

  if (typeof result === 'string') {
    return {
      content: [{ type: 'text', text: result }],
      details: { text: result },
    };
  }

  if (result === null || result === undefined) {
    return {
      content: [{ type: 'text', text: 'Done.' }],
      details: { value: result ?? null },
    };
  }

  const serialized = safeSerialize(result);
  return {
    content: [{ type: 'text', text: serialized }],
    details: result,
  };
}

function isPiToolResult(value: unknown): value is PiToolResult {
  if (!value || typeof value !== 'object') return false;
  if (!('content' in value)) return false;
  const content = (value as { content?: unknown }).content;
  return Array.isArray(content);
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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
