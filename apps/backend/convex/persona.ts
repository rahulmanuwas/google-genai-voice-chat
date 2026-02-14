import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** GET /api/persona — Get persona config for an app (resolves personaId if set) */
export const getPersona = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { app } = auth;

  // If app has a linked persona, resolve it
  if (app.personaId) {
    const persona = await ctx.runQuery(internal.personas.getPersonaRecordById, {
      id: app.personaId as Id<"personas">,
    });
    if (persona && persona.isActive) {
      let uiStrings = null;
      try { uiStrings = persona.uiStrings ? JSON.parse(persona.uiStrings) : null; } catch { /* invalid JSON */ }
      return jsonResponse({
        systemPrompt: persona.systemPrompt ?? null,
        voice: persona.voice ?? null,
        personaName: persona.personaName ?? null,
        personaGreeting: persona.personaGreeting ?? null,
        personaTone: persona.personaTone ?? null,
        preferredTerms: persona.preferredTerms ?? null,
        blockedTerms: persona.blockedTerms ?? null,
        uiStrings,
      });
    }
  }

  // Fallback to embedded app fields
  let uiStrings = null;
  try { uiStrings = app.uiStrings ? JSON.parse(app.uiStrings) : null; } catch { /* invalid JSON */ }
  return jsonResponse({
    systemPrompt: app.systemPrompt ?? null,
    voice: app.voice ?? null,
    personaName: app.personaName ?? null,
    personaGreeting: app.personaGreeting ?? null,
    personaTone: app.personaTone ?? null,
    preferredTerms: app.preferredTerms ?? null,
    blockedTerms: app.blockedTerms ?? null,
    uiStrings,
  });
});

/** PATCH /api/persona — Update persona config */
export const updatePersona = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    personaName,
    personaGreeting,
    personaTone,
    preferredTerms,
    blockedTerms,
    uiStrings,
  } = body as {
    personaName?: string;
    personaGreeting?: string;
    personaTone?: string;
    preferredTerms?: string;
    blockedTerms?: string;
    uiStrings?: string;
  };

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.persona.updatePersonaFieldsRecord, {
    appId: auth.app._id,
    personaName,
    personaGreeting,
    personaTone,
    preferredTerms,
    blockedTerms,
    uiStrings,
  });

  return jsonResponse({ ok: true });
});

/** Update persona fields on an app */
export const updatePersonaFieldsRecord = internalMutation({
  args: {
    appId: v.id("apps"),
    voice: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
    uiStrings: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appId, ...fields } = args;

    const updates: Record<string, string> = {};
    if (fields.voice !== undefined) updates.voice = fields.voice;
    if (fields.personaName !== undefined) updates.personaName = fields.personaName;
    if (fields.personaGreeting !== undefined) updates.personaGreeting = fields.personaGreeting;
    if (fields.personaTone !== undefined) updates.personaTone = fields.personaTone;
    if (fields.preferredTerms !== undefined) updates.preferredTerms = fields.preferredTerms;
    if (fields.blockedTerms !== undefined) updates.blockedTerms = fields.blockedTerms;
    if (fields.uiStrings !== undefined) updates.uiStrings = fields.uiStrings;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(appId, {
        ...updates,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Assign a persona to an app */
export const assignPersonaToAppRecord = internalMutation({
  args: {
    appId: v.id("apps"),
    personaId: v.id("personas"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appId, {
      personaId: args.personaId,
      updatedAt: Date.now(),
    });
  },
});

/** Clear persona assignment from an app */
export const clearAppPersonaRecord = internalMutation({
  args: { appId: v.id("apps") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appId, {
      personaId: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Look up any app by slug (for persona assignment) */
export const getAppBySlugRecord = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
