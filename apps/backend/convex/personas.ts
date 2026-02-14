import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** GET /api/personas — List all active personas */
export const listPersonas = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const personas = await ctx.runQuery(internal.personasDb.listPersonas, {});
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

  const id = await ctx.runMutation(internal.personasDb.createPersona, {
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

  await ctx.runMutation(internal.personasDb.updatePersonaById, {
    id: personaId as any,
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

  await ctx.runMutation(internal.personasDb.deletePersona, {
    id: personaId as any,
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
  const targetApp = await ctx.runQuery(internal.personaDb.getAppBySlug, { slug: targetAppSlug });
  if (!targetApp) {
    return jsonResponse({ error: `App not found: ${targetAppSlug}` }, 404);
  }

  if (personaId) {
    await ctx.runMutation(internal.personaDb.assignPersonaToApp, {
      appId: targetApp._id,
      personaId: personaId as any,
    });
  } else {
    await ctx.runMutation(internal.personaDb.clearAppPersona, {
      appId: targetApp._id,
    });
  }

  return jsonResponse({ ok: true });
});
