import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** GET /api/personas — List all active personas */
export const listPersonas = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const personas = await ctx.runQuery(internal.personas.listPersonaRecords, {});
  return jsonResponse({ personas });
});

/** POST /api/personas — Create a new persona */
export const createPersona = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { name, systemPrompt, ...fields } = body as {
    name?: string;
    systemPrompt?: string;
    voice?: string;
    personaName?: string;
    personaGreeting?: string;
    personaTone?: string;
    preferredTerms?: string;
    blockedTerms?: string;
  };

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!name || !systemPrompt) {
    return jsonResponse({ error: "name and systemPrompt are required" }, 400);
  }

  const id = await ctx.runMutation(internal.personas.createPersonaRecord, {
    name,
    systemPrompt,
    voice: fields.voice,
    personaName: fields.personaName,
    personaGreeting: fields.personaGreeting,
    personaTone: fields.personaTone,
    preferredTerms: fields.preferredTerms,
    blockedTerms: fields.blockedTerms,
  });

  return jsonResponse({ id });
});

/** PATCH /api/personas — Update an existing persona */
export const updatePersona = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { personaId, ...fields } = body as {
    personaId?: string;
    name?: string;
    systemPrompt?: string;
    voice?: string;
    personaName?: string;
    personaGreeting?: string;
    personaTone?: string;
    preferredTerms?: string;
    blockedTerms?: string;
  };

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!personaId) {
    return jsonResponse({ error: "personaId is required" }, 400);
  }
  const personaRecordId = personaId as Id<"personas">;

  await ctx.runMutation(internal.personas.updatePersonaRecordById, {
    id: personaRecordId,
    name: fields.name,
    systemPrompt: fields.systemPrompt,
    voice: fields.voice,
    personaName: fields.personaName,
    personaGreeting: fields.personaGreeting,
    personaTone: fields.personaTone,
    preferredTerms: fields.preferredTerms,
    blockedTerms: fields.blockedTerms,
  });

  return jsonResponse({ ok: true });
});

/** DELETE /api/personas — Soft-delete a persona */
export const deletePersona = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { personaId } = body as {
    personaId?: string;
  };

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!personaId) {
    return jsonResponse({ error: "personaId is required" }, 400);
  }
  const personaRecordId = personaId as Id<"personas">;

  await ctx.runMutation(internal.personas.deletePersonaRecordById, {
    id: personaRecordId,
  });

  return jsonResponse({ ok: true });
});

/** PATCH /api/personas/assign — Assign or clear a persona on an app */
export const assignPersona = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { personaId, targetAppSlug } = body as {
    personaId?: string | null;
    targetAppSlug?: string;
  };

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!targetAppSlug) {
    return jsonResponse({ error: "targetAppSlug is required" }, 400);
  }

  // Look up the target app
  const targetApp = await ctx.runQuery(internal.persona.getAppBySlugRecord, { slug: targetAppSlug });
  if (!targetApp) {
    return jsonResponse({ error: `App not found: ${targetAppSlug}` }, 404);
  }

  if (personaId) {
    const personaRecordId = personaId as Id<"personas">;
    await ctx.runMutation(internal.persona.assignPersonaToAppRecord, {
      appId: targetApp._id,
      personaId: personaRecordId,
    });
  } else {
    await ctx.runMutation(internal.persona.clearAppPersonaRecord, {
      appId: targetApp._id,
    });
  }

  return jsonResponse({ ok: true });
});

/** List all active personas */
export const listPersonaRecords = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("personas")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/** Get a single persona by ID */
export const getPersonaRecordById = internalQuery({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Create a new persona */
export const createPersonaRecord = internalMutation({
  args: {
    name: v.string(),
    systemPrompt: v.string(),
    voice: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("personas", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update fields on an existing persona */
export const updatePersonaRecordById = internalMutation({
  args: {
    id: v.id("personas"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    voice: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
    }
  },
});

/** Soft-delete a persona (set isActive: false) */
export const deletePersonaRecordById = internalMutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
  },
});
