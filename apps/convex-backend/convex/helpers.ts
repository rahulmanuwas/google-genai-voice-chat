import { internal } from "./_generated/api";

/** Shared CORS + JSON response headers */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export interface AuthCredentials {
  appSlug?: string;
  appSecret?: string;
  sessionToken?: string;
}

export interface AuthResult {
  app: {
    _id: string;
    slug: string;
    secret: string;
    isActive: boolean;
    [key: string]: unknown;
  };
  authMethod: "appSecret" | "sessionToken";
}

/**
 * Authenticate a request using either appSecret (server-to-server)
 * or sessionToken (browser-safe). Returns null if unauthorized.
 */
export async function authenticateRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { runQuery: (...args: any[]) => any },
  creds: AuthCredentials,
): Promise<AuthResult | null> {
  // Path A: Session token
  if (creds.sessionToken) {
    const session = await ctx.runQuery(
      internal.sessionsDb.getSessionByToken,
      { token: creds.sessionToken },
    );
    if (!session) return null;

    const app = await ctx.runQuery(
      internal.apps.getAppBySlug,
      { slug: session.appSlug },
    );
    if (!app || !app.isActive) return null;

    return { app, authMethod: "sessionToken" };
  }

  // Path B: App secret (server-to-server)
  if (creds.appSlug && creds.appSecret) {
    const app = await ctx.runQuery(
      internal.apps.getAppBySlug,
      { slug: creds.appSlug },
    );
    if (!app || app.secret !== creds.appSecret || !app.isActive) return null;

    return { app, authMethod: "appSecret" };
  }

  return null;
}
