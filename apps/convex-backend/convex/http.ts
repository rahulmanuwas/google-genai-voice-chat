import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { CORS_HEADERS } from "./helpers";

// ─── Existing handlers ──────────────────────────────────────────
import { createToken } from "./tokens";
import { logEvents } from "./events";
import { saveConversation, listConversations } from "./conversations";

// ─── Session auth ───────────────────────────────────────────────
import { createSession } from "./sessions";

// ─── Phase 1 handlers ───────────────────────────────────────────
import { listTools, executeTool, registerTool, listExecutions as listToolExecutions, listAllTools } from "./tools";
import { createHandoff, updateHandoff, listHandoffs } from "./handoffs";
import { checkGuardrails, upsertRule, listRules, listViolations } from "./guardrails";
import { upsertDocument, searchKnowledge, listGaps, listDocuments as listKnowledgeDocs } from "./knowledge";
import { submitCSAT, getInsights, getOverview } from "./analytics";
import {
  generateToken as livekitToken,
  createRoom as livekitCreateRoom,
  listRooms as livekitListRooms,
  handleWebhook as livekitWebhook,
  endRoom as livekitEndRoom,
} from "./livekit";

// ─── New handlers ───────────────────────────────────────────────
import { saveMessages, listMessages } from "./messages";
import { getPersona, updatePersona } from "./persona";
import {
  listPersonas,
  createPersona,
  updatePersona as updatePersonaById,
  deletePersona,
  assignPersona,
} from "./personas";
import { createExperiment, listExperiments, assignVariant } from "./experiments";
import { getScenarioState, resetScenarioState } from "./scenarioState";

const http = httpRouter();

// ─── CORS preflight ─────────────────────────────────────────────
const handleOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

// Helpers to reduce boilerplate
const registeredOptions = new Set<string>();
function options(path: string) {
  if (!registeredOptions.has(path)) {
    http.route({ path, method: "OPTIONS", handler: handleOptions });
    registeredOptions.add(path);
  }
}
function post(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "POST", handler });
  options(path);
}
function get(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "GET", handler });
  options(path);
}
function patch(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "PATCH", handler });
  options(path);
}
function del(path: string, handler: Parameters<typeof http.route>[0]["handler"]) {
  http.route({ path, method: "DELETE", handler });
  options(path);
}

// ─── Auth ──────────────────────────────────────────────────────
post("/api/auth/session", createSession);

// ─── Token (existing) ───────────────────────────────────────────
post("/api/token", createToken);

// ─── Events (existing) ──────────────────────────────────────────
post("/api/events", logEvents);

// ─── Conversations ──────────────────────────────────────────────
get("/api/conversations", listConversations);
post("/api/conversations", saveConversation);

// ─── Tools ──────────────────────────────────────────────────────
get("/api/tools", listTools);
get("/api/tools/all", listAllTools);
get("/api/tools/executions", listToolExecutions);
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
get("/api/guardrails/violations", listViolations);

// ─── Knowledge (RAG) ────────────────────────────────────────────
post("/api/knowledge", upsertDocument);
post("/api/knowledge/search", searchKnowledge);
get("/api/knowledge/documents", listKnowledgeDocs);
get("/api/knowledge/gaps", listGaps);

// ─── Analytics ──────────────────────────────────────────────────
post("/api/csat", submitCSAT);
get("/api/analytics/insights", getInsights);
get("/api/analytics/overview", getOverview);

// ─── LiveKit ────────────────────────────────────────────────────
post("/api/livekit/token", livekitToken);
post("/api/livekit/rooms", livekitCreateRoom);
get("/api/livekit/rooms", livekitListRooms);
post("/api/livekit/webhook", livekitWebhook);
del("/api/livekit/rooms", livekitEndRoom);

// ─── Messages (Transcription Storage) ───────────────────────────
post("/api/messages", saveMessages);
get("/api/messages", listMessages);

// ─── Persona ────────────────────────────────────────────────────
get("/api/persona", getPersona);
patch("/api/persona", updatePersona);

// ─── Personas (Library) ─────────────────────────────────────────
get("/api/personas", listPersonas);
post("/api/personas", createPersona);
patch("/api/personas", updatePersonaById);
del("/api/personas", deletePersona);
patch("/api/personas/assign", assignPersona);

// ─── Experiments (A/B Testing) ──────────────────────────────────
post("/api/experiments", createExperiment);
get("/api/experiments", listExperiments);
post("/api/experiments/assign", assignVariant);

// ─── Scenario State (Live Demo Data) ───────────────────────────
get("/api/scenario-state", getScenarioState);
post("/api/scenario-state/reset", resetScenarioState);

export default http;
