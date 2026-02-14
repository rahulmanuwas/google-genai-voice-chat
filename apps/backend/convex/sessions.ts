import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthCredentialsFromRequest, jsonResponse, corsHttpAction } from "./helpers";

/**
 * POST /api/auth/session — Create a short-lived session token.
 * Requires appSlug + appSecret (server-to-server only).
 * Returns { sessionToken, expiresAt } for use in browser clients.
 */
export const createSession = corsHttpAction(async (ctx, request) => {
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

  const session = await ctx.runMutation(internal.sessions.createSessionRecord, {
    appSlug,
    ttlMs,
  });

  return jsonResponse({
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  });
});

/** Look up a session by token, return null if expired */
export const getSessionByTokenRecord = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;

    return session;
  },
});

/** Create a new session token for an app */
export const createSessionRecord = internalMutation({
  args: {
    appSlug: v.string(),
    ttlMs: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMs ?? 3_600_000;
    const token = crypto.randomUUID();

    await ctx.db.insert("sessions", {
      appSlug: args.appSlug,
      token,
      expiresAt: now + ttl,
      createdAt: now,
    });

    return { token, expiresAt: now + ttl };
  },
});
