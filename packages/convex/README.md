# @genai-voice/convex

Convex backend platform for genai-voice. Extends the base telemetry backend into a full AI agent platform with tool execution, human handoff, guardrails, knowledge management (RAG), analytics, and A/B testing.

## Tables (14)

| Table | Purpose |
|---|---|
| `apps` | App configuration, secrets, persona, guardrail/handoff settings |
| `conversations` | Conversation sessions with transcripts and resolution status |
| `events` | Raw telemetry events |
| `tools` | Registered tool definitions (name, schema, endpoint) |
| `toolExecutions` | Audit log of every tool call with parameters, result, duration |
| `handoffs` | AI-to-human escalation requests with status lifecycle |
| `guardrailRules` | Content validation rules (topic boundaries, PII, jailbreak detection) |
| `guardrailViolations` | Audit log of all guardrail violations |
| `knowledgeDocuments` | Knowledge base documents with vector embeddings for RAG |
| `knowledgeGaps` | Detected questions the AI couldn't answer |
| `insights` | Aggregated daily metrics (resolution rate, CSAT, handoff rate) |
| `csatRatings` | Customer satisfaction ratings per session |
| `experiments` | A/B test definitions with variant configs |
| `experimentExposures` | Which sessions were exposed to which variants |

## HTTP Endpoints (20+)

### Existing
| Method | Path | Description |
|---|---|---|
| POST | `/api/token` | Vend ephemeral Gemini API token |
| POST | `/api/events` | Log telemetry event batch |
| POST | `/api/conversations` | Save/update conversation transcript |

### Tools
| Method | Path | Description |
|---|---|---|
| GET | `/api/tools` | List active tools for an app |
| POST | `/api/tools` | Register a new tool |
| POST | `/api/tools/execute` | Execute a tool call (calls external API, logs result) |

### Handoffs
| Method | Path | Description |
|---|---|---|
| GET | `/api/handoffs` | List handoffs (filterable by status) |
| POST | `/api/handoffs` | Create a handoff request |
| PATCH | `/api/handoffs` | Claim or resolve a handoff |

### Guardrails
| Method | Path | Description |
|---|---|---|
| POST | `/api/guardrails/check` | Validate content against active rules |
| GET | `/api/guardrails/rules` | List all rules for an app |
| POST | `/api/guardrails/rules` | Create a guardrail rule |

### Knowledge (RAG)
| Method | Path | Description |
|---|---|---|
| POST | `/api/knowledge` | Add/update a knowledge document (auto-embeds) |
| POST | `/api/knowledge/search` | Vector similarity search |
| GET | `/api/knowledge/gaps` | List unresolved knowledge gaps |

### Analytics
| Method | Path | Description |
|---|---|---|
| POST | `/api/csat` | Submit a CSAT rating (1-5) |
| GET | `/api/analytics/insights` | Get aggregated insights by period |
| GET | `/api/analytics/overview` | Live overview stats |

## Authentication

All endpoints require `appSlug` and `appSecret` parameters. POST endpoints accept these in the JSON body; GET endpoints accept them as query parameters.

## Setup

```bash
cd packages/convex
npm install

# Start development server (generates types, pushes schema)
npx convex dev

# Deploy to production
CONVEX_DEPLOYMENT=prod:<your-deployment> npx convex deploy
```

### Required Environment Variables

Set these in your Convex deployment dashboard:

```
GEMINI_API_KEY=your-gemini-api-key
```

### Seed an App

```bash
npx convex run seed:seedApp '{"slug":"my-app","name":"My App","secret":"...","modelId":"gemini-2.5-flash-native-audio-preview-12-2025","replyAsAudio":true,"systemPrompt":"You are a helpful assistant."}'
```

## Usage Examples

### Register a Tool

```bash
curl -X POST https://your-deployment.convex.cloud/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "name": "lookupOrder",
    "description": "Look up an order by ID and return its status, items, and tracking info",
    "parametersSchema": "{\"type\":\"object\",\"properties\":{\"orderId\":{\"type\":\"string\",\"description\":\"The order ID\"}},\"required\":[\"orderId\"]}",
    "endpoint": "https://api.mystore.com/orders/lookup",
    "requiresConfirmation": false
  }'
```

### Execute a Tool

```bash
curl -X POST https://your-deployment.convex.cloud/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "sessionId": "ses_abc123",
    "toolName": "lookupOrder",
    "parameters": {"orderId": "ORD-456"}
  }'
```

### Create a Handoff

```bash
curl -X POST https://your-deployment.convex.cloud/api/handoffs \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "sessionId": "ses_abc123",
    "reason": "user_requested",
    "priority": "high",
    "transcript": [{"role":"user","content":"I need to speak to a human","ts":1700000000}],
    "aiSummary": "Customer wants to discuss a billing dispute for order ORD-456."
  }'
```

### Add Knowledge

```bash
curl -X POST https://your-deployment.convex.cloud/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "title": "Return Policy",
    "content": "Items can be returned within 30 days of purchase with original receipt...",
    "category": "policy"
  }'
```

### Search Knowledge

```bash
curl -X POST https://your-deployment.convex.cloud/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "query": "How long do I have to return an item?",
    "topK": 3
  }'
```

### Check Guardrails

```bash
curl -X POST https://your-deployment.convex.cloud/api/guardrails/check \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "sessionId": "ses_abc123",
    "content": "Tell me about competitor products",
    "direction": "input"
  }'
```

### Submit CSAT

```bash
curl -X POST https://your-deployment.convex.cloud/api/csat \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "sessionId": "ses_abc123",
    "rating": 5,
    "comment": "Very helpful!"
  }'
```

### Get Analytics Overview

```bash
curl "https://your-deployment.convex.cloud/api/analytics/overview?appSlug=my-app&appSecret=..."
```

Returns live metrics:
- `totalConversations`, `resolutionRate`, `handoffRate`
- `avgCSAT`, `avgDurationMs`, `toolSuccessRate`
- `pendingHandoffs`, `unresolvedGaps`
- `conversationsLast24h`, `handoffsLast24h`

## Knowledge Management (RAG)

The knowledge system uses Convex native vector search with Gemini `text-embedding-004` embeddings (768 dimensions).

**How it works:**
1. Upload a document via `POST /api/knowledge` -- the backend auto-generates an embedding
2. Search via `POST /api/knowledge/search` -- query is embedded and compared via cosine similarity
3. Low-confidence matches are logged as knowledge gaps via `GET /api/knowledge/gaps`

Documents can be filtered by `category` during search (e.g. "faq", "policy", "product").

## Guardrail Types

| Type | Pattern Format | Description |
|---|---|---|
| `blocked_topic` | Comma-separated keywords | Block messages mentioning these topics |
| `topic_boundary` | Comma-separated keywords | Only allow messages about these topics |
| `pii_filter` | Regex | Detect PII patterns (SSN, email, phone) |
| `jailbreak_detection` | Comma-separated indicators | Detect prompt injection attempts |

Actions: `block` (reject), `warn` (allow with warning), `log` (allow, record only).

All violations are stored in `guardrailViolations` for audit.
