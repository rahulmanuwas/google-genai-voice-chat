export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface EndpointDef {
  method: HttpMethod;
  path: string;
  description: string;
  category: string;
  auth: string;
  requestFields?: RequestField[];
  response: string;
}

// ---------------------------------------------------------------------------
// Convex HTTP Endpoints
// ---------------------------------------------------------------------------

export const CONVEX_ENDPOINTS: EndpointDef[] = [
  // ── Auth ──────────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/auth/session',
    description: 'Create a short-lived session token from app credentials (server-to-server).',
    category: 'Auth',
    auth: 'appSlug + appSecret (server-to-server only)',
    requestFields: [
      { name: 'appSlug', type: 'string', required: true, description: 'App identifier' },
      { name: 'appSecret', type: 'string', required: true, description: 'Server-only app secret' },
      { name: 'ttlMs', type: 'number', required: false, description: 'Token TTL in milliseconds (default: 1 hour)' },
    ],
    response: '{ sessionToken: string, expiresAt: number }',
  },

  // ── Tokens ────────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/token',
    description: 'Generate an ephemeral Gemini API token for client-side voice/chat.',
    category: 'Tokens',
    auth: 'appSecret OR sessionToken',
    requestFields: [],
    response: '{ token, expiresAt, modelId, replyAsAudio, systemPrompt }',
  },

  // ── Events ────────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/events',
    description: 'Log a batch of telemetry events for a session.',
    category: 'Events',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'events', type: 'array', required: true, description: 'Array of { eventType, ts, data? } (max 100)' },
    ],
    response: '{ inserted: number }',
  },

  // ── Conversations ─────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/conversations',
    description: 'List conversations, optionally filtered by status.',
    category: 'Conversations',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'status', type: 'string', required: false, description: 'Filter by status (active, resolved, handed_off, abandoned)' },
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ conversations: Conversation[] }',
  },
  {
    method: 'POST',
    path: '/api/conversations',
    description: 'Save or update a conversation transcript.',
    category: 'Conversations',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'startedAt', type: 'number', required: true, description: 'Conversation start timestamp (ms)' },
      { name: 'messages', type: 'array', required: true, description: 'Array of { role, content, ts }' },
      { name: 'status', type: 'string', required: false, description: 'active | resolved | handed_off | abandoned' },
      { name: 'channel', type: 'string', required: false, description: 'Channel (web, phone, sms)' },
      { name: 'resolution', type: 'string', required: false, description: 'Resolution summary' },
    ],
    response: '{ ok: true }',
  },

  // ── Tools ─────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/tools',
    description: 'List active tools for the app.',
    category: 'Tools',
    auth: 'appSecret OR sessionToken',
    requestFields: [],
    response: '{ tools: Tool[] }',
  },
  {
    method: 'GET',
    path: '/api/tools/all',
    description: 'List all tools (including inactive) for the app.',
    category: 'Tools',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ tools: Tool[] }',
  },
  {
    method: 'GET',
    path: '/api/tools/executions',
    description: 'List tool execution history.',
    category: 'Tools',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ executions: ToolExecution[] }',
  },
  {
    method: 'POST',
    path: '/api/tools',
    description: 'Register a new tool the agent can invoke.',
    category: 'Tools',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'name', type: 'string', required: true, description: 'Unique tool name' },
      { name: 'description', type: 'string', required: true, description: 'What the tool does' },
      { name: 'parametersSchema', type: 'string', required: true, description: 'JSON Schema for parameters' },
      { name: 'endpoint', type: 'string', required: true, description: 'URL to call when tool is invoked' },
      { name: 'headers', type: 'object', required: false, description: 'Custom HTTP headers' },
      { name: 'httpMethod', type: 'string', required: false, description: 'HTTP method (default: POST)' },
      { name: 'requiresConfirmation', type: 'boolean', required: false, description: 'Require user confirmation before executing' },
      { name: 'requiresAuth', type: 'boolean', required: false, description: 'Tool requires authentication' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'POST',
    path: '/api/tools/execute',
    description: 'Execute a registered tool (rate-limited by maxActionsPerTurn).',
    category: 'Tools',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'toolName', type: 'string', required: true, description: 'Name of the tool to execute' },
      { name: 'parameters', type: 'object', required: true, description: 'Tool parameters matching its schema' },
    ],
    response: '{ result: any, executionId: string }',
  },

  // ── Handoffs ──────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/handoffs',
    description: 'List handoffs, optionally filtered by status.',
    category: 'Handoffs',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'status', type: 'string', required: false, description: 'Filter by status (pending, assigned, resolved, rejected)' },
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
      { name: 'appSlug', type: 'string', required: false, description: 'Optional app override when all=true' },
      { name: 'sessionId', type: 'string', required: false, description: 'Filter to a single session' },
    ],
    response: '{ handoffs: Handoff[] }',
  },
  {
    method: 'POST',
    path: '/api/handoffs',
    description: 'Create a handoff request. Auto-sets conversation status to "handed_off".',
    category: 'Handoffs',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'reason', type: 'string', required: true, description: 'Handoff reason category' },
      { name: 'transcript', type: 'array', required: true, description: 'Array of { role, content, ts }' },
      { name: 'channel', type: 'string', required: false, description: 'Channel (web, phone, sms)' },
      { name: 'reasonDetail', type: 'string', required: false, description: 'Detailed reason text' },
      { name: 'priority', type: 'string', required: false, description: 'Priority level' },
      { name: 'aiSummary', type: 'string', required: false, description: 'AI-generated conversation summary' },
      { name: 'customerData', type: 'object', required: false, description: 'Arbitrary customer metadata' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'PATCH',
    path: '/api/handoffs',
    description: 'Update handoff status or assignment.',
    category: 'Handoffs',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'handoffId', type: 'string', required: true, description: 'Handoff record ID' },
      { name: 'status', type: 'string', required: true, description: 'New status (pending, assigned, resolved, rejected)' },
      { name: 'assignedAgent', type: 'string', required: false, description: 'Assigned agent name/ID' },
    ],
    response: '{ ok: true }',
  },

  // ── Guardrails ────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/guardrails/check',
    description: 'Check content against guardrail rules.',
    category: 'Guardrails',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'content', type: 'string', required: true, description: 'Content to check' },
      { name: 'direction', type: 'string', required: true, description: '"input" or "output"' },
    ],
    response: '{ allowed: boolean, violations: Violation[] }',
  },
  {
    method: 'GET',
    path: '/api/guardrails/rules',
    description: 'List guardrail rules.',
    category: 'Guardrails',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ rules: GuardrailRule[] }',
  },
  {
    method: 'POST',
    path: '/api/guardrails/rules',
    description: 'Create or update a guardrail rule.',
    category: 'Guardrails',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'type', type: 'string', required: true, description: 'Rule type (regex, keyword, etc.)' },
      { name: 'pattern', type: 'string', required: true, description: 'Regex or keyword pattern' },
      { name: 'action', type: 'string', required: true, description: 'Action on match (block, warn, log)' },
      { name: 'userMessage', type: 'string', required: false, description: 'Custom message shown when rule triggers' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'GET',
    path: '/api/guardrails/violations',
    description: 'List guardrail violations.',
    category: 'Guardrails',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
      { name: 'sessionId', type: 'string', required: false, description: 'Filter to a single session' },
    ],
    response: '{ violations: Violation[] }',
  },

  // ── Knowledge ─────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/knowledge/documents',
    description: 'List knowledge base documents.',
    category: 'Knowledge',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ documents: KnowledgeDocument[] }',
  },
  {
    method: 'POST',
    path: '/api/knowledge',
    description: 'Upsert a knowledge document (auto-generates vector embedding).',
    category: 'Knowledge',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'title', type: 'string', required: true, description: 'Document title' },
      { name: 'content', type: 'string', required: true, description: 'Document content' },
      { name: 'category', type: 'string', required: true, description: 'Category for filtering' },
      { name: 'sourceType', type: 'string', required: false, description: 'Source type (default: "document")' },
      { name: 'updatedBy', type: 'string', required: false, description: 'Who updated the document' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'POST',
    path: '/api/knowledge/search',
    description: 'Hybrid search across knowledge base (vector + BM25 + transcript memory fusion).',
    category: 'Knowledge',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'query', type: 'string', required: true, description: 'Search query text' },
      { name: 'category', type: 'string', required: false, description: 'Filter by category' },
      { name: 'topK', type: 'number', required: false, description: 'Number of results (default: 5)' },
      { name: 'sessionId', type: 'string', required: false, description: 'Session used for logging and transcript-memory context' },
      { name: 'includeTranscriptMemory', type: 'boolean', required: false, description: 'Include indexed transcript memory chunks (default: true)' },
      { name: 'alphaVector', type: 'number', required: false, description: 'Weight for vector signal (default: 0.62)' },
      { name: 'alphaKeyword', type: 'number', required: false, description: 'Weight for BM25 keyword signal (default: 0.38)' },
      { name: 'alphaMemory', type: 'number', required: false, description: 'Extra boost for transcript memory hits (default: 0.20)' },
    ],
    response: '{ results: SearchResult[] }',
  },
  {
    method: 'GET',
    path: '/api/knowledge/metrics',
    description: 'Get aggregated search quality metrics (total searches, avg top score, gap rate).',
    category: 'Knowledge',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'since', type: 'number', required: false, description: 'Timestamp lower bound (ms)' },
    ],
    response: '{ totalSearches, avgTopScore, gapRate }',
  },
  {
    method: 'GET',
    path: '/api/knowledge/gaps',
    description: 'List unresolved knowledge gaps.',
    category: 'Knowledge',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ gaps: KnowledgeGap[] }',
  },

  // ── Analytics ─────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/csat',
    description: 'Submit a customer satisfaction rating.',
    category: 'Analytics',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'rating', type: 'number', required: true, description: 'Rating from 1 to 5' },
      { name: 'comment', type: 'string', required: false, description: 'Optional comment' },
    ],
    response: '{ ok: true }',
  },
  {
    method: 'GET',
    path: '/api/analytics/insights',
    description: 'Get analytics insights (single period or last 30).',
    category: 'Analytics',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'period', type: 'string', required: false, description: 'Specific period key (e.g. "2025-01-15")' },
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ insight: Insight } or { insights: Insight[] }',
  },
  {
    method: 'GET',
    path: '/api/analytics/overview',
    description: 'Get live analytics overview (conversations, ratings, handoffs, etc.).',
    category: 'Analytics',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'since', type: 'string', required: false, description: 'Timestamp filter (ms) — only count data after this time' },
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ conversations, avgRating, handoffs, resolvedCount, toolUsage, ... }',
  },

  // ── Messages ──────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/messages',
    description: 'Batch-insert real-time transcription messages.',
    category: 'Messages',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'messages', type: 'array', required: true, description: 'Array of { sessionId, roomName?, participantIdentity, role, content, isFinal, language?, createdAt }' },
    ],
    response: '{ ok: true, count: number }',
  },
  {
    method: 'GET',
    path: '/api/messages',
    description: 'List messages for a session.',
    category: 'Messages',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Session ID to query' },
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app lookup' },
      { name: 'appSlug', type: 'string', required: false, description: 'Optional app filter when all=true' },
    ],
    response: '{ messages: Message[], recordings: { user, agent, conversation? } }',
  },

  // ── Persona ───────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/persona',
    description: 'Get the app persona (name, greeting, tone, terms).',
    category: 'Persona',
    auth: 'appSecret OR sessionToken',
    requestFields: [],
    response: '{ systemPrompt, personaName, personaGreeting, personaTone, preferredTerms, blockedTerms }',
  },
  {
    method: 'PATCH',
    path: '/api/persona',
    description: 'Update persona fields.',
    category: 'Persona',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'personaName', type: 'string', required: false, description: 'Agent persona name' },
      { name: 'personaGreeting', type: 'string', required: false, description: 'Greeting message' },
      { name: 'personaTone', type: 'string', required: false, description: 'Conversational tone' },
      { name: 'preferredTerms', type: 'string[]', required: false, description: 'Terms the agent should use' },
      { name: 'blockedTerms', type: 'string[]', required: false, description: 'Terms the agent should avoid' },
    ],
    response: '{ ok: true }',
  },

  // ── Experiments ───────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/experiments',
    description: 'Create an A/B experiment with weighted variants.',
    category: 'Experiments',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'name', type: 'string', required: true, description: 'Experiment name' },
      { name: 'variants', type: 'array', required: true, description: 'Array of 2+ { id, weight, config? }' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'GET',
    path: '/api/experiments',
    description: 'List experiments.',
    category: 'Experiments',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
    ],
    response: '{ experiments: Experiment[] }',
  },
  {
    method: 'POST',
    path: '/api/experiments/assign',
    description: 'Assign a session to an experiment variant (sticky weighted random).',
    category: 'Experiments',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'experimentId', type: 'string', required: true, description: 'Experiment ID' },
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
    ],
    response: '{ variantId: string, alreadyAssigned: boolean }',
  },

  // ── QA ────────────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/qa/scenarios',
    description: 'Create or update a QA scenario by name.',
    category: 'QA',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'name', type: 'string', required: true, description: 'Scenario name' },
      { name: 'description', type: 'string', required: false, description: 'Scenario context' },
      { name: 'turns', type: 'array', required: true, description: 'Array of { role: "user", content } turns' },
      { name: 'expectations', type: 'object', required: false, description: 'Assertions (contains, notContains, tool call, handoff)' },
      { name: 'isActive', type: 'boolean', required: false, description: 'Enable/disable scenario' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'GET',
    path: '/api/qa/scenarios',
    description: 'List QA scenarios.',
    category: 'QA',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
      { name: 'active', type: 'string', required: false, description: 'Filter by active=true/false' },
    ],
    response: '{ scenarios: QaScenario[] }',
  },
  {
    method: 'POST',
    path: '/api/qa/runs',
    description: 'Evaluate a candidate response against scenario expectations.',
    category: 'QA',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'scenarioId', type: 'string', required: true, description: 'QA scenario ID' },
      { name: 'responseText', type: 'string', required: true, description: 'Agent response to evaluate' },
      { name: 'calledTools', type: 'string[]', required: false, description: 'Tools called during this turn' },
      { name: 'handoffTriggered', type: 'boolean', required: false, description: 'Whether a handoff happened' },
      { name: 'sessionId', type: 'string', required: false, description: 'Associated session ID' },
    ],
    response: '{ id, status, score, totalChecks, passedChecks, results[] }',
  },
  {
    method: 'GET',
    path: '/api/qa/runs',
    description: 'List QA run history.',
    category: 'QA',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
      { name: 'scenarioId', type: 'string', required: false, description: 'Filter by scenario' },
      { name: 'limit', type: 'number', required: false, description: 'Max records to return' },
    ],
    response: '{ runs: QaRun[] }',
  },

  // ── Outbound ──────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/outbound/triggers',
    description: 'Create or update an outbound trigger by name.',
    category: 'Outbound',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'name', type: 'string', required: true, description: 'Trigger name' },
      { name: 'eventType', type: 'string', required: true, description: 'Event key (cart_abandoned, payment_failed, etc.)' },
      { name: 'channel', type: 'string', required: true, description: 'sms | email | push | voice' },
      { name: 'template', type: 'string', required: true, description: 'Message template using {{placeholders}}' },
      { name: 'condition', type: 'object', required: false, description: 'Condition object matched against eventData' },
      { name: 'throttleMaxPerWindow', type: 'number', required: false, description: 'Max sends per throttle window' },
      { name: 'throttleWindowMs', type: 'number', required: false, description: 'Throttle window in milliseconds' },
      { name: 'isActive', type: 'boolean', required: false, description: 'Enable/disable trigger' },
    ],
    response: '{ id: string }',
  },
  {
    method: 'GET',
    path: '/api/outbound/triggers',
    description: 'List outbound triggers.',
    category: 'Outbound',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
      { name: 'active', type: 'string', required: false, description: 'Filter by active=true/false' },
      { name: 'eventType', type: 'string', required: false, description: 'Filter by event type' },
    ],
    response: '{ triggers: OutboundTrigger[] }',
  },
  {
    method: 'POST',
    path: '/api/outbound/dispatch',
    description: 'Evaluate active triggers and dispatch outbound messages for an event.',
    category: 'Outbound',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'eventType', type: 'string', required: true, description: 'Event key to process' },
      { name: 'recipient', type: 'string', required: true, description: 'Destination address/number/user ID' },
      { name: 'eventData', type: 'object', required: false, description: 'Event payload used for conditions and templates' },
      { name: 'channel', type: 'string', required: false, description: 'Optional channel override' },
      { name: 'sessionId', type: 'string', required: false, description: 'Associated session ID' },
    ],
    response: '{ processed, sent[], skipped[] }',
  },
  {
    method: 'GET',
    path: '/api/outbound/dispatches',
    description: 'List outbound dispatch logs.',
    category: 'Outbound',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app listing' },
      { name: 'eventType', type: 'string', required: false, description: 'Filter by event type' },
      { name: 'limit', type: 'number', required: false, description: 'Max records to return' },
    ],
    response: '{ dispatches: OutboundDispatch[] }',
  },

  // ── LiveKit ───────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/livekit/token',
    description: 'Generate a LiveKit room access token.',
    category: 'LiveKit',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'roomName', type: 'string', required: true, description: 'Room to join' },
      { name: 'identity', type: 'string', required: true, description: 'Participant identity' },
      { name: 'name', type: 'string', required: false, description: 'Display name' },
      { name: 'ttl', type: 'number', required: false, description: 'Token TTL in seconds' },
    ],
    response: '{ token: string, serverUrl: string }',
  },
  {
    method: 'POST',
    path: '/api/livekit/rooms',
    description: 'Create a LiveKit room (on LiveKit server + Convex record).',
    category: 'LiveKit',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Client session ID' },
      { name: 'config', type: 'object', required: false, description: '{ maxParticipants?, emptyTimeout?, enableRecording? }' },
      { name: 'metadata', type: 'object', required: false, description: 'Optional JSON metadata attached to the room' },
    ],
    response: '{ roomId: string, roomName: string, sessionId: string }',
  },
  {
    method: 'GET',
    path: '/api/livekit/rooms',
    description: 'List active LiveKit rooms.',
    category: 'LiveKit',
    auth: 'appSecret OR sessionToken',
    requestFields: [],
    response: '{ rooms: LiveKitRoom[] }',
  },
  {
    method: 'DELETE',
    path: '/api/livekit/rooms',
    description: 'End a LiveKit room (closes on server + updates Convex).',
    category: 'LiveKit',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'roomName', type: 'string', required: true, description: 'Room name to end' },
    ],
    response: '{ ok: true }',
  },
  {
    method: 'POST',
    path: '/api/livekit/webhook',
    description: 'Receive LiveKit webhook events (signature-validated).',
    category: 'LiveKit',
    auth: 'LiveKit webhook signature (Authorization header)',
    requestFields: [],
    response: '{ ok: true }',
  },

  // ── Agents ────────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/agents/session',
    description: 'Create a runtime session (currently supports runtime="pi").',
    category: 'Agents',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'runtime', type: 'string', required: true, description: 'Runtime id (currently "pi")' },
      { name: 'provider', type: 'string', required: false, description: 'Initial provider hint' },
      { name: 'model', type: 'string', required: false, description: 'Initial model hint' },
      { name: 'branchId', type: 'string', required: false, description: 'Optional branch identifier' },
      { name: 'threadId', type: 'string', required: false, description: 'Optional runtime thread id' },
      { name: 'cwd', type: 'string', required: false, description: 'Working directory hint' },
    ],
    response: '{ sessionId, runtime, status }',
  },
  {
    method: 'GET',
    path: '/api/agents/session',
    description: 'Fetch one runtime session by sessionId.',
    category: 'Agents',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Runtime session id' },
    ],
    response: '{ ...AgentSession }',
  },
  {
    method: 'POST',
    path: '/api/agents/session/run',
    description: 'Record one runtime run metadata envelope (attempts, fallback, context recovery).',
    category: 'Agents',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Runtime session id' },
      { name: 'run', type: 'object', required: true, description: 'Run payload (runId, provider, model, status, timings, counts)' },
    ],
    response: '{ ok: true, sessionId, runId }',
  },
  {
    method: 'GET',
    path: '/api/agents/session/runs',
    description: 'List recent runtime runs for a session.',
    category: 'Agents',
    auth: 'appSecret OR sessionToken',
    requestFields: [
      { name: 'sessionId', type: 'string', required: true, description: 'Runtime session id' },
      { name: 'limit', type: 'number', required: false, description: 'Max run records (default: 50)' },
      { name: 'all', type: 'string', required: false, description: 'Set to "true" for cross-app lookup by sessionId' },
      { name: 'appSlug', type: 'string', required: false, description: 'Optional app filter when all=true' },
    ],
    response: '{ sessionId, runs: AgentSessionRun[] }',
  },
  {
    method: 'GET',
    path: '/api/agents/runtimes',
    description: 'List available runtimes/providers metadata.',
    category: 'Agents',
    auth: 'appSecret OR sessionToken',
    requestFields: [],
    response: '{ runtimes: RuntimeInfo[] }',
  },
];

// ---------------------------------------------------------------------------
// Dashboard API Routes (Next.js)
// ---------------------------------------------------------------------------

export const DASHBOARD_ENDPOINTS: EndpointDef[] = [
  {
    method: 'POST',
    path: '/api/session',
    description: 'Proxy to Convex session creation using server-side APP_SECRET (browser-safe).',
    category: 'Dashboard',
    auth: 'None (uses server APP_SECRET internally)',
    requestFields: [
      { name: 'appSlug', type: 'string', required: false, description: 'App slug (defaults to NEXT_PUBLIC_APP_SLUG or "demo")' },
    ],
    response: '{ sessionToken: string, expiresAt: number }',
  },
  {
    method: 'POST',
    path: '/api/twilio/call',
    description: 'Start an outbound PSTN call via LiveKit SIP + Twilio trunk.',
    category: 'Dashboard',
    auth: 'None (server-side only, requires LIVEKIT_SIP_TRUNK_ID env)',
    requestFields: [
      { name: 'to', type: 'string', required: true, description: 'Phone number in E.164 format (e.g. "+15551234567")' },
      { name: 'appSlug', type: 'string', required: false, description: 'App slug (optional)' },
    ],
    response: '{ roomName, participant, viewerToken, serverUrl }',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const ALL_ENDPOINTS: EndpointDef[] = [...CONVEX_ENDPOINTS, ...DASHBOARD_ENDPOINTS];

export const CATEGORIES = [
  'Auth',
  'Tokens',
  'Events',
  'Conversations',
  'Tools',
  'Handoffs',
  'Guardrails',
  'Knowledge',
  'Analytics',
  'Messages',
  'Persona',
  'Experiments',
  'QA',
  'Outbound',
  'LiveKit',
  'Agents',
  'Dashboard',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};
