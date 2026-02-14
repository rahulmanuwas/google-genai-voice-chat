import { llm } from '@livekit/agents';
import crypto from 'node:crypto';
import { z } from 'zod';

export interface ConvexToolsConfig {
  /** Convex deployment URL (e.g. https://my-app.convex.cloud) */
  convexUrl: string;
  /** App slug for authentication (used with appSecret) */
  appSlug?: string;
  /** App secret for server-to-server authentication */
  appSecret?: string;
  /** Session token for browser-safe authentication (alternative to appSecret) */
  sessionToken?: string;
  /** Session ID for tool execution logging */
  sessionId: string;
  /** Correlation ID for distributed tracing */
  traceId?: string;
  /** Called after each tool execution with the tool name and parsed result */
  onToolResult?: (toolName: string, result: Record<string, unknown>) => void;
}

interface ConvexToolRecord {
  name: string;
  description: string;
  parametersSchema: string;
  requiresConfirmation?: boolean;
}

/** Result of loading tools from Convex — includes the ToolContext and confirmation metadata */
export interface ConvexToolsResult {
  tools: llm.ToolContext;
  /** Tool names that require verbal user confirmation before execution */
  confirmationRequired: string[];
}

/**
 * Convert a JSON schema property to a zod schema.
 * Handles: string, number, integer, boolean, array, object, oneOf/anyOf.
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  // Handle oneOf / anyOf as unions
  const alternatives = (schema.oneOf ?? schema.anyOf) as Record<string, unknown>[] | undefined;
  if (alternatives && alternatives.length > 0) {
    if (alternatives.length === 1) return jsonSchemaToZod(alternatives[0]);
    const schemas = alternatives.map(jsonSchemaToZod);
    return z.union([schemas[0], schemas[1], ...schemas.slice(2)] as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }

  const type = schema.type as string;

  switch (type) {
    case 'string': {
      if (schema.enum) return z.enum(schema.enum as [string, ...string[]]);
      let s = z.string();
      if (typeof schema.minLength === 'number') s = s.min(schema.minLength);
      if (typeof schema.maxLength === 'number') s = s.max(schema.maxLength);
      if (typeof schema.pattern === 'string') s = s.regex(new RegExp(schema.pattern));
      return s;
    }
    case 'number':
    case 'integer': {
      let n = z.number();
      if (type === 'integer') n = n.int();
      if (typeof schema.minimum === 'number') n = n.min(schema.minimum);
      if (typeof schema.maximum === 'number') n = n.max(schema.maximum);
      if (typeof schema.exclusiveMinimum === 'number') n = n.gt(schema.exclusiveMinimum);
      if (typeof schema.exclusiveMaximum === 'number') n = n.lt(schema.exclusiveMaximum);
      return n;
    }
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(
        schema.items
          ? jsonSchemaToZod(schema.items as Record<string, unknown>)
          : z.unknown()
      );
    case 'object': {
      const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (!props) return z.record(z.string(), z.unknown());
      const shape: Record<string, z.ZodType> = {};
      const req = new Set((schema.required as string[]) ?? []);
      for (const [key, prop] of Object.entries(props)) {
        const zodType = jsonSchemaToZod(prop);
        shape[key] = req.has(key) ? zodType : zodType.optional();
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}

/** Build auth params for query strings or request bodies */
function resolveAuth(config: ConvexToolsConfig): Record<string, string> {
  if (config.sessionToken) {
    return { sessionToken: config.sessionToken };
  }
  return { appSlug: config.appSlug!, appSecret: config.appSecret! };
}

/** Build auth headers for GET endpoints (avoid secrets in query strings). */
function resolveAuthHeaders(config: ConvexToolsConfig): Record<string, string> {
  if (config.sessionToken) {
    return { Authorization: `Bearer ${config.sessionToken}` };
  }
  return {
    Authorization: `Bearer ${config.appSecret!}`,
    'X-App-Slug': config.appSlug!,
  };
}

/**
 * Fetch tool definitions from the Convex backend and convert them
 * to a LiveKit ToolContext (name-keyed record of FunctionTools).
 */
export async function createToolsFromConvex(
  config: ConvexToolsConfig,
): Promise<ConvexToolsResult> {
  const url = new URL('/api/tools', config.convexUrl);
  const response = await fetch(url.toString(), {
    headers: resolveAuthHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tools: ${response.statusText}`);
  }

  const { tools } = (await response.json()) as { tools: ConvexToolRecord[] };

  const toolContext: llm.ToolContext = {};

  for (const toolDef of tools) {
    // Parse the JSON schema into zod
    let parametersSchema: z.ZodObject<Record<string, z.ZodType>>;

    try {
      const schema = JSON.parse(toolDef.parametersSchema) as {
        properties?: Record<string, Record<string, unknown>>;
        required?: string[];
      };

      const shape: Record<string, z.ZodType> = {};
      const required = new Set(schema.required ?? []);

      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          const zodType = jsonSchemaToZod(prop);
          shape[key] = required.has(key) ? zodType : zodType.optional();
        }
      }

      parametersSchema = z.object(shape);
    } catch {
      parametersSchema = z.object({});
    }

    toolContext[toolDef.name] = llm.tool({
      description: toolDef.description,
      parameters: parametersSchema,
      execute: async (params: Record<string, unknown>) => {
        const spanId = crypto.randomUUID().slice(0, 8);
        const traceHeaders: Record<string, string> = config.traceId
          ? { 'X-Trace-Id': config.traceId }
          : {};
        const execResponse = await fetch(
          new URL('/api/tools/execute', config.convexUrl).toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...traceHeaders },
            body: JSON.stringify({
              ...resolveAuth(config),
              sessionId: config.sessionId,
              toolName: toolDef.name,
              parameters: params,
              traceId: config.traceId,
              spanId,
            }),
          },
        );

        if (!execResponse.ok) {
          const errorText = await execResponse.text().catch(() => execResponse.statusText);
          return JSON.stringify({ success: false, error: `Tool execution failed (${execResponse.status}): ${errorText}` });
        }

        const result = await execResponse.json();

        // Notify caller of tool result (e.g. for handoff detection)
        if (config.onToolResult) {
          try {
            config.onToolResult(toolDef.name, result as Record<string, unknown>);
          } catch { /* callback errors should not break tool execution */ }
        }

        return JSON.stringify(result);
      },
    });
  }

  const confirmationRequired = tools
    .filter(t => t.requiresConfirmation)
    .map(t => t.name);

  return { tools: toolContext, confirmationRequired };
}
