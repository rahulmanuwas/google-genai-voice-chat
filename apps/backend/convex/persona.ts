import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest } from "./helpers";

/** GET /api/persona — Get persona config for an app (resolves personaId if set) */
export const getPersona = httpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { app } = auth;

  // If app has a linked persona, resolve it
  if (app.personaId) {
    const persona = await ctx.runQuery(internal.personasDb.getPersonaById, {
      id: app.personaId as any,
    });
    if (persona && persona.isActive) {
      return jsonResponse({
        systemPrompt: persona.systemPrompt ?? null,
        personaName: persona.personaName ?? null,
        personaGreeting: persona.personaGreeting ?? null,
        personaTone: persona.personaTone ?? null,
        preferredTerms: persona.preferredTerms ?? null,
        blockedTerms: persona.blockedTerms ?? null,
      });
    }
  }

  // Fallback to embedded app fields
  return jsonResponse({
    systemPrompt: app.systemPrompt ?? null,
    personaName: app.personaName ?? null,
    personaGreeting: app.personaGreeting ?? null,
    personaTone: app.personaTone ?? null,
    preferredTerms: app.preferredTerms ?? null,
    blockedTerms: app.blockedTerms ?? null,
  });
});

/** PATCH /api/persona — Update persona config */
export const updatePersona = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    appSlug,
    appSecret,
    sessionToken,
    personaName,
    personaGreeting,
    personaTone,
    preferredTerms,
    blockedTerms,
  } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    personaName?: string;
    personaGreeting?: string;
    personaTone?: string;
    preferredTerms?: string;
    blockedTerms?: string;
  };

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.personaDb.updatePersona, {
    appId: auth.app._id,
    personaName,
    personaGreeting,
    personaTone,
    preferredTerms,
    blockedTerms,
  });

  return jsonResponse({ ok: true });
});
