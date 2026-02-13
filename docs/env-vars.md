# Environment Variables Reference

All environment variables used across the genai-voice monorepo, organized by deployment target.

---

## 1. Local Development

Variables needed to run `pnpm dev` (dashboard + LiveKit agent).

Create `apps/web/.env.local` as the single source of truth:

| Variable | Required | Build/Runtime | Description | Example |
|----------|----------|---------------|-------------|---------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Yes | Build-time | Gemini API key for client-side voice/chat | `AIzaSy...` |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Build-time | Convex HTTP deployment URL (ends in `.convex.site`) | `https://content-parakeet-457.convex.site` |
| `NEXT_PUBLIC_APP_SLUG` | Yes | Build-time | App identifier in Convex (default: `demo`) | `demo` |
| `NEXT_PUBLIC_LIVEKIT_URL` | Yes | Build-time | LiveKit Cloud WebSocket URL for client connection | `wss://myapp-abc123.livekit.cloud` |
| `APP_SECRET` | Yes | Runtime | Server-only secret for session auth — **never expose to browser** | `152b7a940d7c...` |
| `LIVEKIT_URL` | Yes | Runtime | LiveKit server API URL (HTTPS, not WSS) | `https://myapp-abc123.livekit.cloud` |
| `LIVEKIT_API_KEY` | Yes | Runtime | LiveKit Cloud API key | `APIsDz4w...` |
| `LIVEKIT_API_SECRET` | Yes | Runtime | LiveKit Cloud API secret | `OOGxXeaV...` |
| `GOOGLE_API_KEY` | Yes | Runtime | Gemini API key for LiveKit agent RealtimeModel (same key as `NEXT_PUBLIC_GEMINI_API_KEY`) | `AIzaSy...` |
| `LIVEKIT_SIP_TRUNK_ID` | No | Runtime | LiveKit SIP trunk ID (only for PSTN call demo) | `ST_4YXBs...` |
| `TWILIO_FROM_NUMBER` | No | Runtime | Outbound caller ID for SIP calls (E.164) | `+19095004531` |
| `GEMINI_API_KEY` | No | Runtime | Gemini key for server-side calls (Convex token generation, Next.js `/api/summarize`, `/api/memory/extract`) | `AIzaSy...` |

---

## 2. Railway — Dashboard Service

The dashboard is a Next.js standalone app deployed via `Dockerfile.dashboard`.

### Build-time variables

These are inlined into the Next.js client bundle during `next build`. They must be declared as `ARG` in the Dockerfile (already done) and set as Railway env vars **before** building.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL |
| `NEXT_PUBLIC_APP_SLUG` | Yes | App slug |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Yes | Gemini API key for client-side voice/chat |
| `NEXT_PUBLIC_LIVEKIT_URL` | Yes | LiveKit WebSocket URL |

> **Pitfall:** Changing a `NEXT_PUBLIC_*` variable requires a **rebuild**. Simply restarting the Railway service is not enough — the old value is baked into the JavaScript bundle.

### Runtime variables

Available via `process.env` at request time (server routes only):

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_SECRET` | Yes | Server-only secret for Convex session creation |
| `GEMINI_API_KEY` | No | Gemini key for server routes (`/api/summarize`, `/api/memory/extract`) |
| `LIVEKIT_URL` | Yes | LiveKit server API URL (HTTPS) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `LIVEKIT_SIP_TRUNK_ID` | No | SIP trunk for PSTN calls |
| `TWILIO_FROM_NUMBER` | No | Outbound caller ID |

### Auto-set by Dockerfile

These are set in the Dockerfile and do not need to be configured:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `3000` | HTTP server port |
| `HOSTNAME` | `0.0.0.0` | Bind to all interfaces |

---

## 3. Railway — Agent Service

The LiveKit agent is deployed via `Dockerfile.agent` using `node:20-slim` (not Alpine — `@livekit/rtc-node` needs `linux-x64-gnu`).

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Gemini API key for agent's RealtimeModel |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `LIVEKIT_URL` | Yes | LiveKit server URL |
| `CONVEX_URL` | Yes | Convex deployment URL (agent stores transcriptions) |
| `APP_SLUG` | No | App slug (agent can also parse from room name) |
| `APP_SECRET` | Yes | Server secret for Convex auth |

> **Note:** The agent checks `CONVEX_URL` first, then falls back to `NEXT_PUBLIC_CONVEX_URL`. Similarly, `APP_SLUG` falls back to `NEXT_PUBLIC_APP_SLUG`. In multi-tenant setups the agent parses the app slug from the room name instead.

---

## 4. Convex Cloud

Variables set in the [Convex dashboard](https://dashboard.convex.dev) under your deployment's **Settings > Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | For server-side token generation and knowledge embedding (uses `gemini-embedding-001`) |
| `LIVEKIT_URL` | Yes | LiveKit server URL (for room creation/deletion) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |

### Deployment CLI

Used when deploying or seeding from the command line — **not** set in the Convex dashboard:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CONVEX_DEPLOY_KEY` | Yes (CLI) | Auth key for `npx convex deploy` and `npx convex run` | `prod:content-parakeet-457\|eyJ2Mi...` |

Deploy command:
```bash
cd apps/backend
CONVEX_DEPLOY_KEY=... npx convex deploy --typecheck disable -y
```

---

## 5. Telephony (Optional)

Only needed if using `@genai-voice/telephony` for SMS or direct voice calls (not LiveKit SIP):

| Variable | Required | Service | Description |
|----------|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | No | Twilio | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio | Outbound phone number (E.164) |
| `TELNYX_API_KEY` | No | Telnyx | Telnyx API key |
| `TELNYX_CONNECTION_ID` | No | Telnyx | Telnyx connection ID |

---

## Common Pitfalls

1. **`NEXT_PUBLIC_*` requires rebuild** — These values are inlined at build time by Next.js. Changing them on Railway/Vercel requires a new deployment, not just a restart.

2. **`GOOGLE_API_KEY` = same key as `NEXT_PUBLIC_GEMINI_API_KEY`** — The LiveKit agent plugin expects `GOOGLE_API_KEY` but it's the same Gemini key.

3. **`LIVEKIT_URL` protocol** — Client-side uses `wss://` (WebSocket), server-side uses `https://`. The `NEXT_PUBLIC_LIVEKIT_URL` is WSS; the `LIVEKIT_URL` is HTTPS.

4. **`APP_SECRET` is server-only** — Never set it as a `NEXT_PUBLIC_*` variable. The dashboard proxies session creation through `/api/session` so the browser never sees it.

5. **Convex `GEMINI_API_KEY`** — Uses `gemini-embedding-001` for knowledge embeddings (768 dims via `outputDimensionality`). The older `text-embedding-004` model was shut down Jan 14, 2026.

6. **Agent Dockerfile uses `node:20-slim`** — Not Alpine. The `@livekit/rtc-node` native binary is only built for `linux-x64-gnu` (glibc), not musl.
