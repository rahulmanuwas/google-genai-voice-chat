import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { CORS_HEADERS } from "./helpers";

// ─── Existing handlers ──────────────────────────────────────────
import { createToken } from "./tokens";
import { logEvents } from "./events";
import { saveConversation } from "./conversations";

// ─── Phase 1 handlers ───────────────────────────────────────────
import { listTools, executeTool, registerTool } from "./tools";
import { createHandoff, updateHandoff, listHandoffs } from "./handoffs";
import { checkGuardrails, upsertRule, listRules } from "./guardrails";
import { upsertDocument, searchKnowledge, listGaps } from "./knowledge";
import { submitCSAT, getInsights, getOverview } from "./analytics";

const http = httpRouter();

// ─── CORS preflight ─────────────────────────────────────────────
const handleOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

// Helpers to reduce boilerplate
function post(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "POST", handler });
  http.route({ path, method: "OPTIONS", handler: handleOptions });
}
function get(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "GET", handler });
  http.route({ path, method: "OPTIONS", handler: handleOptions });
}
function patch(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "PATCH", handler });
  http.route({ path, method: "OPTIONS", handler: handleOptions });
}

// ─── Token (existing) ───────────────────────────────────────────
post("/api/token", createToken);

// ─── Events (existing) ──────────────────────────────────────────
post("/api/events", logEvents);

// ─── Conversations (existing) ───────────────────────────────────
post("/api/conversations", saveConversation);

// ─── Tools ──────────────────────────────────────────────────────
get("/api/tools", listTools);
post("/api/tools", registerTool);
post("/api/tools/execute", executeTool);

// ─── Handoffs ───────────────────────────────────────────────────
get("/api/handoffs", listHandoffs);
post("/api/handoffs", createHandoff);
patch("/api/handoffs", updateHandoff);

// ─── Guardrails ─────────────────────────────────────────────────
post("/api/guardrails/check", checkGuardrails);
post("/api/guardrails/rules", upsertRule);
get("/api/guardrails/rules", listRules);

// ─── Knowledge (RAG) ────────────────────────────────────────────
post("/api/knowledge", upsertDocument);
post("/api/knowledge/search", searchKnowledge);
get("/api/knowledge/gaps", listGaps);

// ─── Analytics ──────────────────────────────────────────────────
post("/api/csat", submitCSAT);
get("/api/analytics/insights", getInsights);
get("/api/analytics/overview", getOverview);

export default http;
