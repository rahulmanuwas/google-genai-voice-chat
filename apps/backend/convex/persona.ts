import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** GET /api/persona — Get persona config for an app (resolves personaId if set) */
export const getPersona = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { app } = auth;

  // If app has a linked persona, resolve it
  if (app.personaId) {
    const persona = await ctx.runQuery(internal.personasDb.getPersonaById, {
      id: app.personaId as any,
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

  await ctx.runMutation(internal.personaDb.updatePersona, {
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
