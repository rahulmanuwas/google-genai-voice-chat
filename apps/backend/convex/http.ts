import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { corsHeaders } from "./helpers";

// ─── Existing handlers ──────────────────────────────────────────
import { createToken } from "./tokens";
import { logEvents } from "./events";
import { saveConversation, listConversations } from "./conversations";

// ─── Session auth ───────────────────────────────────────────────
import { createSession } from "./sessions";

// ─── Phase 1 handlers ───────────────────────────────────────────
import { listTools, executeTool, registerTool, listExecutions as listToolExecutions, listAllTools, logExecution as logToolExecution } from "./tools";
import { createHandoff, updateHandoff, listHandoffs } from "./handoffs";
import { checkGuardrails, upsertRule, listRules, listViolations, annotateViolation } from "./guardrails";
import { upsertDocument, searchKnowledge, listGaps, listDocuments as listKnowledgeDocs, searchMetrics } from "./knowledge";
import { submitCSAT, getInsights, getOverview, clusterTopics } from "./analytics";
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
import { upsertQaScenario, listQaScenarios, runQaScenario, listQaRuns } from "./qa";
import {
  upsertOutboundTrigger,
  listOutboundTriggers,
  dispatchOutbound,
  listOutboundDispatches,
} from "./outbound";
import { getScenarioState, resetScenarioState } from "./scenarioState";
import { upsertAnnotation, listAnnotations } from "./annotations";
import { getTraceTimeline } from "./traces";
import {
  createAgentSessionHandler,
  getAgentSessionHandler,
  promptAgentHandler,
  recordAgentSessionRunHandler,
  listAgentSessionRunsHandler,
  listRuntimesHandler,
} from "./agentSessions";

const http = httpRouter();

// ─── CORS preflight ─────────────────────────────────────────────
const handleOptions = httpAction(async (_ctx, request) => {
  const origin = request.headers.get("Origin") ?? undefined;
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
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
post("/api/tools/log", logToolExecution);

// ─── Handoffs ───────────────────────────────────────────────────
get("/api/handoffs", listHandoffs);
post("/api/handoffs", createHandoff);
patch("/api/handoffs", updateHandoff);

// ─── Guardrails ─────────────────────────────────────────────────
post("/api/guardrails/check", checkGuardrails);
post("/api/guardrails/rules", upsertRule);
get("/api/guardrails/rules", listRules);
get("/api/guardrails/violations", listViolations);
patch("/api/guardrails/violations", annotateViolation);

// ─── Knowledge (RAG) ────────────────────────────────────────────
post("/api/knowledge", upsertDocument);
post("/api/knowledge/search", searchKnowledge);
get("/api/knowledge/documents", listKnowledgeDocs);
get("/api/knowledge/gaps", listGaps);
get("/api/knowledge/metrics", searchMetrics);

// ─── Analytics ──────────────────────────────────────────────────
post("/api/csat", submitCSAT);
get("/api/analytics/insights", getInsights);
get("/api/analytics/overview", getOverview);
post("/api/analytics/cluster", clusterTopics);

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

// ─── QA Framework ───────────────────────────────────────────────
post("/api/qa/scenarios", upsertQaScenario);
get("/api/qa/scenarios", listQaScenarios);
post("/api/qa/runs", runQaScenario);
get("/api/qa/runs", listQaRuns);

// ─── Outbound Trigger Engine ───────────────────────────────────
post("/api/outbound/triggers", upsertOutboundTrigger);
get("/api/outbound/triggers", listOutboundTriggers);
post("/api/outbound/dispatch", dispatchOutbound);
get("/api/outbound/dispatches", listOutboundDispatches);

// ─── Annotations (Error Analysis) ───────────────────────────────
post("/api/annotations", upsertAnnotation);
get("/api/annotations", listAnnotations);

// ─── Trace Timeline ─────────────────────────────────────────────
get("/api/traces", getTraceTimeline);

// ─── Scenario State (Live Demo Data) ───────────────────────────
get("/api/scenario-state", getScenarioState);
post("/api/scenario-state/reset", resetScenarioState);

// ─── Agent Sessions (Multi-Runtime) ────────────────────────────
post("/api/agents/session", createAgentSessionHandler);
get("/api/agents/session", getAgentSessionHandler);
post("/api/agents/prompt", promptAgentHandler);
post("/api/agents/session/run", recordAgentSessionRunHandler);
get("/api/agents/session/runs", listAgentSessionRunsHandler);
get("/api/agents/runtimes", listRuntimesHandler);

export default http;
