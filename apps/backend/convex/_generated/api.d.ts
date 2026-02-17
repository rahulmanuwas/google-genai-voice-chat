/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agentSessions from "../agentSessions.js";
import type * as agentSessionsDb from "../agentSessionsDb.js";
import type * as analytics from "../analytics.js";
import type * as analyticsCluster from "../analyticsCluster.js";
import type * as analyticsClusterRecords from "../analyticsClusterRecords.js";
import type * as analyticsInternal from "../analyticsInternal.js";
import type * as annotations from "../annotations.js";
import type * as apps from "../apps.js";
import type * as conversations from "../conversations.js";
import type * as conversationsInternal from "../conversationsInternal.js";
import type * as events from "../events.js";
import type * as experiments from "../experiments.js";
import type * as guardrails from "../guardrails.js";
import type * as guardrailsInternal from "../guardrailsInternal.js";
import type * as handoffs from "../handoffs.js";
import type * as handoffsInternal from "../handoffsInternal.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeInternal from "../knowledgeInternal.js";
import type * as livekit from "../livekit.js";
import type * as livekitInternal from "../livekitInternal.js";
import type * as messages from "../messages.js";
import type * as outbound from "../outbound.js";
import type * as persona from "../persona.js";
import type * as personas from "../personas.js";
import type * as qa from "../qa.js";
import type * as qaInternal from "../qaInternal.js";
import type * as scenarioState from "../scenarioState.js";
import type * as seed from "../seed.js";
import type * as seedScenarios from "../seedScenarios.js";
import type * as seedScenariosRecords from "../seedScenariosRecords.js";
import type * as sessions from "../sessions.js";
import type * as tokens from "../tokens.js";
import type * as tokensInternal from "../tokensInternal.js";
import type * as toolHandlers from "../toolHandlers.js";
import type * as tools from "../tools.js";
import type * as toolsInternal from "../toolsInternal.js";
import type * as traces from "../traces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agentSessions: typeof agentSessions;
  agentSessionsDb: typeof agentSessionsDb;
  analytics: typeof analytics;
  analyticsCluster: typeof analyticsCluster;
  analyticsClusterRecords: typeof analyticsClusterRecords;
  analyticsInternal: typeof analyticsInternal;
  annotations: typeof annotations;
  apps: typeof apps;
  conversations: typeof conversations;
  conversationsInternal: typeof conversationsInternal;
  events: typeof events;
  experiments: typeof experiments;
  guardrails: typeof guardrails;
  guardrailsInternal: typeof guardrailsInternal;
  handoffs: typeof handoffs;
  handoffsInternal: typeof handoffsInternal;
  helpers: typeof helpers;
  http: typeof http;
  knowledge: typeof knowledge;
  knowledgeInternal: typeof knowledgeInternal;
  livekit: typeof livekit;
  livekitInternal: typeof livekitInternal;
  messages: typeof messages;
  outbound: typeof outbound;
  persona: typeof persona;
  personas: typeof personas;
  qa: typeof qa;
  qaInternal: typeof qaInternal;
  scenarioState: typeof scenarioState;
  seed: typeof seed;
  seedScenarios: typeof seedScenarios;
  seedScenariosRecords: typeof seedScenariosRecords;
  sessions: typeof sessions;
  tokens: typeof tokens;
  tokensInternal: typeof tokensInternal;
  toolHandlers: typeof toolHandlers;
  tools: typeof tools;
  toolsInternal: typeof toolsInternal;
  traces: typeof traces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
