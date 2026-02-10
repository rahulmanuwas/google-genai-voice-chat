# To-Do: Roadmap to Sierra-Level Competitiveness

Status as of Feb 9, 2026.

---

## Sierra Competitive Scorecard

Based on analysis of 32 Sierra.ai case studies (see `findings.md`).

| # | Sierra Capability | Our Status | Gap |
|---|---|---|---|
| 1 | Tool/Action Execution | Built (10 tools, Convex backend, audit trail, dynamic loading) | Confirmation not enforced at runtime |
| 2 | Human Handoff | Built (priority, claim/resolve, webhook, AI summary) | No CRM connectors |
| 3 | Guardrails & Safety | Endpoints exist but **not called by the agent** | Agent bypasses all guardrails |
| 4 | Multi-Channel | Voice (WebRTC + PSTN), text, SMS adapter | No email channel |
| 5 | Knowledge Management (RAG) | Built (vector search, Gemini embeddings, gap detection) | No bulk import, no versioning |
| 6 | Analytics & Insights | Built (overview, KPIs, time range filter, AI transcript summary) | No cohort analysis |
| 7 | Conversation Testing / QA | **Not started** | No test runner, no QA scoring |
| 8 | Brand Persona | Built (persona config, dashboard editor) | No live preview |
| 9 | Multi-Language | Gemini handles natively | No UI i18n |
| 10 | Proactive / Outbound | Built (PSTN outbound via LiveKit SIP) | No scheduled triggers |
| 11 | A/B Testing | Built (weighted variants, sticky assignment) | **No metrics or results** |
| 12 | No-Code Builder | JSON config exists | No visual builder |

**Score: 7/12 done, 3/12 half-done, 2/12 not started.**

---

## Principles

- Demo-first: prioritize work that is visible and impressive in a live walkthrough.
- Keep each PR small, reviewable, and revertable.
- Enforcement belongs at the backend boundary, not in clients.

---

## PR Plan (Demo-First Order)

### PR 1 — Header Auth + Deprecate `appSecret` In URLs  **DONE**

Shipped in commit `382fb5a` on `dev`. Needs Convex deploy to go live.

- All Convex HTTP endpoints accept `Authorization: Bearer <token>` + `X-App-Slug`
- `getAuthCredentialsFromRequest()` shared helper extracts creds from headers or query params
- LiveKit agent callbacks/tools use headers instead of query-string secrets
- CORS allows `Authorization` and `X-App-Slug` headers
- Legacy `?appSecret=...` still works (backwards compatible)

**Next step**: Deploy Convex backend, then switch dashboard `api-client.ts` from query-param auth to header auth.

---

### PR 2 — Enforce Guardrails In The Agent Loop (Demo: Safety)

**Why first**: Most demo-able feature. Show a user trying to jailbreak or say something abusive, getting blocked in real-time, and an auto-handoff being created. Every Sierra case study mentions safety. This is the #1 trust signal for enterprise buyers.

Goal: ensure guardrails run in production paths, not just as endpoints.

Scope:
- Add `checkGuardrails` callback to `AgentCallbacks` interface
- Implement Convex-backed `checkGuardrails` by calling `POST /api/guardrails/check`
- Enforce in agent runtime:
  - Check user transcript (`direction: "input"`) on `user_input_transcribed` (final)
  - Check tool intent before `/api/tools/execute`
  - On `block`: create handoff + stop further tool execution for the session
  - Agent responds with a configurable safety message instead of continuing

Touch:
- `packages/livekit/src/agent/callbacks.ts`
- `packages/livekit/src/agent/agent.ts`
- `packages/livekit/src/agent/tools.ts`

Acceptance:
- A guardrail `block` reliably prevents tool execution.
- A `block` triggers a handoff with transcript + summary.
- Demo: say "I want to hack your system" → agent stops, dashboard shows violation + handoff.

---

### PR 3 — Enforce Tool Confirmation (Demo: Controlled Actions)

**Why next**: Shows the agent asking "are you sure you want to cancel your appointment?" before destructive actions. Every Sierra e-commerce/fintech case study highlights this. Directly demo-able.

Goal: close the "available vs active" gap for tool controls.

Scope:
- `requiresConfirmation`: do not execute unless request includes `confirmed: true`; return `confirmation_pending` otherwise.
- `requiresAuth`: reject unless authenticated via `sessionToken`.
- Agent handles `confirmation_pending` by asking the user to confirm.
- Audit logging status includes `confirmation_pending`.

Touch:
- `apps/backend/convex/tools.ts` (`POST /api/tools/execute`)
- `apps/backend/convex/toolsInternal.ts`
- `packages/livekit/src/agent/tools.ts` (handle `confirmation_pending` response)

Acceptance:
- Demo: ask to cancel an appointment → agent says "are you sure?" → user confirms → tool executes.
- Dashboard tools page shows `confirmation_pending` status in execution log.

---

### PR 4 — Experiment Metrics & Results (Demo: Data-Driven)

**Why next**: The experiments page currently creates A/B tests with variants but shows zero results. Adding basic metrics transforms it from "config page" to "data-driven optimization" — a key Sierra differentiator (Thrive Market, AG1 case studies).

Goal: show which experiment variant is winning.

Scope:
- Track experiment exposure → outcome (conversation resolved, CSAT score, handoff rate) per variant.
- Add metrics card to experiments dashboard page: variant name, exposure count, resolution rate, avg CSAT.
- Add basic statistical significance indicator (chi-squared or z-test).
- Endpoint: `GET /api/experiments/:id/results`

Touch:
- `apps/backend/convex/schema.ts` (add `experimentResults` or extend `experimentExposures`)
- `apps/backend/convex/experiments.ts` (new results endpoint)
- `apps/backend/convex/experimentsDb.ts` (metrics aggregation query)
- `apps/web/src/app/experiments/page.tsx` (results display)

Acceptance:
- Demo: show two variants, one outperforming the other, with sample sizes and significance.

---

### PR 5 — Conversation QA / Test Scenario Runner (Demo: Enterprise Trust)

**Why next**: Sierra's Ramp case study highlights "AI-driven conversation simulation before launch with regression checks." AG1 achieves 99% quality scores. This is table stakes for enterprise trust and completely missing today.

Goal: repeatable test scenarios that validate agent behavior.

Scope:
- Define test scenarios in JSON:
  ```json
  {
    "name": "appointment-booking-happy-path",
    "turns": [
      { "role": "user", "content": "I need to book a dental cleaning" }
    ],
    "expectations": {
      "shouldCallTool": "check_availability",
      "shouldNotContain": ["I don't know", "I can't help"],
      "shouldContain": ["appointment"]
    }
  }
  ```
- Node.js test runner that sends turns via LiveKit or direct API and validates expectations.
- Dashboard page: list scenarios, run status, pass/fail history.

Touch:
- `tests/scenarios/` (scenario JSON files)
- `tests/runner.ts` (test runner script)
- `apps/web/src/app/qa/page.tsx` (new dashboard page)

Acceptance:
- `pnpm test:scenarios` runs all scenarios, exits non-zero on failure.
- Dashboard shows last run results.

---

### PR 6 — CORS Allowlist (No More `*`)

Goal: prevent arbitrary origins from using the API in browsers.

Scope:
- Replace static `CORS_HEADERS` with request-aware CORS:
  - Allowlist via env var (`CORS_ALLOWED_ORIGINS`)
  - Add `Vary: Origin`
- Ensure `OPTIONS` preflights work with `Authorization` and `X-App-Slug`.

Touch:
- `apps/backend/convex/helpers.ts`
- `apps/backend/convex/http.ts`

Acceptance:
- Allowlisted origins get correct CORS headers.
- Non-allowlisted origins are rejected.

---

### PR 7 — Rate Limiting For Token Vending

Goal: reduce abuse risk on endpoints that mint tokens/sessions.

Scope:
- Simple fixed-window rate limiting on:
  - `POST /api/auth/session`
  - `POST /api/token`
  - `POST /api/livekit/token`
- Key: `appSlug`, Window: 60s, conservative limits.

Touch:
- `apps/backend/convex/schema.ts` (rate-limit table)
- `apps/backend/convex/helpers.ts` (shared rate-limit helper)
- `apps/backend/convex/sessions.ts`, `tokens.ts`, `livekit.ts`

Acceptance:
- Over-limit requests return `429`.
- Normal traffic unaffected.

---

### PR 8 — Sign Handoff Webhooks (HMAC + Idempotency)

Goal: receivers can verify webhook authenticity and safely dedupe.

Scope:
- Signing secret per app.
- Headers: `X-Signature-256` (HMAC SHA-256), `X-Signature-Timestamp`, `X-Idempotency-Key: <handoffId>`.
- Include `aiSummary` and linkable `handoffId` in payload.

Touch:
- `apps/backend/convex/schema.ts`
- `apps/backend/convex/handoffs.ts`
- `apps/backend/convex/handoffsInternal.ts`

---

### PR 9 — E2E Regression Runner

Goal: protect new enforcement behavior with repeatable checks.

Scope:
- Node script asserting: header auth, CORS, tool confirmation, guardrail blocking, handoff creation.
- Location: `tests/e2e/`
- Runs against a live Convex backend.

Acceptance:
- `pnpm test:e2e` exits non-zero on failure.

---

## Dashboard Improvements (Shipped)

- [x] Time range selector on overview page (1h / 1d / 1w / All)
- [x] AI summary with sentiment, topics, and resolution on conversation detail page
- [x] Tool usage: replaced clipped bar chart with inline progress-bar table
- [x] Auth fix: session route and API client work with current deployed backend

---

## Longer-Term (Post-Demo)

| Item | Sierra Reference | Effort |
|---|---|---|
| RBAC / SSO / SCIM | Every enterprise case study | Large |
| PII redaction pipeline | SoFi, Chime (compliance) | Medium |
| Data retention / deletion | GDPR, enterprise policy | Medium |
| CRM connectors (Zendesk, Salesforce, Intercom) | Sonos, Chubbies, OluKai | Medium per connector |
| ML-based guardrails (beyond regex) | Ramp (jailbreak detection, supervisory models) | Large |
| No-code agent builder | Wilson (Agent Studio), CDW, Brex | Large |
| Email channel | Thrive Market, melin | Medium |
| Scheduled outbound triggers | RunBuggy, Rocket Mortgage | Medium |
| Knowledge bulk import (CSV, URL crawl) | ScottsMiracle-Gro, Wilson | Small |
| UI i18n for multi-language | Guild (20+ languages), Funnel Leasing | Medium |
| Call recording download | Built into LiveKit, needs UI | Small |
| Conversation search by content | — | Small |
