import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthCredentialsFromRequest, jsonResponse } from "./helpers";

/**
 * POST /api/auth/session — Create a short-lived session token.
 * Requires appSlug + appSecret (server-to-server only).
 * Returns { sessionToken, expiresAt } for use in browser clients.
 */
export const createSession = httpAction(async (ctx, request) => {
  const body = await request.json().catch(() => ({}));
  const { appSlug: bodySlug, appSecret: bodySecret, ttlMs } = body as {
    appSlug?: string;
    appSecret?: string;
    ttlMs?: number;
  };

  // Support header auth (preferred) while keeping body auth for compatibility.
  // Authorization: Bearer <appSecret>
  // X-App-Slug: <appSlug>
  const headerCreds = getAuthCredentialsFromRequest(request);
  const appSlug = headerCreds.bearerAppSlug ?? bodySlug;
  const appSecret = headerCreds.bearerToken ?? bodySecret;

  if (!appSlug || !appSecret) {
    return jsonResponse({ error: "Missing appSlug or appSecret" }, 400);
  }

  // Authenticate with app secret (this endpoint is server-to-server only)
  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const session = await ctx.runMutation(internal.sessionsDb.createSession, {
    appSlug,
    ttlMs,
  });

  return jsonResponse({
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  });
});
