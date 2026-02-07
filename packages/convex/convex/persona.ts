import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

/** GET /api/persona — Get persona config for an app */
export const getPersona = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { app } = auth;

  return jsonResponse({
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
