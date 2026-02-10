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
import type * as analytics from "../analytics.js";
import type * as analyticsCluster from "../analyticsCluster.js";
import type * as analyticsClusterDb from "../analyticsClusterDb.js";
import type * as analyticsInternal from "../analyticsInternal.js";
import type * as apps from "../apps.js";
import type * as conversations from "../conversations.js";
import type * as conversationsInternal from "../conversationsInternal.js";
import type * as events from "../events.js";
import type * as eventsInternal from "../eventsInternal.js";
import type * as experiments from "../experiments.js";
import type * as experimentsDb from "../experimentsDb.js";
import type * as guardrails from "../guardrails.js";
import type * as guardrailsInternal from "../guardrailsInternal.js";
import type * as handoffs from "../handoffs.js";
import type * as handoffsDb from "../handoffsDb.js";
import type * as handoffsInternal from "../handoffsInternal.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeDb from "../knowledgeDb.js";
import type * as knowledgeInternal from "../knowledgeInternal.js";
import type * as livekit from "../livekit.js";
import type * as livekitDb from "../livekitDb.js";
import type * as livekitInternal from "../livekitInternal.js";
import type * as messages from "../messages.js";
import type * as messagesDb from "../messagesDb.js";
import type * as persona from "../persona.js";
import type * as personaDb from "../personaDb.js";
import type * as personas from "../personas.js";
import type * as personasDb from "../personasDb.js";
import type * as scenarioState from "../scenarioState.js";
import type * as scenarioStateDb from "../scenarioStateDb.js";
import type * as seed from "../seed.js";
import type * as seedScenarios from "../seedScenarios.js";
import type * as seedScenariosDb from "../seedScenariosDb.js";
import type * as sessions from "../sessions.js";
import type * as sessionsDb from "../sessionsDb.js";
import type * as tokens from "../tokens.js";
import type * as tokensInternal from "../tokensInternal.js";
import type * as toolHandlers from "../toolHandlers.js";
import type * as tools from "../tools.js";
import type * as toolsDb from "../toolsDb.js";
import type * as toolsInternal from "../toolsInternal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  analyticsCluster: typeof analyticsCluster;
  analyticsClusterDb: typeof analyticsClusterDb;
  analyticsInternal: typeof analyticsInternal;
  apps: typeof apps;
  conversations: typeof conversations;
  conversationsInternal: typeof conversationsInternal;
  events: typeof events;
  eventsInternal: typeof eventsInternal;
  experiments: typeof experiments;
  experimentsDb: typeof experimentsDb;
  guardrails: typeof guardrails;
  guardrailsInternal: typeof guardrailsInternal;
  handoffs: typeof handoffs;
  handoffsDb: typeof handoffsDb;
  handoffsInternal: typeof handoffsInternal;
  helpers: typeof helpers;
  http: typeof http;
  knowledge: typeof knowledge;
  knowledgeDb: typeof knowledgeDb;
  knowledgeInternal: typeof knowledgeInternal;
  livekit: typeof livekit;
  livekitDb: typeof livekitDb;
  livekitInternal: typeof livekitInternal;
  messages: typeof messages;
  messagesDb: typeof messagesDb;
  persona: typeof persona;
  personaDb: typeof personaDb;
  personas: typeof personas;
  personasDb: typeof personasDb;
  scenarioState: typeof scenarioState;
  scenarioStateDb: typeof scenarioStateDb;
  seed: typeof seed;
  seedScenarios: typeof seedScenarios;
  seedScenariosDb: typeof seedScenariosDb;
  sessions: typeof sessions;
  sessionsDb: typeof sessionsDb;
  tokens: typeof tokens;
  tokensInternal: typeof tokensInternal;
  toolHandlers: typeof toolHandlers;
  tools: typeof tools;
  toolsDb: typeof toolsDb;
  toolsInternal: typeof toolsInternal;
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
