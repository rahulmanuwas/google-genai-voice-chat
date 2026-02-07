# @genai-voice/convex

Convex backend platform for genai-voice. Extends the base telemetry backend into a full AI agent platform with tool execution, human handoff, guardrails, knowledge management (RAG), analytics, persona management, A/B testing, and real-time transcription storage.

## Tables (18)

| Table | Purpose |
|---|---|
| `apps` | App configuration, secrets, persona, guardrail/handoff settings |
| `conversations` | Conversation sessions with transcripts, status lifecycle, and resolution |
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
| `messages` | Real-time transcription storage (user + agent messages per session) |
| `sessions` | Short-lived auth tokens for browser-safe access |
| `livekitRooms` | LiveKit room lifecycle (waiting → active → ended) |
| `livekitParticipants` | Participants in LiveKit rooms (user, agent, observer) |

## HTTP Endpoints (33+)

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/session` | Create a short-lived session token (server-to-server) |

### Existing
| Method | Path | Description |
|---|---|---|
| POST | `/api/token` | Vend ephemeral Gemini API token |
| POST | `/api/events` | Log telemetry event batch |
| POST | `/api/conversations` | Save/update conversation (accepts `status`, `channel`, `resolution`) |

### Tools
| Method | Path | Description |
|---|---|---|
| GET | `/api/tools` | List active tools for an app |
| POST | `/api/tools` | Register a new tool (requires `endpoint`) |
| POST | `/api/tools/execute` | Execute a tool call (calls external API, logs result) |

### Handoffs
| Method | Path | Description |
|---|---|---|
| GET | `/api/handoffs` | List handoffs (filterable by status) |
| POST | `/api/handoffs` | Create a handoff request (auto-sets conversation status to `handed_off`) |
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
| GET | `/api/analytics/overview` | Live overview stats (supports `?since=` time-window filter) |

### Messages (Transcription Storage)
| Method | Path | Description |
|---|---|---|
| POST | `/api/messages` | Insert a batch of transcription messages |
| GET | `/api/messages` | List messages by `sessionId` |

### Persona
| Method | Path | Description |
|---|---|---|
| GET | `/api/persona` | Get persona config (name, greeting, tone, terms) for an app |
| PATCH | `/api/persona` | Update persona fields |

### Experiments (A/B Testing)
| Method | Path | Description |
|---|---|---|
| POST | `/api/experiments` | Create an experiment with weighted variants |
| GET | `/api/experiments` | List experiments for an app |
| POST | `/api/experiments/assign` | Assign a variant (weighted random, sticky per session) |

### LiveKit
| Method | Path | Description |
|---|---|---|
| POST | `/api/livekit/token` | Generate a LiveKit access token |
| POST | `/api/livekit/rooms` | Create a new LiveKit room |
| GET | `/api/livekit/rooms` | List active rooms for an app |
| DELETE | `/api/livekit/rooms` | End a room (set status to ended) |
| POST | `/api/livekit/webhook` | Handle LiveKit webhook events (room/participant lifecycle) |

## Authentication

All endpoints support two auth methods:

- **Server-to-server**: `appSlug` + `appSecret`
- **Browser-safe**: `sessionToken` (create via `POST /api/auth/session`; keep `appSecret` on your server only)

POST endpoints accept auth in the JSON body. GET endpoints accept auth via query params (e.g. `?sessionToken=...`).

## Conversation Status Lifecycle

Conversations track their status through the following states:

| Status | Set When |
|---|---|
| `active` | New conversation created (default) |
| `handed_off` | Handoff request is created via `POST /api/handoffs` |
| `resolved` | Agent session ends or explicitly set via `POST /api/conversations` |
| `abandoned` | Explicitly set when conversation is abandoned |

The status is used by `GET /api/analytics/overview` to compute resolution rate and other metrics.

## Setup

```bash
cd packages/convex
pnpm install

# Start development server (generates types, pushes schema)
pnpm dev

# Deploy to production
CONVEX_DEPLOYMENT=prod:<your-deployment> pnpm deploy
```

### Required Environment Variables

Set these in your Convex deployment dashboard:

```
GEMINI_API_KEY=your-gemini-api-key

# Required for LiveKit endpoints
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_URL=https://your-app.livekit.cloud
```

### Seed an App

```bash
npx convex run seed:seedApp '{"slug":"my-app","name":"My App","secret":"...","modelId":"gemini-2.5-flash-native-audio-preview-12-2025","replyAsAudio":true,"systemPrompt":"You are a helpful assistant."}'
```

## Usage Examples

### Create a Session Token (Browser-Safe Auth)

This endpoint is **server-to-server only**. Call it from your backend/API route and return `{ sessionToken }` to the browser.

```bash
curl -X POST https://your-deployment.convex.cloud/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "ttlMs": 3600000
  }'
```

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

> **Note**: Active tools must have an `endpoint`. Registration will fail with a 400 if no endpoint is provided.

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

Creating a handoff automatically sets the conversation status to `handed_off`.

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

### Save a Conversation with Status

```bash
curl -X POST https://your-deployment.convex.cloud/api/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "sessionId": "ses_abc123",
    "startedAt": 1700000000000,
    "messages": [{"role":"user","content":"Hello","ts":1700000000}],
    "status": "resolved",
    "channel": "voice-livekit"
  }'
```

### Store Transcription Messages

The LiveKit agent automatically streams transcriptions to this endpoint, but you can also call it directly:

```bash
curl -X POST https://your-deployment.convex.cloud/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "messages": [
      {
        "sessionId": "ses_abc123",
        "roomName": "my-app-ses_abc123-1700000000",
        "participantIdentity": "user",
        "role": "user",
        "content": "Hello, I need help with my order",
        "isFinal": true,
        "createdAt": 1700000000000
      },
      {
        "sessionId": "ses_abc123",
        "roomName": "my-app-ses_abc123-1700000000",
        "participantIdentity": "agent",
        "role": "agent",
        "content": "Hi! I'd be happy to help. What's your order number?",
        "isFinal": true,
        "createdAt": 1700000001000
      }
    ]
  }'
```

### Get Session Messages

```bash
curl "https://your-deployment.convex.cloud/api/messages?sessionId=ses_abc123&appSlug=my-app&appSecret=..."
```

### Configure Persona

```bash
# Get current persona
curl "https://your-deployment.convex.cloud/api/persona?appSlug=my-app&appSecret=..."

# Update persona
curl -X PATCH https://your-deployment.convex.cloud/api/persona \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "personaName": "Aria",
    "personaTone": "friendly and professional",
    "personaGreeting": "Hi there! I'\''m Aria, your AI assistant.",
    "preferredTerms": "team member, guest, valued customer",
    "blockedTerms": "cheap, competitor names"
  }'
```

When the LiveKit agent starts, it automatically loads the persona from Convex and injects it into the agent's instructions.

### Create an A/B Experiment

```bash
curl -X POST https://your-deployment.convex.cloud/api/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "name": "greeting-style",
    "variants": [
      {"id": "formal", "weight": 50, "config": {"greeting": "Good day, how may I assist you?"}},
      {"id": "casual", "weight": 50, "config": {"greeting": "Hey! What can I help with?"}}
    ]
  }'
```

### Assign a Variant

Assignment is sticky — the same session always gets the same variant.

```bash
curl -X POST https://your-deployment.convex.cloud/api/experiments/assign \
  -H "Content-Type: application/json" \
  -d '{
    "appSlug": "my-app",
    "appSecret": "...",
    "experimentId": "jd72abc...",
    "sessionId": "ses_abc123"
  }'
# Returns: {"variantId": "casual", "alreadyAssigned": false}
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
# All time
curl "https://your-deployment.convex.cloud/api/analytics/overview?appSlug=my-app&appSecret=..."

# Last 24 hours only
curl "https://your-deployment.convex.cloud/api/analytics/overview?appSlug=my-app&appSecret=...&since=1700000000000"
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

## Transcription Storage

The `messages` table stores real-time transcription data from voice conversations. Messages are stored with:
- `sessionId` and `roomName` for linking to conversations and LiveKit rooms
- `participantIdentity` and `role` (`user` or `agent`)
- `content` (the transcribed text)
- `isFinal` flag (only final transcriptions are stored by default)
- `createdAt` timestamp

The LiveKit agent automatically streams transcriptions to `POST /api/messages` every 2 seconds during a conversation. On session close, remaining messages are flushed and the conversation status is updated to `resolved`.
